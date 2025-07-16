/*
  # Add 'declined' status to orders status check constraint

  1. Changes
    - Adds 'declined' as a valid value for the orders status check constraint
    - This allows staff to mark orders as declined, which is different from cancelled

  2. Purpose
    - Enables staff to decline orders that can't be fulfilled
    - Allows for proper tracking of declined orders in the system
    - Ensures declined orders are displayed correctly in the customer bill view
*/

-- Update the check constraint to include 'declined' status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'served'::text, 'paid'::text, 'completed'::text, 'cancelled'::text, 'declined'::text]));