/*
  # Employee Management and Time Tracking System

  1. New Tables
    - `employees`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key)
      - `employee_id` (text, unique per restaurant)
      - `name` (text)
      - `password` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `time_entries`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key)
      - `employee_id` (text, foreign key)
      - `punch_in_time` (timestamp)
      - `punch_out_time` (timestamp, nullable)
      - `total_hours` (numeric, nullable)
      - `date` (date)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for restaurant staff access
*/

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  name text NOT NULL,
  password text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, employee_id)
);

-- Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  punch_in_time timestamptz NOT NULL,
  punch_out_time timestamptz,
  total_hours numeric(5,2),
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  FOREIGN KEY (restaurant_id, employee_id) REFERENCES employees(restaurant_id, employee_id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Create policies for employees
CREATE POLICY "Restaurant staff can manage employees"
  ON employees
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

-- Create policies for time_entries
CREATE POLICY "Restaurant staff can manage time entries"
  ON time_entries
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

-- Create indexes for performance
CREATE INDEX idx_employees_restaurant_id ON employees(restaurant_id);
CREATE INDEX idx_employees_employee_id ON employees(restaurant_id, employee_id);
CREATE INDEX idx_time_entries_restaurant_id ON time_entries(restaurant_id);
CREATE INDEX idx_time_entries_employee_date ON time_entries(restaurant_id, employee_id, date);
CREATE INDEX idx_time_entries_date_range ON time_entries(restaurant_id, date);

-- Create triggers for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate total hours when punching out
CREATE OR REPLACE FUNCTION calculate_total_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.punch_out_time IS NOT NULL AND OLD.punch_out_time IS NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.punch_out_time - NEW.punch_in_time)) / 3600.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_hours_trigger
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_hours();