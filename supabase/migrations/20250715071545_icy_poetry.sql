/*
  # Add Stripe API keys to restaurants table
  
  1. Changes
    - Add `stripe_publishable_key` column to restaurants table
    - Add `stripe_secret_key` column to restaurants table
    
  2. Security
    - Add RLS policy to ensure only restaurant owners can view and update their Stripe API keys
*/

-- Add Stripe API key columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS stripe_publishable_key text,
ADD COLUMN IF NOT EXISTS stripe_secret_key text;

-- Create policy to ensure only restaurant owners can view and update their Stripe API keys
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'restaurants' AND policyname = 'restaurants_owner_stripe_keys'
  ) THEN
    CREATE POLICY restaurants_owner_stripe_keys ON public.restaurants
      USING (auth.uid() = owner_id)
      WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

COMMENT ON COLUMN public.restaurants.stripe_publishable_key IS 'Publishable key for Stripe API integration';
COMMENT ON COLUMN public.restaurants.stripe_secret_key IS 'Secret key for Stripe API integration (should ideally be stored in environment variables)';