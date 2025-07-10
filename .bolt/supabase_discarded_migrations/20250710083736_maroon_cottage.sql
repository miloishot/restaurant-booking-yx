/*
  # Printer Configuration Table

  This migration creates a table for storing printer configurations for restaurants,
  enabling QR code and receipt printing functionality.

  1. New Table
    - `printer_configs` - Stores printer connection details and settings
      - Supports network, USB, and Bluetooth printer types
      - Tracks default printer settings
      - Links printers to specific restaurants

  2. Security
    - Enables Row Level Security (RLS)
    - Adds policies for restaurant staff access
    - Creates proper indexes for performance
*/

-- Create printer_configs table if it doesn't exist
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

-- Add comments for documentation
COMMENT ON TABLE printer_configs IS 'Printer configurations for restaurant QR code and receipt printing';
COMMENT ON COLUMN printer_configs.printer_type IS 'Type of printer connection: network, usb, or bluetooth';
COMMENT ON COLUMN printer_configs.ip_address IS 'IP address for network printers';
COMMENT ON COLUMN printer_configs.port IS 'Port number for network printers (default: 9100)';
COMMENT ON COLUMN printer_configs.is_default IS 'Whether this is the default printer for the restaurant';
COMMENT ON COLUMN printer_configs.is_active IS 'Whether this printer is currently active and available for use';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_printer_configs_restaurant_id ON printer_configs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_printer_configs_default ON printer_configs(restaurant_id, is_default) WHERE is_default = true;

-- Enable RLS on the table
ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_printer_configs_updated_at'
  ) THEN
    CREATE TRIGGER update_printer_configs_updated_at
      BEFORE UPDATE ON printer_configs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create RLS policy for restaurant staff (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Restaurant staff can manage printer configs'
  ) THEN
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
  END IF;
END $$;