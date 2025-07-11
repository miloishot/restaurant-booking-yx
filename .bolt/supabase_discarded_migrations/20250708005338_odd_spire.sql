/*
  # Complete Restaurant Booking System Schema Reset and Implementation

  This migration will:
  1. Drop all existing tables to start fresh
  2. Create all necessary custom types (enums)
  3. Create all tables with proper relationships
  4. Set up Row Level Security (RLS) policies
  5. Create necessary functions and triggers
  6. Insert sample data for testing

  ## New Tables
  - `restaurants` - Restaurant information
  - `restaurant_tables` - Table management with status tracking
  - `customers` - Customer information
  - `bookings` - Booking management with status tracking
  - `waiting_list` - Waiting list management
  - `restaurant_operating_hours` - Operating hours by day of week

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated access
  - Create helper functions for availability checking

  ## Functions
  - `get_available_tables` - Check table availability for specific time slots
  - `get_time_slot_availability` - Get capacity information for time slots
  - `update_updated_at_column` - Trigger function for automatic timestamp updates
*/

-- Drop all existing tables if they exist (in correct order to handle dependencies)
DROP TABLE IF EXISTS waiting_list CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS restaurant_operating_hours CASCADE;
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS table_status CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS waiting_list_status CASCADE;
DROP TYPE IF EXISTS assignment_method CASCADE;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_available_tables CASCADE;
DROP FUNCTION IF EXISTS get_time_slot_availability CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Create custom types (enums)
CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
CREATE TYPE waiting_list_status AS ENUM ('waiting', 'notified', 'confirmed', 'expired', 'cancelled');
CREATE TYPE assignment_method AS ENUM ('auto', 'manual', 'waitlist');

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  email text,
  time_slot_duration_minutes integer DEFAULT 15 CHECK (time_slot_duration_minutes > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create restaurant_tables table
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  status table_status DEFAULT 'available',
  location_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, table_number)
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  booking_time time NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status booking_status DEFAULT 'pending',
  notes text,
  is_walk_in boolean DEFAULT false,
  assignment_method assignment_method DEFAULT 'auto',
  was_on_waitlist boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create waiting_list table
CREATE TABLE IF NOT EXISTS waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status waiting_list_status DEFAULT 'waiting',
  priority_order integer NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create restaurant_operating_hours table
CREATE TABLE IF NOT EXISTS restaurant_operating_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  opening_time time NOT NULL,
  closing_time time NOT NULL,
  is_closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, day_of_week)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant_id ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(status);
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_id ON bookings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings(booking_date, booking_time);
CREATE INDEX IF NOT EXISTS idx_bookings_table_id ON bookings(table_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_waiting_list_restaurant_id ON waiting_list(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_date_time ON waiting_list(requested_date, requested_time);
CREATE INDEX IF NOT EXISTS idx_waiting_list_status ON waiting_list(status);
CREATE INDEX IF NOT EXISTS idx_waiting_list_priority ON waiting_list(priority_order);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_operating_hours_restaurant_id ON restaurant_operating_hours(restaurant_id);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_restaurant_tables_updated_at BEFORE UPDATE ON restaurant_tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_waiting_list_updated_at BEFORE UPDATE ON waiting_list FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_operating_hours_updated_at BEFORE UPDATE ON restaurant_operating_hours FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_operating_hours ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all operations for now - adjust based on your auth requirements)
CREATE POLICY "Allow all operations on restaurants" ON restaurants FOR ALL USING (true);
CREATE POLICY "Allow all operations on restaurant_tables" ON restaurant_tables FOR ALL USING (true);
CREATE POLICY "Allow all operations on customers" ON customers FOR ALL USING (true);
CREATE POLICY "Allow all operations on bookings" ON bookings FOR ALL USING (true);
CREATE POLICY "Allow all operations on waiting_list" ON waiting_list FOR ALL USING (true);
CREATE POLICY "Allow all operations on restaurant_operating_hours" ON restaurant_operating_hours FOR ALL USING (true);

-- Create function to get available tables for a specific time slot
CREATE OR REPLACE FUNCTION get_available_tables(
  p_restaurant_id uuid,
  p_date date,
  p_time time,
  p_party_size integer
)
RETURNS TABLE (
  table_id uuid,
  table_number text,
  capacity integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rt.id as table_id,
    rt.table_number,
    rt.capacity
  FROM restaurant_tables rt
  WHERE rt.restaurant_id = p_restaurant_id
    AND rt.status = 'available'
    AND rt.capacity >= p_party_size
    AND rt.id NOT IN (
      SELECT DISTINCT b.table_id
      FROM bookings b
      WHERE b.restaurant_id = p_restaurant_id
        AND b.booking_date = p_date
        AND b.booking_time = p_time
        AND b.table_id IS NOT NULL
        AND b.status IN ('confirmed', 'seated')
    )
  ORDER BY rt.capacity ASC, rt.table_number ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get time slot availability information
CREATE OR REPLACE FUNCTION get_time_slot_availability(
  p_restaurant_id uuid,
  p_date date,
  p_time time
)
RETURNS TABLE (
  total_capacity integer,
  booked_capacity integer,
  available_capacity integer,
  waiting_count integer
) AS $$
DECLARE
  v_total_capacity integer;
  v_booked_capacity integer;
  v_waiting_count integer;
BEGIN
  -- Get total restaurant capacity
  SELECT COALESCE(SUM(capacity), 0)
  INTO v_total_capacity
  FROM restaurant_tables
  WHERE restaurant_id = p_restaurant_id
    AND status IN ('available', 'occupied', 'reserved');

  -- Get booked capacity for this time slot
  SELECT COALESCE(SUM(b.party_size), 0)
  INTO v_booked_capacity
  FROM bookings b
  WHERE b.restaurant_id = p_restaurant_id
    AND b.booking_date = p_date
    AND b.booking_time = p_time
    AND b.status IN ('confirmed', 'seated');

  -- Get waiting list count for this time slot
  SELECT COALESCE(COUNT(*), 0)
  INTO v_waiting_count
  FROM waiting_list w
  WHERE w.restaurant_id = p_restaurant_id
    AND w.requested_date = p_date
    AND w.requested_time = p_time
    AND w.status = 'waiting';

  RETURN QUERY
  SELECT 
    v_total_capacity as total_capacity,
    v_booked_capacity as booked_capacity,
    (v_total_capacity - v_booked_capacity) as available_capacity,
    v_waiting_count as waiting_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample restaurant data
INSERT INTO restaurants (id, name, address, phone, email, time_slot_duration_minutes) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Bella Vista Restaurant', '123 Main Street, Downtown', '+1 (555) 123-4567', 'info@bellavista.com', 15);

-- Insert sample tables
INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status, location_notes) VALUES
('550e8400-e29b-41d4-a716-446655440000', '1', 2, 'available', 'Window seat'),
('550e8400-e29b-41d4-a716-446655440000', '2', 2, 'available', 'Corner table'),
('550e8400-e29b-41d4-a716-446655440000', '3', 4, 'available', 'Center dining area'),
('550e8400-e29b-41d4-a716-446655440000', '4', 4, 'available', 'Near kitchen'),
('550e8400-e29b-41d4-a716-446655440000', '5', 6, 'available', 'Large family table'),
('550e8400-e29b-41d4-a716-446655440000', '6', 6, 'available', 'Private dining area'),
('550e8400-e29b-41d4-a716-446655440000', '7', 8, 'available', 'Group dining'),
('550e8400-e29b-41d4-a716-446655440000', '8', 2, 'available', 'Bar seating'),
('550e8400-e29b-41d4-a716-446655440000', '9', 4, 'available', 'Patio seating'),
('550e8400-e29b-41d4-a716-446655440000', '10', 2, 'available', 'Quiet corner');

-- Insert sample operating hours (Monday to Sunday)
INSERT INTO restaurant_operating_hours (restaurant_id, day_of_week, opening_time, closing_time, is_closed) VALUES
('550e8400-e29b-41d4-a716-446655440000', 0, '11:00', '22:00', false), -- Sunday
('550e8400-e29b-41d4-a716-446655440000', 1, '11:00', '22:00', false), -- Monday
('550e8400-e29b-41d4-a716-446655440000', 2, '11:00', '22:00', false), -- Tuesday
('550e8400-e29b-41d4-a716-446655440000', 3, '11:00', '22:00', false), -- Wednesday
('550e8400-e29b-41d4-a716-446655440000', 4, '11:00', '23:00', false), -- Thursday
('550e8400-e29b-41d4-a716-446655440000', 5, '11:00', '23:00', false), -- Friday
('550e8400-e29b-41d4-a716-446655440000', 6, '10:00', '23:00', false); -- Saturday

-- Insert sample customers
INSERT INTO customers (name, email, phone) VALUES
('John Smith', 'john.smith@email.com', '+1-555-0101'),
('Sarah Johnson', 'sarah.j@email.com', '+1-555-0102'),
('Michael Brown', 'mike.brown@email.com', '+1-555-0103'),
('Emily Davis', 'emily.davis@email.com', '+1-555-0104'),
('David Wilson', 'david.wilson@email.com', '+1-555-0105');

-- Insert sample bookings for today
INSERT INTO bookings (restaurant_id, table_id, customer_id, booking_date, booking_time, party_size, status, notes, is_walk_in, assignment_method, was_on_waitlist) 
SELECT 
  '550e8400-e29b-41d4-a716-446655440000',
  (SELECT id FROM restaurant_tables WHERE table_number = '1' LIMIT 1),
  (SELECT id FROM customers WHERE name = 'John Smith' LIMIT 1),
  CURRENT_DATE,
  '18:00',
  2,
  'confirmed',
  'Anniversary dinner',
  false,
  'auto',
  false
WHERE EXISTS (SELECT 1 FROM restaurant_tables WHERE table_number = '1')
  AND EXISTS (SELECT 1 FROM customers WHERE name = 'John Smith');

INSERT INTO bookings (restaurant_id, table_id, customer_id, booking_date, booking_time, party_size, status, notes, is_walk_in, assignment_method, was_on_waitlist) 
SELECT 
  '550e8400-e29b-41d4-a716-446655440000',
  (SELECT id FROM restaurant_tables WHERE table_number = '3' LIMIT 1),
  (SELECT id FROM customers WHERE name = 'Sarah Johnson' LIMIT 1),
  CURRENT_DATE,
  '19:00',
  4,
  'pending',
  'Birthday celebration',
  false,
  'auto',
  false
WHERE EXISTS (SELECT 1 FROM restaurant_tables WHERE table_number = '3')
  AND EXISTS (SELECT 1 FROM customers WHERE name = 'Sarah Johnson');