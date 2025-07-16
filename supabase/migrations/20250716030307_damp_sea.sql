/*
  # Add payment_status to orders table

  1. Schema Changes
    - Add payment_status column to orders table
    - Add check constraint for valid payment status values
*/

-- Add payment_status column to orders table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text DEFAULT 'not_paid';
    
    -- Add check constraint for valid payment status values
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IN ('not_paid', 'paid', 'refunded', 'failed'));
  END IF;
END $$;