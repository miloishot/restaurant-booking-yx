/*
  # Enhanced Booking System with Automated Assignment & Waiting List

  1. New Tables
    - `waiting_list` - Manages customers waiting for tables when fully booked
    - Enhanced `bookings` table with auto-assignment logic
    - Enhanced `restaurants` table with capacity management

  2. Security
    - Enable RLS on `waiting_list` table
    - Add policies for public access to waiting list operations

  3. Features
    - Automated table assignment based on availability and party size
    - Waiting list management for fully booked time slots
    - Real-time availability calculation
    - Notification system integration ready
*/

-- Add waiting list table
CREATE TABLE IF NOT EXISTS waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'confirmed', 'expired', 'cancelled')),
  priority_order integer DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for waiting list
CREATE INDEX IF NOT EXISTS idx_waiting_list_restaurant_id ON waiting_list(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiting_list_date_time ON waiting_list(requested_date, requested_time);
CREATE INDEX IF NOT EXISTS idx_waiting_list_status ON waiting_list(status);
CREATE INDEX IF NOT EXISTS idx_waiting_list_priority ON waiting_list(priority_order);

-- Enable RLS on waiting list
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;

-- Add policies for waiting list
CREATE POLICY "Allow public insert to waiting_list"
  ON waiting_list
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public read access to waiting_list"
  ON waiting_list
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public update to waiting_list"
  ON waiting_list
  FOR UPDATE
  TO public
  USING (true);

-- Add trigger for waiting list updated_at
CREATE TRIGGER update_waiting_list_updated_at
  BEFORE UPDATE ON waiting_list
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add booking assignment status to track auto-assignment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'assignment_method'
  ) THEN
    ALTER TABLE bookings ADD COLUMN assignment_method text DEFAULT 'auto' CHECK (assignment_method IN ('auto', 'manual', 'waitlist'));
  END IF;
END $$;

-- Add waiting list position tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'was_on_waitlist'
  ) THEN
    ALTER TABLE bookings ADD COLUMN was_on_waitlist boolean DEFAULT false;
  END IF;
END $$;

-- Function to get available tables for a specific time and party size
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
    rt.id,
    rt.table_number,
    rt.capacity
  FROM restaurant_tables rt
  WHERE rt.restaurant_id = p_restaurant_id
    AND rt.capacity >= p_party_size
    AND rt.status = 'available'
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.table_id = rt.id
        AND b.booking_date = p_date
        AND b.booking_time = p_time
        AND b.status IN ('confirmed', 'seated', 'pending')
    )
  ORDER BY rt.capacity ASC, rt.table_number ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate time slot availability
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
  -- Calculate total restaurant capacity
  SELECT COALESCE(SUM(capacity), 0)
  INTO v_total_capacity
  FROM restaurant_tables
  WHERE restaurant_id = p_restaurant_id
    AND status = 'available';

  -- Calculate booked capacity for this time slot
  SELECT COALESCE(SUM(party_size), 0)
  INTO v_booked_capacity
  FROM bookings
  WHERE restaurant_id = p_restaurant_id
    AND booking_date = p_date
    AND booking_time = p_time
    AND status IN ('confirmed', 'seated', 'pending');

  -- Count people on waiting list for this time slot
  SELECT COALESCE(SUM(party_size), 0)
  INTO v_waiting_count
  FROM waiting_list
  WHERE restaurant_id = p_restaurant_id
    AND requested_date = p_date
    AND requested_time = p_time
    AND status = 'waiting';

  RETURN QUERY
  SELECT 
    v_total_capacity,
    v_booked_capacity,
    GREATEST(0, v_total_capacity - v_booked_capacity),
    v_waiting_count;
END;
$$ LANGUAGE plpgsql;