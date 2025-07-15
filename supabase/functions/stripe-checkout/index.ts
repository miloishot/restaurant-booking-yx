import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@latest';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  try {
    console.log('Received request to stripe-checkout function');
    
    if (req.method === 'OPTIONS') {
      return corsResponse({}, 204);
    }

    if (req.method !== 'POST') {
      return corsResponse({ error: 'Method not allowed' }, 405);
    }

    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody));
    
    const { price_id, success_url, cancel_url, mode, cart_items, table_id, session_id, restaurantId } = requestBody;
    
    // Validate restaurantId is provided
    if (!restaurantId) {
      return corsResponse({ error: 'restaurantId is required' }, 400);
    }
    
    // Fetch the restaurant's Stripe secret key
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('stripe_secret_key')
      .eq('id', restaurantId)
      .single();
    
    if (restaurantError || !restaurant) {
      console.error('Error fetching restaurant:', restaurantError);
      return corsResponse({ error: 'Restaurant not found' }, 404);
    }
    
    if (!restaurant.stripe_secret_key) {
      console.error('Restaurant does not have a Stripe secret key configured');
      return corsResponse({ error: 'Stripe not configured for this restaurant' }, 400);
    }
    
    // Initialize Stripe with the restaurant-specific secret key
    const stripe = new Stripe(restaurant.stripe_secret_key, {
      appInfo: {
        name: 'Bolt Integration',
        version: '1.0.0',
      },
    });

    const error = validateParameters(
      { success_url, cancel_url, mode },
      {
        success_url: { required: true, type: 'string' },
        cancel_url: { required: true, type: 'string' },
        mode: { required: true, type: 'string' },
      }
    );

    if (error) {
      return corsResponse({ error }, 400);
    }

    const authHeader = req.headers.get('Authorization')!;
    if (!authHeader) {
      return corsResponse({ error: 'Missing Authorization header' }, 401);
    }
    
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);

    if (getUserError) {
      console.error('Auth error:', getUserError);
      return corsResponse({ error: 'Failed to authenticate user' }, 401);
    }

    if (!user) {
      return corsResponse({ error: 'User not found' }, 404);
    }

    // For restaurant orders, we don't need to check for existing customer
    console.log('Processing mode:', mode);
    
    if (mode === 'payment' && cart_items && cart_items.length > 0) {
      // Create a new customer for this order
      const newCustomer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          userId: user.id,
        },
      });
      
      console.log('Created Stripe customer:', newCustomer.id);

      // Create line items from cart
      const line_items = cart_items.map((item: any) => ({
        price_data: {
          currency: 'sgd',
          product_data: {
            name: item.menu_item.name,
          },
          unit_amount: Math.round(item.menu_item.price_sgd * 100),
        },
        quantity: item.quantity,
      }));

      console.log('Created line items for checkout');
      
      // Create checkout session for restaurant order
      const session = await stripe.checkout.sessions.create({
        customer: newCustomer.id,
        payment_method_types: ['card'],
        line_items,
        mode: 'payment',
        success_url,
        cancel_url,
        metadata: {
          table_id,
          session_id,
          user_id: user.id,
        },
      });

      console.log('Created checkout session:', session.id);
      
      return corsResponse({ sessionId: session.id, url: session.url });
    }

    // For subscription mode, check if customer already exists
    const { data: customer, error: getCustomerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (getCustomerError) {
      console.error('Failed to fetch customer information from the database:', getCustomerError);

      return corsResponse({ error: 'Failed to fetch customer information' }, 500);
    }

    let customerId: string;

    if (!customer) {
      // Create a new customer in Stripe
      const newCustomer = await stripe.customers.create({
        email: user.email!,
        metadata: {
          userId: user.id,
        },
      });

      // Save customer information in the database
      const { error: createCustomerError } = await supabase.from('customers').insert({
        id: user.id,
        stripe_customer_id: newCustomer.id,
        email: user.email!,
      });

      if (createCustomerError) {
        console.error('Failed to save customer information in the database:', createCustomerError);

        // Try to clean up both the Stripe customer and subscription record
        try {
          await stripe.customers.del(newCustomer.id);
        } catch (cleanupError) {
          console.error('Failed to clean up Stripe customer after database error:', cleanupError);
        }

        return corsResponse({ error: 'Failed to save customer information' }, 500);
      }

      customerId = newCustomer.id;

      if (mode === 'subscription') {
        // Create subscription record in the database
        const { error: createSubscriptionError } = await supabase.from('subscriptions').insert({
          user_id: user.id,
          stripe_customer_id: newCustomer.id,
          status: 'incomplete',
        });

        if (createSubscriptionError) {
          console.error('Failed to save subscription in the database:', createSubscriptionError);

          // Try to clean up the Stripe customer since we couldn't create the subscription
          try {
            await stripe.customers.del(newCustomer.id);
          } catch (cleanupError) {
            console.error('Failed to clean up Stripe customer after subscription creation error:', cleanupError);
          }

          return corsResponse({ error: 'Failed to save subscription information' }, 500);
        }
      }
    } else {
      customerId = customer.stripe_customer_id;

      if (mode === 'subscription') {
        // Check if subscription record exists
        const { data: subscription, error: getSubscriptionError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (getSubscriptionError) {
          console.error('Failed to fetch subscription information from the database:', getSubscriptionError);

          return corsResponse({ error: 'Failed to fetch subscription information' }, 500);
        }

        if (!subscription) {
          // Create subscription record for existing customer
          const { error: createSubscriptionError } = await supabase.from('subscriptions').insert({
            user_id: user.id,
            stripe_customer_id: customerId,
            status: 'incomplete',
          });

          if (createSubscriptionError) {
            console.error('Failed to create subscription record for existing customer:', createSubscriptionError);

            return corsResponse({ error: 'Failed to create subscription record for existing customer' }, 500);
          }
        }
      }
    }

    // create Checkout Session
    let session: Stripe.Checkout.Session;
    if (mode === 'subscription') {
      if (!price_id) {
        return corsResponse({ error: 'price_id is required for subscription mode' }, 400);
      }

      session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            // For subscriptions, we use the price_id directly
            price: price_id,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url,
        cancel_url,
      });
    }
    
    console.log(`Created checkout session ${session!.id} for customer ${customerId}`);

    console.log(`Created checkout session ${session.id} for customer ${customerId}`);

    return corsResponse({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    
    return corsResponse({ 
      error: 'Internal server error',
      message: error.message,
      details: 'Check function logs for more information'
    }, 500);
  }
});

function corsResponse(data: any, status = 200) {
  // For status 204, we must return a response with null body
  if (status === 204) {
    return new Response(null, {
      status,
      headers: corsHeaders,
    });
  }
  
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Expectations<T> = {
  [K in keyof T]?: {
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object';
  };
};

function validateParameters<T extends Record<string, any>>(values: T, expected: Expectations<T>): string | undefined {
  for (const parameter in values) {
    const expectation = expected[parameter as keyof T];
    if (!expectation) continue; // Skip validation for parameters not in expected
    
    const value = values[parameter];
    
    if (expectation.required && (value === undefined || value === null || value === '')) {
      return `${parameter} is required`;
    }
    
    if (value !== undefined && value !== null && expectation.type) {
      const actualType = typeof value;
      if (actualType !== expectation.type) {
        return `${parameter} must be of type ${expectation.type}, got ${actualType}`;
      }
    }
  }
  
  return undefined;
}