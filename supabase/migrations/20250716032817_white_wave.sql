/*
  # Add 'cancelled' to orders status check constraint

  1. Changes
    - Adds 'cancelled' as a valid value to the orders_status_check constraint
    - Ensures orders can be properly cancelled without constraint violations
*/

DO $$
BEGIN
  -- Check if the constraint exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_status_check'
  ) THEN
    -- Drop the existing constraint
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
    
    -- Recreate the constraint with 'cancelled' included
    ALTER TABLE orders ADD CONSTRAINT orders_status_check 
      CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'served'::text, 'paid'::text, 'completed'::text, 'cancelled'::text]));
  END IF;
END $$;