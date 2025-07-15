/*
  # Update tax calculation function

  1. Changes
    - Modify calculate_order_taxes function to handle exclusive tax calculation
    - Ensure service charge and GST are calculated correctly
    - Return total that includes both service charge and GST
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS calculate_order_taxes;

-- Create the updated function with exclusive tax calculation
CREATE OR REPLACE FUNCTION calculate_order_taxes(
  p_subtotal NUMERIC,
  p_restaurant_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_service_charge_rate NUMERIC;
  v_gst_rate NUMERIC;
  v_service_charge NUMERIC;
  v_gst NUMERIC;
  v_total NUMERIC;
  v_result JSON;
BEGIN
  -- Get tax rates for the restaurant
  SELECT 
    COALESCE(service_charge_rate, 10.00),
    COALESCE(gst_rate, 9.00)
  INTO 
    v_service_charge_rate,
    v_gst_rate
  FROM restaurant_tax_settings
  WHERE restaurant_id = p_restaurant_id;
  
  -- If no tax settings found, use default rates
  IF v_service_charge_rate IS NULL THEN
    v_service_charge_rate := 10.00;
  END IF;
  
  IF v_gst_rate IS NULL THEN
    v_gst_rate := 9.00;
  END IF;
  
  -- Calculate service charge (exclusive)
  v_service_charge := ROUND((p_subtotal * v_service_charge_rate / 100)::NUMERIC, 2);
  
  -- Calculate GST on subtotal + service charge (exclusive)
  v_gst := ROUND(((p_subtotal + v_service_charge) * v_gst_rate / 100)::NUMERIC, 2);
  
  -- Calculate total (subtotal + service charge + GST)
  v_total := p_subtotal + v_service_charge + v_gst;
  
  -- Construct result JSON
  v_result := json_build_object(
    'subtotal', p_subtotal,
    'service_charge', v_service_charge,
    'service_charge_rate', v_service_charge_rate,
    'gst', v_gst,
    'gst_rate', v_gst_rate,
    'total', v_total
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;