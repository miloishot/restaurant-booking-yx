/*
  # Add restaurant tax settings

  1. New Tables
    - `restaurant_tax_settings` - Stores tax configuration for each restaurant
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key to restaurants)
      - `gst_rate` (numeric, GST percentage)
      - `service_charge_rate` (numeric, service charge percentage)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. New Functions
    - `calculate_order_taxes` - Calculates taxes based on restaurant settings
*/

-- Create restaurant_tax_settings table
CREATE TABLE IF NOT EXISTS restaurant_tax_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  gst_rate numeric(5,2) NOT NULL DEFAULT 9.00,
  service_charge_rate numeric(5,2) NOT NULL DEFAULT 10.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT restaurant_tax_settings_restaurant_id_key UNIQUE (restaurant_id),
  CONSTRAINT restaurant_tax_settings_gst_rate_check CHECK (gst_rate >= 0),
  CONSTRAINT restaurant_tax_settings_service_charge_rate_check CHECK (service_charge_rate >= 0)
);

-- Enable RLS
ALTER TABLE restaurant_tax_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public can read tax settings" 
  ON restaurant_tax_settings
  FOR SELECT 
  TO public
  USING (true);

CREATE POLICY "Restaurant staff can manage tax settings" 
  ON restaurant_tax_settings
  FOR ALL 
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE employee_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE employee_id = auth.uid() AND is_active = true
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_restaurant_tax_settings_updated_at
  BEFORE UPDATE ON restaurant_tax_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default tax settings for existing restaurants
INSERT INTO restaurant_tax_settings (restaurant_id, gst_rate, service_charge_rate)
SELECT id, 9.00, 10.00
FROM restaurants
ON CONFLICT (restaurant_id) DO NOTHING;

-- Create calculate_order_taxes function
CREATE OR REPLACE FUNCTION calculate_order_taxes(
  p_subtotal numeric,
  p_restaurant_id uuid
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_gst_rate numeric;
  v_service_charge_rate numeric;
  v_service_charge numeric;
  v_gst numeric;
  v_total numeric;
BEGIN
  -- Get tax rates for the restaurant
  SELECT gst_rate, service_charge_rate
  INTO v_gst_rate, v_service_charge_rate
  FROM restaurant_tax_settings
  WHERE restaurant_id = p_restaurant_id;
  
  -- If no tax settings found, use defaults
  IF v_gst_rate IS NULL THEN
    v_gst_rate := 9.00;
  END IF;
  
  IF v_service_charge_rate IS NULL THEN
    v_service_charge_rate := 10.00;
  END IF;
  
  -- Calculate service charge
  v_service_charge := (p_subtotal * v_service_charge_rate / 100);
  
  -- Calculate GST (on subtotal + service charge)
  v_gst := ((p_subtotal + v_service_charge) * v_gst_rate / 100);
  
  -- Calculate total
  v_total := p_subtotal + v_service_charge + v_gst;
  
  -- Return JSON with all values
  RETURN json_build_object(
    'subtotal', p_subtotal,
    'service_charge', v_service_charge,
    'service_charge_rate', v_service_charge_rate,
    'gst', v_gst,
    'gst_rate', v_gst_rate,
    'total', v_total
  );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION calculate_order_taxes TO public;