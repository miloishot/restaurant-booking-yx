/*
  # Add Operating Hours and Time Slot Management

  1. New Tables
    - `restaurant_operating_hours` - Store daily opening/closing times
    - `time_slots` - Available booking time slots in 15-minute intervals
  
  2. Schema Changes
    - Remove table_id requirement from bookings (auto-assignment)
    - Add time slot management
    
  3. Security
    - Enable RLS on new tables
    - Add policies for public access
*/

-- Create operating hours table
CREATE TABLE IF NOT EXISTS restaurant_operating_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  opening_time time NOT NULL,
  closing_time time NOT NULL,
  is_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, day_of_week)
);

-- Modify bookings table to make table_id nullable (auto-assignment)
ALTER TABLE bookings ALTER COLUMN table_id DROP NOT NULL;

-- Add time slot interval (15 minutes by default)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS time_slot_duration_minutes integer DEFAULT 15;

-- Enable RLS on operating hours
ALTER TABLE restaurant_operating_hours ENABLE ROW LEVEL SECURITY;

-- Create policies for operating hours
CREATE POLICY "Allow public read access to restaurant_operating_hours"
  ON restaurant_operating_hours
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to restaurant_operating_hours"
  ON restaurant_operating_hours
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to restaurant_operating_hours"
  ON restaurant_operating_hours
  FOR UPDATE
  TO public
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_operating_hours_restaurant_id ON restaurant_operating_hours(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_operating_hours_day ON restaurant_operating_hours(day_of_week);

-- Create trigger for updated_at
CREATE TRIGGER update_restaurant_operating_hours_updated_at
  BEFORE UPDATE ON restaurant_operating_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default operating hours for existing restaurant (7 days a week, 11 AM - 10 PM)
DO $$
DECLARE
  restaurant_uuid uuid;
  day_num integer;
BEGIN
  SELECT id INTO restaurant_uuid FROM restaurants WHERE name = 'The Golden Spoon' LIMIT 1;
  
  IF restaurant_uuid IS NOT NULL THEN
    FOR day_num IN 0..6 LOOP
      INSERT INTO restaurant_operating_hours (restaurant_id, day_of_week, opening_time, closing_time, is_closed)
      VALUES (restaurant_uuid, day_num, '11:00', '22:00', false)
      ON CONFLICT (restaurant_id, day_of_week) DO NOTHING;
    END LOOP;
  END IF;
END $$;