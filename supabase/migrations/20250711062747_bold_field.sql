/*
  # Update orders status constraint to include 'completed'

  1. Changes
    - Drop existing orders_status_check constraint
    - Add new constraint that includes 'completed' as valid status
    - This allows orders to be marked as completed in the application

  2. Security
    - No changes to RLS policies needed
    - Maintains existing data integrity
*/

-- Drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the updated constraint that includes 'completed'
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'served'::text, 'paid'::text, 'completed'::text]));