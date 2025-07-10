/*
  # Create printer configurations table

  1. New Tables
    - `printer_configs`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key to restaurants)
      - `printer_name` (text, not null)
      - `printer_type` (text, not null, check constraint)
      - `ip_address` (text, nullable)
      - `port` (integer, nullable)
      - `device_id` (text, nullable)
      - `printer_id` (text, nullable)
      - `is_default` (boolean, default false)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `printer_configs` table
    - Add policies for restaurant staff to manage their printer configurations

  3. Indexes
    - Add indexes for restaurant_id and default printer queries
*/

CREATE TABLE IF NOT EXISTS printer_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  printer_name text NOT NULL,
  printer_type text NOT NULL,
  ip_address text,
  port integer,
  device_id text,
  printer_id text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT printer_configs_restaurant_id_fkey 
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  CONSTRAINT printer_configs_printer_type_check 
    CHECK (printer_type = ANY (ARRAY['network'::text, 'usb'::text, 'bluetooth'::text]))
);

-- Enable RLS
ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_printer_configs_restaurant_id 
  ON printer_configs (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_printer_configs_default 
  ON printer_configs (restaurant_id, is_default) 
  WHERE is_default = true;

-- Create policies
CREATE POLICY "Restaurant staff can manage printer configs"
  ON printer_configs
  FOR ALL
  TO authenticated
  USING (
    (restaurant_id IN (
      SELECT user_profiles.restaurant_id
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )) OR 
    (restaurant_id IN (
      SELECT restaurants.id
      FROM restaurants
      WHERE restaurants.owner_id = auth.uid()
    ))
  )
  WITH CHECK (
    (restaurant_id IN (
      SELECT user_profiles.restaurant_id
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )) OR 
    (restaurant_id IN (
      SELECT restaurants.id
      FROM restaurants
      WHERE restaurants.owner_id = auth.uid()
    ))
  );

-- Create trigger for updated_at
CREATE TRIGGER update_printer_configs_updated_at
  BEFORE UPDATE ON printer_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();