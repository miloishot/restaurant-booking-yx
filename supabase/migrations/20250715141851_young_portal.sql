/*
  # Add tax enabled columns to restaurant_tax_settings

  1. New Columns
    - `gst_enabled` (boolean) - Flag to enable/disable GST
    - `service_charge_enabled` (boolean) - Flag to enable/disable service charge
  
  2. Changes
    - Both columns default to TRUE for backward compatibility
    - Update calculate_order_taxes function to respect these flags
*/

-- Add gst_enabled and service_charge_enabled columns
ALTER TABLE restaurant_tax_settings 
ADD COLUMN IF NOT EXISTS gst_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS service_charge_enabled BOOLEAN DEFAULT TRUE;

-- Update the calculate_order_taxes function to respect the enabled flags
CREATE OR REPLACE FUNCTION calculate_order_taxes(
  p_subtotal NUMERIC,
  p_restaurant_id UUID
) RETURNS JSON AS $$
DECLARE
  v_gst_rate NUMERIC;
  v_service_charge_rate NUMERIC;
  v_gst_enabled BOOLEAN;
  v_service_charge_enabled BOOLEAN;
  v_service_charge NUMERIC := 0;
  v_gst NUMERIC := 0;
  v_total NUMERIC;
BEGIN
  -- Get tax settings for the restaurant
  SELECT 
    gst_rate, 
    service_charge_rate,
    gst_enabled,
    service_charge_enabled
  INTO 
    v_gst_rate, 
    v_service_charge_rate,
    v_gst_enabled,
    v_service_charge_enabled
  FROM restaurant_tax_settings
  WHERE restaurant_id = p_restaurant_id;
  
  -- If no settings found, use defaults
  IF v_gst_rate IS NULL THEN
    v_gst_rate := 9;
  END IF;
  
  IF v_service_charge_rate IS NULL THEN
    v_service_charge_rate := 10;
  END IF;
  
  IF v_gst_enabled IS NULL THEN
    v_gst_enabled := TRUE;
  END IF;
  
  IF v_service_charge_enabled IS NULL THEN
    v_service_charge_enabled := TRUE;
  END IF;
  
  -- Calculate service charge if enabled
  IF v_service_charge_enabled THEN
    v_service_charge := (p_subtotal * v_service_charge_rate / 100);
  END IF;
  
  -- Calculate GST if enabled (on subtotal + service charge)
  IF v_gst_enabled THEN
    v_gst := ((p_subtotal + v_service_charge) * v_gst_rate / 100);
  END IF;
  
  -- Calculate total
  v_total := p_subtotal + v_service_charge + v_gst;
  
  -- Return the tax breakdown as JSON
  RETURN json_build_object(
    'subtotal', p_subtotal,
    'service_charge', v_service_charge,
    'service_charge_rate', v_service_charge_rate,
    'gst', v_gst,
    'gst_rate', v_gst_rate,
    'total', v_total,
    'gst_enabled', v_gst_enabled,
    'service_charge_enabled', v_service_charge_enabled
  );
END;
$$ LANGUAGE plpgsql;