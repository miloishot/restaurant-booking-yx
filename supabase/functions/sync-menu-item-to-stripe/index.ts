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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { menu_item_id, restaurant_id, name, description, price_sgd, stripe_product_id, stripe_price_id } = await req.json();

    if (!menu_item_id || !restaurant_id || !name || price_sgd === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required menu item data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch restaurant's Stripe secret key
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('stripe_secret_key')
      .eq('id', restaurant_id)
      .single();

    if (restaurantError || !restaurant || !restaurant.stripe_secret_key) {
      console.error('Stripe secret key not found for restaurant:', restaurant_id, restaurantError);
      return new Response(JSON.stringify({ error: 'Stripe secret key not configured for this restaurant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(restaurant.stripe_secret_key, {
      apiVersion: '2024-06-20', // Use a recent API version
      appInfo: {
        name: 'Bolt Restaurant Integration',
        version: '1.0.0',
      },
    });

    let currentStripeProductId = stripe_product_id;
    let currentStripePriceId = stripe_price_id;

    // 1. Create or update Stripe Product
    let product: Stripe.Product;
    if (currentStripeProductId) {
      try {
        product = await stripe.products.retrieve(currentStripeProductId);
        // Update product details if they've changed
        if (product.name !== name || product.description !== description) {
          product = await stripe.products.update(currentStripeProductId, {
            name: name,
            description: description || undefined,
          });
        }
      } catch (e) {
        // Product not found or error, create a new one
        console.warn(`Stripe Product ${currentStripeProductId} not found or error: ${e.message}. Creating new product.`);
        currentStripeProductId = null; // Force creation of new product
      }
    }

    if (!currentStripeProductId) {
      product = await stripe.products.create({
        name: name,
        description: description || undefined,
        metadata: {
          menu_item_id: menu_item_id,
          restaurant_id: restaurant_id,
        },
      });
      currentStripeProductId = product.id;
    }

    // 2. Create a new Stripe Price (best practice for price changes)
    const price = await stripe.prices.create({
      unit_amount: Math.round(price_sgd * 100), // Convert SGD to cents
      currency: 'sgd',
      // Use one_time pricing for menu items instead of recurring
      product: currentStripeProductId,
      metadata: {
        menu_item_id: menu_item_id,
        restaurant_id: restaurant_id,
      },
    });
    currentStripePriceId = price.id;

    // 3. Update Supabase menu_items table with Stripe IDs
    const { error: updateError } = await supabase
      .from('menu_items')
      .update({
        stripe_product_id: currentStripeProductId,
        stripe_price_id: currentStripePriceId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', menu_item_id);

    if (updateError) {
      console.error('Error updating menu_items table:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update menu item in database' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      stripe_product_id: currentStripeProductId,
      stripe_price_id: currentStripePriceId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-menu-item-to-stripe Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});