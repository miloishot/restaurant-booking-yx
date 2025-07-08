/*
  # Printer Configuration Table Migration

  1. New Table
    - `printer_configs` - Stores printer configuration for restaurants
      - Includes printer type, network settings, and status
      - Links to restaurants via `restaurant_id`
      - Supports multiple printers per restaurant
      - Tracks default printer for each restaurant

  2. Security
    - Enable RLS on the table
    - Add policies for restaurant staff access
    - Secure printer configuration management

  3. Features
    - Support for network printers (IP address and port)
    - Default printer designation
    - Active/inactive status tracking
*/

-- Create printer_configs table
CREATE TABLE IF NOT EXISTS printer_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  printer_name text NOT NULL,
  printer_type text NOT NULL CHECK (printer_type IN ('network', 'usb', 'bluetooth')),
  ip_address text,
  port integer,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_printer_configs_restaurant_id ON printer_configs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_printer_configs_default ON printer_configs(restaurant_id, is_default) WHERE is_default = true;

-- Enable RLS
ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_printer_configs_updated_at
  BEFORE UPDATE ON printer_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
CREATE POLICY "Restaurant staff can manage printer configs"
  ON printer_configs
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE printer_configs IS 'Printer configurations for restaurant QR code and receipt printing';
COMMENT ON COLUMN printer_configs.printer_type IS 'Type of printer connection: network, usb, or bluetooth';
COMMENT ON COLUMN printer_configs.ip_address IS 'IP address for network printers';
COMMENT ON COLUMN printer_configs.port IS 'Port number for network printers (default: 9100)';
COMMENT ON COLUMN printer_configs.is_default IS 'Whether this is the default printer for the restaurant';
COMMENT ON COLUMN printer_configs.is_active IS 'Whether this printer is currently active and available for use';