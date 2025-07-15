```sql
-- Add stripe_product_id and stripe_price_id to menu_items table
ALTER TABLE public.menu_items
ADD COLUMN stripe_product_id TEXT NULL,
ADD COLUMN stripe_price_id TEXT NULL;

-- Create a function to call the Edge Function for Stripe sync
CREATE OR REPLACE FUNCTION public.sync_menu_item_to_stripe_function()
RETURNS TRIGGER AS $$
DECLARE
  -- Get the restaurant's Stripe secret key
  stripe_secret_key TEXT;
  stripe_api_url TEXT;
  response_status INT;
  response_body TEXT;
BEGIN
  -- Fetch the restaurant's Stripe secret key and API URL
  SELECT r.stripe_secret_key, r.print_api_url -- Reusing print_api_url as a placeholder for functions URL if needed, though direct call is better
  INTO stripe_secret_key, stripe_api_url
  FROM public.restaurants r
  WHERE r.id = NEW.restaurant_id;

  IF stripe_secret_key IS NULL THEN
    RAISE WARNING 'Stripe secret key not configured for restaurant_id %', NEW.restaurant_id;
    RETURN NEW;
  END IF;

  -- Call the Edge Function
  SELECT
    status,
    content
  FROM
    net.http_post(
      url := 'http://localhost:54321/functions/v1/sync-menu-item-to-stripe', -- Adjust to your Supabase Functions URL in production
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || (SELECT auth.jwt()) || '"}',
      body := json_build_object(
        'menu_item_id', NEW.id,
        'restaurant_id', NEW.restaurant_id,
        'name', NEW.name,
        'description', NEW.description,
        'price_sgd', NEW.price_sgd,
        'stripe_product_id', OLD.stripe_product_id, -- Pass existing product ID if updating
        'stripe_price_id', OLD.stripe_price_id -- Pass existing price ID if updating
      )::jsonb
    ) AS r(status int, content text)
  INTO response_status, response_body;

  IF response_status != 200 THEN
    RAISE WARNING 'Failed to sync menu item % to Stripe. Status: %, Body: %', NEW.id, response_status, response_body;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the function after insert or update on menu_items
CREATE TRIGGER sync_menu_item_to_stripe_trigger
AFTER INSERT OR UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.sync_menu_item_to_stripe_function();

-- Optional: Add indexes for the new columns if they will be frequently queried
CREATE INDEX idx_menu_items_stripe_product_id ON public.menu_items (stripe_product_id);
CREATE INDEX idx_menu_items_stripe_price_id ON public.menu_items (stripe_price_id);
```