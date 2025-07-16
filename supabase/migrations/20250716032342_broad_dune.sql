/*
  # Add Update Order Status Function

  1. New Functions
    - `update_order_status`: Safely updates an order's status with validation
  
  2. Purpose
    - Provides a safe way to update order status
    - Ensures only valid status values are used
    - Prevents constraint violation errors
*/

-- Create function to safely update order status
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate the status is one of the allowed values
  IF p_status NOT IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status value: %. Must be one of: pending, confirmed, preparing, ready, served, paid, completed, cancelled', p_status;
  END IF;

  -- Update the order status
  UPDATE public.orders
  SET 
    status = p_status,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Return success
  RETURN FOUND;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.update_order_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status TO anon;