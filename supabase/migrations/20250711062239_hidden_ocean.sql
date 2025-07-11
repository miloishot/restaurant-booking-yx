/*
  # Create restaurant closed dates and custom hours tables

  1. New Tables
    - `restaurant_closed_dates`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key)
      - `closed_date` (date)
      - `reason` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `restaurant_custom_hours`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key)
      - `date` (date)
      - `opening_time` (time)
      - `closing_time` (time)
      - `is_closed` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for restaurant staff to manage their data
*/

-- Create restaurant_closed_dates table
CREATE TABLE IF NOT EXISTS restaurant_closed_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  closed_date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, closed_date)
);

-- Create restaurant_custom_hours table
CREATE TABLE IF NOT EXISTS restaurant_custom_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date date NOT NULL,
  opening_time time NOT NULL,
  closing_time time NOT NULL,
  is_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, date)
);

-- Enable RLS
ALTER TABLE restaurant_closed_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_custom_hours ENABLE ROW LEVEL SECURITY;

-- Add policies for restaurant_closed_dates
CREATE POLICY "Restaurant staff can manage closed dates"
  ON restaurant_closed_dates
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

-- Add policies for restaurant_custom_hours
CREATE POLICY "Restaurant staff can manage custom hours"
  ON restaurant_custom_hours
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_closed_dates_restaurant_date 
  ON restaurant_closed_dates(restaurant_id, closed_date);

CREATE INDEX IF NOT EXISTS idx_custom_hours_restaurant_date 
  ON restaurant_custom_hours(restaurant_id, date);

-- Add triggers for updated_at
CREATE TRIGGER update_restaurant_closed_dates_updated_at
  BEFORE UPDATE ON restaurant_closed_dates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_custom_hours_updated_at
  BEFORE UPDATE ON restaurant_custom_hours
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();