import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@latest';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature found in webhook request');
      return new Response('No Stripe signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();
    console.log('Received webhook body:', body.substring(0, 200) + '...');

    // verify the webhook signature
    let event: Stripe.Event; 

    try {
      if (!stripeWebhookSecret) {
        console.warn('STRIPE_WEBHOOK_SECRET is not set, skipping signature verification');
        event = JSON.parse(body) as Stripe.Event;
      } else {
        event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
      }
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    console.log(`Webhook event type: ${event.type}`);
    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};
  
  console.log(`Processing Stripe event: ${event.type}`);

  if (!stripeData) {
    console.log('No stripe data in event, skipping');
    return;
  }

  // Handle restaurant order payments
  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;
    
    console.log('Processing checkout.session.completed event:', session.id);
    
    // Check if this is a restaurant order payment (has table_id and session_id in metadata)
    if (session.metadata?.table_id && session.metadata?.session_id) {
      try {
        console.log(`Processing restaurant order payment for table ${session.metadata.table_id}`);
        console.log('Session metadata:', session.metadata);
        
        // Generate order number
        const { data: orderNumber, error: orderNumberError } = await supabase.rpc('generate_order_number');
        
        if (orderNumberError) {
          console.error('Error generating order number:', orderNumberError);
          throw orderNumberError;
        }
        
        // Parse loyalty user IDs from metadata
        let loyaltyUserIds = null;
        try {
          if (session.metadata.loyalty_user_ids) {
            loyaltyUserIds = JSON.parse(session.metadata.loyalty_user_ids);
            console.log('Parsed loyalty user IDs:', loyaltyUserIds);
          }
        } catch (e) {
          console.error('Error parsing loyalty_user_ids:', e);
          // Continue with null loyaltyUserIds
        }
        
        const discountApplied = session.metadata.discount_applied === 'true';
        const triggeringUserId = session.metadata.triggering_user_id || null;
        const discountAmount = parseFloat(session.metadata.discount_amount || '0');
        
        console.log('Creating order with data:', {
          restaurant_id: session.metadata.restaurant_id,
          session_id: session.metadata.session_id,
          order_number: orderNumber,
          loyalty_user_ids: loyaltyUserIds,
          subtotal_sgd: session.amount_subtotal ? session.amount_subtotal / 100 : 0,
          discount_sgd: discountAmount,
          total_sgd: session.amount_total ? session.amount_total / 100 : 0,
          discount_applied: discountApplied,
          triggering_user_id: triggeringUserId,
          status: 'confirmed'
        });
        
        // Create the order now that payment is confirmed
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            restaurant_id: session.metadata.restaurant_id,
            session_id: session.metadata.session_id,
            order_number: orderNumber,
            loyalty_user_ids: loyaltyUserIds,
            subtotal_sgd: session.amount_subtotal ? session.amount_subtotal / 100 : 0,
            discount_sgd: discountAmount,
            total_sgd: session.amount_total ? session.amount_total / 100 : 0,
            discount_applied: discountApplied,
            triggering_user_id: triggeringUserId,
            status: 'confirmed',
            notes: 'Payment completed via Stripe'
          })
          .select()
          .single();
        
        if (orderError) {
          console.error('Error creating order:', orderError);
          throw orderError;
        }
        
        console.log('Order created successfully:', orderData);
        
        // Create order items from cart items in metadata
        if (session.metadata.cart_items) {
          try {
            const cartItems = JSON.parse(session.metadata.cart_items);
            console.log('Parsed cart items:', cartItems);
            
            // Map cart items to order items
            const orderItems = cartItems.map(item => ({
              order_id: orderData.id,
              menu_item_id: item.menu_item.id,
              quantity: item.quantity,
              unit_price_sgd: item.menu_item.price_sgd,
              total_price_sgd: item.menu_item.price_sgd * item.quantity,
              special_instructions: item.special_instructions || null
            }));
            
            // Insert order items
            const { error: itemsError } = await supabase
              .from('order_items')
              .insert(orderItems);
              
            if (itemsError) {
              console.error('Error creating order items from cart:', itemsError);
            } else {
              console.log('Order items created successfully from cart');
            }
          } catch (e) {
            console.error('Error processing cart items:', e);
          }
        } else {
          // Fetch line items from Stripe if cart_items not in metadata
          try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
            console.log('Fetched line items from Stripe:', lineItems.data);
            
            if (lineItems && lineItems.data && lineItems.data.length > 0) {
              // Get product details for each line item
              const orderItems = [];
              
              for (const item of lineItems.data) {
                if (item.price?.product) {
                  // Get product details
                  const productId = typeof item.price.product === 'string' 
                    ? item.price.product 
                    : item.price.product.id;
                    
                  // Find menu item by Stripe product ID
                  const { data: menuItem } = await supabase
                    .from('menu_items')
                    .select('id')
                    .eq('stripe_product_id', productId)
                    .maybeSingle();
                    
                  if (menuItem) {
                    orderItems.push({
                      order_id: orderData.id,
                      menu_item_id: menuItem.id,
                      quantity: item.quantity || 1,
                      unit_price_sgd: (item.price?.unit_amount || 0) / 100,
                      total_price_sgd: ((item.price?.unit_amount || 0) * (item.quantity || 1)) / 100,
                      special_instructions: null
                    });
                  }
                }
              }
              
              if (orderItems.length > 0) {
                const { error: itemsError } = await supabase
                  .from('order_items')
                  .insert(orderItems);
                  
                if (itemsError) {
                  console.error('Error creating order items from Stripe:', itemsError);
                } else {
                  console.log('Order items created successfully from Stripe line items');
                }
              }
            }
          } catch (lineItemError) {
            console.error('Error fetching line items from Stripe:', lineItemError);
          }
        }
        
        console.log(`Successfully created order for table ${session.metadata.table_id}, session ${session.metadata.session_id}`);
        
        // Update loyalty user spending if discount was applied
        if (discountApplied && triggeringUserId) {
          await supabase.rpc('update_loyalty_spending', {
            p_restaurant_id: session.metadata.restaurant_id,
            p_user_id: triggeringUserId,
            p_amount: session.amount_total ? session.amount_total / 100 : 0
          });
          console.log('Updated loyalty spending for user:', triggeringUserId);
        }
        
        return;
      } catch (error) {
        console.error('Error processing restaurant order payment:', error);
        return;
      }
    } else {
      console.log('Not a restaurant order payment - missing table_id or session_id in metadata');
    }
  }

  // Handle subscription events
  if (event.type === 'customer.subscription.created' || 
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted') {
    const subscription = stripeData as Stripe.Subscription;
    const customerId = subscription.customer as string;
    
    console.log(`Processing subscription event for customer: ${customerId}`);
    await syncCustomerFromStripe(customerId);
  }
}

async function syncCustomerFromStripe(customerId: string) {
  console.log(`Syncing customer data from Stripe for customer: ${customerId}`);
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    if (!subscriptions.data || subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data?.[0];
    if (!subscription) {
      console.warn(`No subscription data found for customer: ${customerId}`);
      return;
    }

    // store subscription state
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start || null,
        current_period_end: subscription.current_period_end || null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}