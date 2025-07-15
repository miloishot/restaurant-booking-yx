/*
  # Add Stripe columns to menu_items table

  1. Changes
     - Add stripe_product_id column to menu_items table
     - Add stripe_price_id column to menu_items table
  
  2. Purpose
     - Enable integration with Stripe for online payments
     - Store references to Stripe products and prices for menu items
*/

-- Add stripe_product_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'stripe_product_id'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN stripe_product_id text;
  END IF;
END $$;

-- Add stripe_price_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'menu_items' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN stripe_price_id text;
  END IF;
END $$;