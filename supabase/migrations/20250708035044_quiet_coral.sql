/*
  # Fix Authentication and Create Test User

  This migration will:
  1. Create a test user with full access
  2. Fix the user-restaurant linking issues
  3. Ensure proper RLS policies for public booking pages
  4. Create a complete test restaurant setup

  ## Test User Details
  - Email: test@restaurant.com
  - Password: testpass123
  - Full access to all features without subscription
*/

-- Create test user function (this will be called manually)
CREATE OR REPLACE FUNCTION create_test_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_user_id uuid;
  test_restaurant_id uuid;
BEGIN
  -- Insert test user into auth.users (simulating signup)
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'test@restaurant.com',
    crypt('testpass123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (email) DO UPDATE SET
    encrypted_password = crypt('testpass123', gen_salt('bf')),
    updated_at = now()
  RETURNING id INTO test_user_id;

  -- Create test restaurant
  INSERT INTO restaurants (
    id,
    name,
    slug,
    address,
    phone,
    email,
    time_slot_duration_minutes,
    owner_id
  ) VALUES (
    gen_random_uuid(),
    'Test Restaurant & Grill',
    'test-restaurant',
    '123 Test Street, Demo City, DC 12345',
    '+1 (555) 999-0000',
    'info@testrestaurant.com',
    15,
    test_user_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    owner_id = test_user_id,
    updated_at = now()
  RETURNING id INTO test_restaurant_id;

  -- Create user profile linking user to restaurant
  INSERT INTO user_profiles (
    id,
    restaurant_id,
    role
  ) VALUES (
    test_user_id,
    test_restaurant_id,
    'owner'
  )
  ON CONFLICT (id) DO UPDATE SET
    restaurant_id = test_restaurant_id,
    role = 'owner',
    updated_at = now();

  -- Create test tables
  INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status, location_notes) VALUES
  (test_restaurant_id, '1', 2, 'available', 'Window seat with city view'),
  (test_restaurant_id, '2', 2, 'available', 'Cozy corner table'),
  (test_restaurant_id, '3', 4, 'available', 'Perfect for families'),
  (test_restaurant_id, '4', 4, 'available', 'Center dining area'),
  (test_restaurant_id, '5', 6, 'available', 'Large group table'),
  (test_restaurant_id, '6', 6, 'available', 'Private dining section'),
  (test_restaurant_id, '7', 8, 'available', 'Party table'),
  (test_restaurant_id, '8', 2, 'available', 'Bar seating'),
  (test_restaurant_id, '9', 4, 'available', 'Outdoor patio'),
  (test_restaurant_id, '10', 2, 'available', 'Intimate booth')
  ON CONFLICT (restaurant_id, table_number) DO NOTHING;

  -- Create operating hours
  INSERT INTO restaurant_operating_hours (restaurant_id, day_of_week, opening_time, closing_time, is_closed) VALUES
  (test_restaurant_id, 0, '10:00', '22:00', false), -- Sunday
  (test_restaurant_id, 1, '11:00', '22:00', false), -- Monday
  (test_restaurant_id, 2, '11:00', '22:00', false), -- Tuesday
  (test_restaurant_id, 3, '11:00', '22:00', false), -- Wednesday
  (test_restaurant_id, 4, '11:00', '23:00', false), -- Thursday
  (test_restaurant_id, 5, '11:00', '23:00', false), -- Friday
  (test_restaurant_id, 6, '10:00', '23:00', false)  -- Saturday
  ON CONFLICT (restaurant_id, day_of_week) DO NOTHING;

  -- Create test customers
  INSERT INTO customers (name, email, phone) VALUES
  ('Alice Johnson', 'alice@example.com', '+1-555-1001'),
  ('Bob Smith', 'bob@example.com', '+1-555-1002'),
  ('Carol Davis', 'carol@example.com', '+1-555-1003'),
  ('David Wilson', 'david@example.com', '+1-555-1004'),
  ('Emma Brown', 'emma@example.com', '+1-555-1005')
  ON CONFLICT (phone) DO NOTHING;

  -- Create some test bookings for today
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
  ) 
  SELECT 
    test_restaurant_id,
    (SELECT id FROM restaurant_tables WHERE restaurant_id = test_restaurant_id AND table_number = '1' LIMIT 1),
    (SELECT id FROM customers WHERE name = 'Alice Johnson' LIMIT 1),
    CURRENT_DATE,
    '18:00',
    2,
    'confirmed',
    'Anniversary dinner - please prepare something special!',
    false,
    'auto',
    false
  WHERE EXISTS (SELECT 1 FROM restaurant_tables WHERE restaurant_id = test_restaurant_id AND table_number = '1')
    AND EXISTS (SELECT 1 FROM customers WHERE name = 'Alice Johnson');

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
  ) 
  SELECT 
    test_restaurant_id,
    (SELECT id FROM restaurant_tables WHERE restaurant_id = test_restaurant_id AND table_number = '3' LIMIT 1),
    (SELECT id FROM customers WHERE name = 'Bob Smith' LIMIT 1),
    CURRENT_DATE,
    '19:30',
    4,
    'pending',
    'Birthday celebration for my daughter',
    false,
    'auto',
    false
  WHERE EXISTS (SELECT 1 FROM restaurant_tables WHERE restaurant_id = test_restaurant_id AND table_number = '3')
    AND EXISTS (SELECT 1 FROM customers WHERE name = 'Bob Smith');

  -- Create test stripe customer and subscription for full access
  INSERT INTO stripe_customers (
    user_id,
    customer_id
  ) VALUES (
    test_user_id,
    'cus_test_' || substr(test_user_id::text, 1, 8)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    customer_id = 'cus_test_' || substr(test_user_id::text, 1, 8),
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
    'cus_test_' || substr(test_user_id::text, 1, 8),
    'sub_test_' || substr(test_user_id::text, 1, 8),
    'price_1RAY0MB1E07AY4srgFYhfB26', -- Premium plan price ID
    extract(epoch from now())::bigint,
    extract(epoch from (now() + interval '1 month'))::bigint,
    false,
    'visa',
    '4242',
    'active'
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    subscription_id = 'sub_test_' || substr(test_user_id::text, 1, 8),
    price_id = 'price_1RAY0MB1E07AY4srgFYhfB26',
    current_period_start = extract(epoch from now())::bigint,
    current_period_end = extract(epoch from (now() + interval '1 month'))::bigint,
    status = 'active',
    updated_at = now();

  RAISE NOTICE 'Test user created successfully!';
  RAISE NOTICE 'Email: test@restaurant.com';
  RAISE NOTICE 'Password: testpass123';
  RAISE NOTICE 'Restaurant URL: /test-restaurant';
  RAISE NOTICE 'User ID: %', test_user_id;
  RAISE NOTICE 'Restaurant ID: %', test_restaurant_id;
END;
$$;

-- Execute the function to create test user
SELECT create_test_user();

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
GRANT EXECUTE ON FUNCTION create_test_user TO postgres;

-- Create a function to reset test data (useful for development)
CREATE OR REPLACE FUNCTION reset_test_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_restaurant_id uuid;
BEGIN
  -- Get test restaurant ID
  SELECT id INTO test_restaurant_id 
  FROM restaurants 
  WHERE slug = 'test-restaurant' 
  LIMIT 1;

  IF test_restaurant_id IS NOT NULL THEN
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
    RAISE NOTICE 'Test restaurant not found. Run create_test_user() first.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_test_data TO postgres;