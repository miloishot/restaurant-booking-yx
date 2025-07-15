/*
  # Add restaurant tax settings

  1. New Tables
    - `restaurant_tax_settings` - Stores tax configuration for each restaurant
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key to restaurants)
      - `gst_enabled` (boolean)
      - `gst_rate` (numeric)
      - `service_charge_enabled` (boolean)
      - `service_charge_rate` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `restaurant_tax_settings` table
    - Add policy for restaurant owners and managers to manage tax settings
    - Add policy for public to view tax settings
*/

-- Create restaurant_tax_settings table
CREATE TABLE IF NOT EXISTS restaurant_tax_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  gst_enabled boolean DEFAULT true,
  gst_rate numeric(5,2) DEFAULT 9.00,
  service_charge_enabled boolean DEFAULT true,
  service_charge_rate numeric(5,2) DEFAULT 10.00,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- Enable RLS
ALTER TABLE restaurant_tax_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Restaurant staff can manage tax settings"
  ON restaurant_tax_settings
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees
      WHERE employee_id = uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees
      WHERE employee_id = uid() AND is_active = true
    )
  );

CREATE POLICY "Public can view tax settings"
  ON restaurant_tax_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE slug IS NOT NULL
    )
  );

-- Create function to calculate taxes for an order
CREATE OR REPLACE FUNCTION calculate_order_taxes(
  p_subtotal numeric,
  p_restaurant_id uuid
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_tax_settings restaurant_tax_settings%ROWTYPE;
  v_service_charge numeric := 0;
  v_gst numeric := 0;
  v_total numeric := p_subtotal;
BEGIN
  -- Get tax settings for restaurant
  SELECT * INTO v_tax_settings
  FROM restaurant_tax_settings
  WHERE restaurant_id = p_restaurant_id;
  
  -- If no settings found, use defaults
  IF v_tax_settings.id IS NULL THEN
    v_tax_settings.gst_enabled := true;
    v_tax_settings.gst_rate := 9.00;
    v_tax_settings.service_charge_enabled := true;
    v_tax_settings.service_charge_rate := 10.00;
  END IF;
  
  -- Calculate service charge
  IF v_tax_settings.service_charge_enabled THEN
    v_service_charge := ROUND(p_subtotal * (v_tax_settings.service_charge_rate / 100), 2);
    v_total := v_total + v_service_charge;
  END IF;
  
  -- Calculate GST
  IF v_tax_settings.gst_enabled THEN
    v_gst := ROUND(v_total * (v_tax_settings.gst_rate / 100), 2);
    v_total := v_total + v_gst;
  END IF;
  
  -- Return tax breakdown
  RETURN json_build_object(
    'subtotal', p_subtotal,
    'service_charge', v_service_charge,
    'service_charge_rate', v_tax_settings.service_charge_rate,
    'gst', v_gst,
    'gst_rate', v_tax_settings.gst_rate,
    'total', v_total
  );
END;
$$;

-- Create trigger function to update updated_at column
CREATE OR REPLACE FUNCTION update_restaurant_tax_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_restaurant_tax_settings_updated_at
BEFORE UPDATE ON restaurant_tax_settings
FOR EACH ROW
EXECUTE FUNCTION update_restaurant_tax_settings_updated_at();

-- Insert default tax settings for existing restaurants
INSERT INTO restaurant_tax_settings (restaurant_id, gst_enabled, gst_rate, service_charge_enabled, service_charge_rate)
SELECT id, true, 9.00, true, 10.00
FROM restaurants
ON CONFLICT (restaurant_id) DO NOTHING;