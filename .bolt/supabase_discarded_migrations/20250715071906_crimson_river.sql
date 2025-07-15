```sql
-- Add stripe_publishable_key and stripe_secret_key to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN stripe_publishable_key text,
ADD COLUMN stripe_secret_key text;

-- Add comments for clarity
COMMENT ON COLUMN public.restaurants.stripe_publishable_key IS 'Publishable key for Stripe API integration';
COMMENT ON COLUMN public.restaurants.stripe_secret_key IS 'Secret key for Stripe API integration (should ideally be stored in environment variables)';

-- RLS policy to allow owners to manage their Stripe keys
-- This policy allows the owner to update their own restaurant's Stripe keys
CREATE POLICY "restaurants_owner_stripe_keys" ON public.restaurants
FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
```