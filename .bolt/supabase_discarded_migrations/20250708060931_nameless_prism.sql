/*
  # Comprehensive RLS Policy Fix

  1. Security Updates
    - Fix all RLS policies for proper database operations
    - Enable table assignment and booking updates
    - Support both public booking and staff management

  2. Policy Changes
    - Drop and recreate all policies to ensure consistency
    - Add proper permissions for all database operations
    - Include helper functions for availability checking
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Public can create bookings" ON bookings;
DROP POLICY IF EXISTS "Public can read bookings by customer" ON bookings;
DROP POLICY IF EXISTS "Restaurant staff can manage their bookings" ON bookings;
DROP POLICY IF EXISTS "Users can view bookings" ON bookings;
DROP POLICY IF EXISTS "Staff can manage restaurant bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON bookings;

DROP POLICY IF EXISTS "Public can read customers for booking" ON customers;
DROP POLICY IF EXISTS "Public can create customer records" ON customers;
DROP POLICY IF EXISTS "Allow customer updates" ON customers;
DROP POLICY IF EXISTS "Public can read customers" ON customers;
DROP POLICY IF EXISTS "Public can create customers" ON customers;
DROP POLICY IF EXISTS "Public can update customers" ON customers;

DROP POLICY IF EXISTS "Public can add to waiting list" ON waiting_list;
DROP POLICY IF EXISTS "Restaurant staff can manage waiting list" ON waiting_list;
DROP POLICY IF EXISTS "Public can read waiting list" ON waiting_list;
DROP POLICY IF EXISTS "Authenticated users can update waiting list" ON waiting_list;

DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON user_profiles;

DROP POLICY IF EXISTS "Public can read operating hours" ON restaurant_operating_hours;
DROP POLICY IF EXISTS "Restaurant staff can manage operating hours" ON restaurant_operating_hours;

-- Drop existing stripe policies
DROP POLICY IF EXISTS "Users can view their own customer data" ON stripe_customers;
DROP POLICY IF EXISTS "Users can view their own subscription data" ON stripe_subscriptions;
DROP POLICY IF EXISTS "Users can view their own order data" ON stripe_orders;

-- =============================================
-- BOOKINGS POLICIES
-- =============================================

-- Allow public to create bookings for restaurants with public slugs
CREATE POLICY "Public can create bookings"
  ON bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Allow public and authenticated users to read all bookings (needed for availability checking)
CREATE POLICY "Public can read bookings"
  ON bookings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow restaurant staff to manage all bookings in their restaurant
CREATE POLICY "Restaurant staff can manage their bookings"
  ON bookings
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

-- Allow authenticated users to update bookings (for table assignment and status changes)
CREATE POLICY "Authenticated users can update bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- CUSTOMERS POLICIES
-- =============================================

-- Allow public to read customers (needed for booking lookup by phone)
CREATE POLICY "Public can read customers"
  ON customers
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow public to create customer records
CREATE POLICY "Public can create customers"
  ON customers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow public to update customer records (needed for booking updates)
CREATE POLICY "Public can update customers"
  ON customers
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- WAITING LIST POLICIES
-- =============================================

-- Allow public to add to waiting list
CREATE POLICY "Public can add to waiting list"
  ON waiting_list
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Allow public to read waiting list (needed for availability checking)
CREATE POLICY "Public can read waiting list"
  ON waiting_list
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow restaurant staff to manage waiting list
CREATE POLICY "Restaurant staff can manage waiting list"
  ON waiting_list
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

-- Allow authenticated users to update waiting list entries
CREATE POLICY "Authenticated users can update waiting list"
  ON waiting_list
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- USER PROFILES POLICIES
-- =============================================

-- Allow users to read their own profile
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to create their own profile
CREATE POLICY "Users can create their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================
-- OPERATING HOURS POLICIES
-- =============================================

-- Allow public to read operating hours for restaurants with public slugs
CREATE POLICY "Public can read operating hours"
  ON restaurant_operating_hours
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Allow restaurant staff to manage operating hours
CREATE POLICY "Restaurant staff can manage operating hours"
  ON restaurant_operating_hours
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

-- =============================================
-- STRIPE TABLES POLICIES
-- =============================================

-- Recreate stripe policies (drop first, then create)
CREATE POLICY "Users can view their own customer data"
  ON stripe_customers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Users can view their own subscription data"
  ON stripe_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers 
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    ) AND deleted_at IS NULL
  );

CREATE POLICY "Users can view their own order data"
  ON stripe_orders
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers 
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    ) AND deleted_at IS NULL
  );

-- =============================================
-- ADDITIONAL HELPER FUNCTIONS
-- =============================================

-- Create or replace function to check if user can access restaurant
CREATE OR REPLACE FUNCTION user_can_access_restaurant(restaurant_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if user is the owner
  IF EXISTS (
    SELECT 1 FROM restaurants 
    WHERE id = restaurant_id AND owner_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is staff member
  IF EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND restaurant_id = user_can_access_restaurant.restaurant_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to get available tables (enhanced version)
CREATE OR REPLACE FUNCTION get_available_tables(
  p_restaurant_id uuid,
  p_date date,
  p_time time,
  p_party_size integer
)
RETURNS TABLE(
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
    AND rt.capacity >= p_party_size
    AND rt.status = 'available'
    AND rt.id NOT IN (
      -- Exclude tables that are already booked for this time slot
      SELECT DISTINCT b.table_id
      FROM bookings b
      WHERE b.restaurant_id = p_restaurant_id
        AND b.booking_date = p_date
        AND b.booking_time = p_time
        AND b.table_id IS NOT NULL
        AND b.status IN ('confirmed', 'seated', 'pending')
    )
  ORDER BY rt.capacity ASC, rt.table_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to get time slot availability
CREATE OR REPLACE FUNCTION get_time_slot_availability(
  p_restaurant_id uuid,
  p_date date,
  p_time time
)
RETURNS TABLE(
  total_capacity integer,
  booked_capacity integer,
  available_capacity integer,
  waiting_count integer
) AS $$
DECLARE
  v_total_capacity integer := 0;
  v_booked_capacity integer := 0;
  v_waiting_count integer := 0;
BEGIN
  -- Get total capacity from all available tables
  SELECT COALESCE(SUM(capacity), 0)
  INTO v_total_capacity
  FROM restaurant_tables
  WHERE restaurant_id = p_restaurant_id
    AND status IN ('available', 'reserved', 'occupied');

  -- Get booked capacity for this time slot
  SELECT COALESCE(SUM(b.party_size), 0)
  INTO v_booked_capacity
  FROM bookings b
  WHERE b.restaurant_id = p_restaurant_id
    AND b.booking_date = p_date
    AND b.booking_time = p_time
    AND b.status IN ('confirmed', 'seated', 'pending');

  -- Get waiting list count for this time slot
  SELECT COUNT(*)
  INTO v_waiting_count
  FROM waiting_list w
  WHERE w.restaurant_id = p_restaurant_id
    AND w.requested_date = p_date
    AND w.requested_time = p_time
    AND w.status = 'waiting';

  RETURN QUERY
  SELECT 
    v_total_capacity,
    v_booked_capacity,
    GREATEST(0, v_total_capacity - v_booked_capacity) as available_capacity,
    v_waiting_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION user_can_access_restaurant(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_available_tables(uuid, date, time, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_time_slot_availability(uuid, date, time) TO anon, authenticated;

-- Add helpful comments
COMMENT ON POLICY "Public can create bookings" ON bookings IS 'Allows public booking creation for restaurants with public booking URLs';
COMMENT ON POLICY "Restaurant staff can manage their bookings" ON bookings IS 'Allows restaurant staff to manage bookings in their assigned restaurant';
COMMENT ON POLICY "Authenticated users can update bookings" ON bookings IS 'Allows table assignment and status updates by authenticated users';

COMMENT ON FUNCTION user_can_access_restaurant(uuid) IS 'Helper function to check if current user can access a specific restaurant';
COMMENT ON FUNCTION get_available_tables(uuid, date, time, integer) IS 'Returns available tables for a specific time slot and party size';
COMMENT ON FUNCTION get_time_slot_availability(uuid, date, time) IS 'Returns capacity and availability information for a specific time slot';