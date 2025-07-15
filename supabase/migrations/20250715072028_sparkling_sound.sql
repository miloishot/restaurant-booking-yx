/*
  # Add Stripe API keys to restaurants table
  
  1. New Columns
    - `stripe_publishable_key` (text, nullable) - Publishable key for Stripe API integration
    - `stripe_secret_key` (text, nullable) - Secret key for Stripe API integration (should ideally be stored in environment variables)
    
  2. Security
    - Add RLS policy to ensure only restaurant owners can access their own Stripe keys
*/

-- Add Stripe API key columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT COMMENT 'Publishable key for Stripe API integration',
ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT COMMENT 'Secret key for Stripe API integration (should ideally be stored in environment variables)';

-- Create policy to ensure only restaurant owners can access their own Stripe keys
CREATE POLICY restaurants_owner_stripe_keys ON public.restaurants
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);