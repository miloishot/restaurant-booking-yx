/*
# Add Payment Status to Orders Table

1. Schema Updates
  - Add payment_status column to orders table
  - Update orders_status_check constraint to include 'paid' status
  - Add function to safely update order status

2. Changes
  - Add payment_status column with values: 'paid', 'not_paid'
  - Add RPC function for safely updating order status
*/

-- Add payment_status column to orders table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text DEFAULT 'not_paid';
  END IF;
END $$;

-- Update orders_status_check constraint to include 'paid' status if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  END IF;
  
  ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'served'::text, 'paid'::text, 'completed'::text, 'cancelled'::text]));
END $$;

-- Create function to safely update order status
CREATE OR REPLACE FUNCTION update_order_status(p_order_id uuid, p_status text)
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET 
    status = p_status,
    updated_at = NOW()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;