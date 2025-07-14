import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check environment variables first
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
      console.error('Missing environment variables:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        stripeSecretKey: !!stripeSecretKey,
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error: Missing required environment variables',
          details: 'Please configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and STRIPE_SECRET_KEY'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Import dependencies after environment check
    const { createClient } = await import('npm:@supabase/supabase-js@2.49.1');
    const Stripe = await import('npm:stripe@latest');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe.default(stripeSecretKey, {
      appInfo: {
        name: 'Restaurant Booking System',
        version: '1.0.0',
      },
    });

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const body = await req.json();
    const { cart_items, table_id, session_id, success_url, cancel_url } = body;

    // Validate required parameters
    if (!cart_items || !Array.isArray(cart_items) || cart_items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Cart items are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!table_id || !session_id) {
      return new Response(
        JSON.stringify({ error: 'Table ID and session ID are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get authentication token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);

    if (getUserError || !user) {
      console.error('Authentication error:', getUserError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create line items from cart
    const line_items = cart_items.map((item: any) => ({
      price_data: {
        currency: 'sgd',
        product_data: {
          name: item.menu_item?.name || 'Menu Item',
          description: item.menu_item?.description || undefined,
        },
        unit_amount: Math.round((item.menu_item?.price_sgd || 0) * 100), // Convert to cents
      },
      quantity: item.quantity || 1,
    }));

    // Create a temporary customer for this checkout
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: {
        user_id: user.id,
        table_id,
        session_id,
      },
    });

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: success_url || `${req.headers.get('origin')}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/order/${session_id}`,
      metadata: {
        table_id,
        session_id,
        user_id: user.id,
      },
    });

    console.log('Checkout session created:', checkoutSession.id);

    return new Response(
      JSON.stringify({ 
        sessionId: checkoutSession.id, 
        url: checkoutSession.url 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        details: 'Check function logs for more information'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});