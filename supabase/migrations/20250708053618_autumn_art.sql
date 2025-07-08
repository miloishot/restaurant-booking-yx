/*
  # Create test restaurant and sample data

  1. New Data
    - Test restaurant with sample configuration
    - Sample tables with various capacities
    - Operating hours for all days
    - Test customers and bookings
    - Helper functions for development

  2. Security
    - Update RLS policies for public booking access
    - Grant permissions for booking functions
    - Enable public access to restaurant data via slug

  3. Development Helpers
    - Auto-link first user to test restaurant
    - Functions to reset and manage test data
    - Test subscription setup for full feature access
*/

-- Create test restaurant (will be linked to first user that signs up)
INSERT INTO restaurants (
  id,
  name,
  slug,
  address,
  phone,
  email,
  time_slot_duration_minutes
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test Restaurant & Grill',
  'test-restaurant',
  '123 Test Street, Demo City, DC 12345',
  '+1 (555) 999-0000',
  'info@testrestaurant.com',
  15
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  updated_at = now();

-- Create test tables
INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status, location_notes) VALUES
('11111111-1111-1111-1111-111111111111', '1', 2, 'available', 'Window seat with city view'),
('11111111-1111-1111-1111-111111111111', '2', 2, 'available', 'Cozy corner table'),
('11111111-1111-1111-1111-111111111111', '3', 4, 'available', 'Perfect for families'),
('11111111-1111-1111-1111-111111111111', '4', 4, 'available', 'Center dining area'),
('11111111-1111-1111-1111-111111111111', '5', 6, 'available', 'Large group table'),
('11111111-1111-1111-1111-111111111111', '6', 6, 'available', 'Private dining section'),
('11111111-1111-1111-1111-111111111111', '7', 8, 'available', 'Party table'),
('11111111-1111-1111-1111-111111111111', '8', 2, 'available', 'Bar seating'),
('11111111-1111-1111-1111-111111111111', '9', 4, 'available', 'Outdoor patio'),
('11111111-1111-1111-1111-111111111111', '10', 2, 'available', 'Intimate booth')
ON CONFLICT (restaurant_id, table_number) DO NOTHING;

-- Create operating hours
INSERT INTO restaurant_operating_hours (restaurant_id, day_of_week, opening_time, closing_time, is_closed) VALUES
('11111111-1111-1111-1111-111111111111', 0, '10:00', '22:00', false), -- Sunday
('11111111-1111-1111-1111-111111111111', 1, '11:00', '22:00', false), -- Monday
('11111111-1111-1111-1111-111111111111', 2, '11:00', '22:00', false), -- Tuesday
('11111111-1111-1111-1111-111111111111', 3, '11:00', '22:00', false), -- Wednesday
('11111111-1111-1111-1111-111111111111', 4, '11:00', '23:00', false), -- Thursday
('11111111-1111-1111-1111-111111111111', 5, '11:00', '23:00', false), -- Friday
('11111111-1111-1111-1111-111111111111', 6, '10:00', '23:00', false)  -- Saturday
ON CONFLICT (restaurant_id, day_of_week) DO NOTHING;

-- Create test customers
INSERT INTO customers (id, name, email, phone) VALUES
('22222222-2222-2222-2222-222222222221', 'Alice Johnson', 'alice@example.com', '+1-555-1001'),
('22222222-2222-2222-2222-222222222222', 'Bob Smith', 'bob@example.com', '+1-555-1002'),
('22222222-2222-2222-2222-222222222223', 'Carol Davis', 'carol@example.com', '+1-555-1003'),
('22222222-2222-2222-2222-222222222224', 'David Wilson', 'david@example.com', '+1-555-1004'),
('22222222-2222-2222-2222-222222222225', 'Emma Brown', 'emma@example.com', '+1-555-1005')
ON CONFLICT (phone) DO NOTHING;

-- Create some test bookings for today (only if they don't already exist)
DO $$
DECLARE
  table1_id uuid;
  table3_id uuid;
  table5_id uuid;
BEGIN
  -- Get table IDs
  SELECT id INTO table1_id FROM restaurant_tables WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' AND table_number = '1' LIMIT 1;
  SELECT id INTO table3_id FROM restaurant_tables WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' AND table_number = '3' LIMIT 1;
  SELECT id INTO table5_id FROM restaurant_tables WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' AND table_number = '5' LIMIT 1;

  -- Insert bookings only if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM bookings 
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' 
    AND customer_id = '22222222-2222-2222-2222-222222222221'
    AND booking_date = CURRENT_DATE
    AND booking_time = '18:00'
  ) THEN
    INSERT INTO bookings (
      restaurant_id, 
      table_id, 
      customer_id, 
      booking_date, 
      booking_time, 
      party_size, 
      status, 
      notes, 
      is_walk_in, 
      assignment_method, 
      was_on_waitlist
    ) VALUES (
      '11111111-1111-1111-1111-111111111111',
      table1_id,
      '22222222-2222-2222-2222-222222222221',
      CURRENT_DATE,
      '18:00',
      2,
      'confirmed',
      'Anniversary dinner - please prepare something special!',
      false,
      'auto',
      false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM bookings 
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' 
    AND customer_id = '22222222-2222-2222-2222-222222222222'
    AND booking_date = CURRENT_DATE
    AND booking_time = '19:30'
  ) THEN
    INSERT INTO bookings (
      restaurant_id, 
      table_id, 
      customer_id, 
      booking_date, 
      booking_time, 
      party_size, 
      status, 
      notes, 
      is_walk_in, 
      assignment_method, 
      was_on_waitlist
    ) VALUES (
      '11111111-1111-1111-1111-111111111111',
      table3_id,
      '22222222-2222-2222-2222-222222222222',
      CURRENT_DATE,
      '19:30',
      4,
      'pending',
      'Birthday celebration for my daughter',
      false,
      'auto',
      false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM bookings 
    WHERE restaurant_id = '11111111-1111-1111-1111-111111111111' 
    AND customer_id = '22222222-2222-2222-2222-222222222223'
    AND booking_date = CURRENT_DATE
    AND booking_time = '20:00'
  ) THEN
    INSERT INTO bookings (
      restaurant_id, 
      table_id, 
      customer_id, 
      booking_date, 
      booking_time, 
      party_size, 
      status, 
      notes, 
      is_walk_in, 
      assignment_method, 
      was_on_waitlist
    ) VALUES (
      '11111111-1111-1111-1111-111111111111',
      table5_id,
      '22222222-2222-2222-2222-222222222223',
      CURRENT_DATE,
      '20:00',
      6,
      'seated',
      'Family dinner',
      false,
      'auto',
      false
    );
  END IF;
END $$;

-- Fix RLS policies to allow public access to booking pages

-- Update restaurants policy for public slug access
DROP POLICY IF EXISTS "Public can read restaurants by slug" ON restaurants;
CREATE POLICY "Public can read restaurants by slug"
  ON restaurants
  FOR SELECT
  TO anon, authenticated
  USING (slug IS NOT NULL);

-- Update restaurant_tables policy for public access
DROP POLICY IF EXISTS "Public can read tables for booking" ON restaurant_tables;
CREATE POLICY "Public can read tables for booking"
  ON restaurant_tables
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Update operating hours policy for public access
DROP POLICY IF EXISTS "Public can read operating hours" ON restaurant_operating_hours;
CREATE POLICY "Public can read operating hours"
  ON restaurant_operating_hours
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Allow public to read bookings for availability checking
DROP POLICY IF EXISTS "Public can read bookings for availability" ON bookings;
CREATE POLICY "Public can read bookings for availability"
  ON bookings
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Allow public to read waiting list for availability checking
DROP POLICY IF EXISTS "Public can read waiting list for availability" ON waiting_list;
CREATE POLICY "Public can read waiting list for availability"
  ON waiting_list
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Update the get_available_tables function to work without authentication
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
) 
SECURITY DEFINER
AS $$
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

-- Update the get_time_slot_availability function to work without authentication
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
) 
SECURITY DEFINER
AS $$
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

-- Grant execute permissions on functions to anon and authenticated users
GRANT EXECUTE ON FUNCTION get_available_tables TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_time_slot_availability TO anon, authenticated;

-- Create a function to link the first user to the test restaurant
CREATE OR REPLACE FUNCTION link_user_to_test_restaurant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_restaurant_id uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- Check if this is the first user and test restaurant exists
  IF NOT EXISTS (SELECT 1 FROM user_profiles LIMIT 1) AND 
     EXISTS (SELECT 1 FROM restaurants WHERE id = test_restaurant_id) THEN
    
    -- Link user to test restaurant
    INSERT INTO user_profiles (id, restaurant_id, role)
    VALUES (NEW.id, test_restaurant_id, 'owner');
    
    -- Update restaurant owner
    UPDATE restaurants 
    SET owner_id = NEW.id, updated_at = now()
    WHERE id = test_restaurant_id;
    
    -- Create test stripe customer and subscription for full access
    INSERT INTO stripe_customers (user_id, customer_id)
    VALUES (NEW.id, 'cus_test_' || substr(NEW.id::text, 1, 8))
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO stripe_subscriptions (
      customer_id,
      subscription_id,
      price_id,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      payment_method_brand,
      payment_method_last4,
      status
    ) VALUES (
      'cus_test_' || substr(NEW.id::text, 1, 8),
      'sub_test_' || substr(NEW.id::text, 1, 8),
      'price_1RAY0MB1E07AY4srgFYhfB26', -- Premium plan price ID
      extract(epoch from now())::bigint,
      extract(epoch from (now() + interval '1 month'))::bigint,
      false,
      'visa',
      '4242',
      'active'
    )
    ON CONFLICT (customer_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically link first user to test restaurant
DROP TRIGGER IF EXISTS auto_link_test_restaurant ON auth.users;
CREATE TRIGGER auto_link_test_restaurant
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_user_to_test_restaurant();

-- Create a function to reset test data (useful for development)
CREATE OR REPLACE FUNCTION reset_test_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_restaurant_id uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  IF EXISTS (SELECT 1 FROM restaurants WHERE id = test_restaurant_id) THEN
    -- Reset table statuses
    UPDATE restaurant_tables 
    SET status = 'available', updated_at = now()
    WHERE restaurant_id = test_restaurant_id;

    -- Delete old bookings (keep structure)
    DELETE FROM bookings 
    WHERE restaurant_id = test_restaurant_id 
    AND booking_date < CURRENT_DATE;

    -- Clear waiting list
    DELETE FROM waiting_list 
    WHERE restaurant_id = test_restaurant_id 
    AND requested_date < CURRENT_DATE;

    RAISE NOTICE 'Test data reset successfully for restaurant: %', test_restaurant_id;
  ELSE
    RAISE NOTICE 'Test restaurant not found.';
  END IF;
END;
$$;

-- Create a function to manually link any user to test restaurant (for development)
CREATE OR REPLACE FUNCTION link_current_user_to_test_restaurant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_restaurant_id uuid := '11111111-1111-1111-1111-111111111111';
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  IF EXISTS (SELECT 1 FROM restaurants WHERE id = test_restaurant_id) THEN
    -- Link user to test restaurant
    INSERT INTO user_profiles (id, restaurant_id, role)
    VALUES (current_user_id, test_restaurant_id, 'owner')
    ON CONFLICT (id) DO UPDATE SET
      restaurant_id = test_restaurant_id,
      role = 'owner',
      updated_at = now();
    
    -- Update restaurant owner
    UPDATE restaurants 
    SET owner_id = current_user_id, updated_at = now()
    WHERE id = test_restaurant_id;
    
    -- Create test stripe customer and subscription for full access
    INSERT INTO stripe_customers (user_id, customer_id)
    VALUES (current_user_id, 'cus_test_' || substr(current_user_id::text, 1, 8))
    ON CONFLICT (user_id) DO UPDATE SET
      customer_id = 'cus_test_' || substr(current_user_id::text, 1, 8),
      updated_at = now();

    INSERT INTO stripe_subscriptions (
      customer_id,
      subscription_id,
      price_id,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      payment_method_brand,
      payment_method_last4,
      status
    ) VALUES (
      'cus_test_' || substr(current_user_id::text, 1, 8),
      'sub_test_' || substr(current_user_id::text, 1, 8),
      'price_1RAY0MB1E07AY4srgFYhfB26', -- Premium plan price ID
      extract(epoch from now())::bigint,
      extract(epoch from (now() + interval '1 month'))::bigint,
      false,
      'visa',
      '4242',
      'active'
    )
    ON CONFLICT (customer_id) DO UPDATE SET
      subscription_id = 'sub_test_' || substr(current_user_id::text, 1, 8),
      price_id = 'price_1RAY0MB1E07AY4srgFYhfB26',
      current_period_start = extract(epoch from now())::bigint,
      current_period_end = extract(epoch from (now() + interval '1 month'))::bigint,
      status = 'active',
      updated_at = now();
    
    RAISE NOTICE 'User % linked to test restaurant successfully!', current_user_id;
    RAISE NOTICE 'Restaurant URL: /test-restaurant';
  ELSE
    RAISE EXCEPTION 'Test restaurant not found';
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION reset_test_data TO authenticated;
GRANT EXECUTE ON FUNCTION link_current_user_to_test_restaurant TO authenticated;