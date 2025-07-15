/*
  # Add Stripe API keys to restaurants table

  1. Changes
    - Add `stripe_publishable_key` column to restaurants table
    - Add `stripe_secret_key` column to restaurants table
    
  2. Security
    - Ensure only restaurant owners can access these sensitive fields
*/

-- Add Stripe API key columns to restaurants table
ALTER TABLE IF EXISTS public.restaurants
ADD COLUMN IF NOT EXISTS stripe_publishable_key text,
ADD COLUMN IF NOT EXISTS stripe_secret_key text;

-- Create or update RLS policy to ensure only owners can view/update Stripe keys
DO $$ 
BEGIN
  -- Drop the policy if it exists
  BEGIN
    DROP POLICY IF EXISTS restaurants_owner_stripe_keys ON public.restaurants;
  EXCEPTION
    WHEN undefined_object THEN
      -- Policy doesn't exist, so nothing to drop
  END;
  
  -- Create the policy
  CREATE POLICY restaurants_owner_stripe_keys ON public.restaurants
    USING (uid() = owner_id)
    WITH CHECK (uid() = owner_id);
END $$;

-- Add comment to explain the sensitive nature of these columns
COMMENT ON COLUMN public.restaurants.stripe_publishable_key IS 'Stripe publishable key for the restaurant';
COMMENT ON COLUMN public.restaurants.stripe_secret_key IS 'Stripe secret key for the restaurant (sensitive)';