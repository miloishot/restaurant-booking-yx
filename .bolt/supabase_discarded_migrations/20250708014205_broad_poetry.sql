/*
  # Create Premium Test User

  1. New Test Data
    - Create a test user with premium subscription
    - Set up restaurant and user profile
    - Add sample tables and bookings for testing

  2. Test Credentials
    - Email: test@premium.com
    - Password: testpass123
    - Restaurant: Premium Test Restaurant
    - Subscription: Active Premium Plan
*/

-- Insert test user into auth.users (this simulates a signed up user)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '00000000-0000-0000-0000-000000000000',
  'test@premium.com',
  '$2a$10$rqiU7QdZdZdZdZdZdZdZdOeKw8.8nQqQqQqQqQqQqQqQqQqQqQqQq', -- bcrypt hash for 'testpass123'
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create test restaurant
INSERT INTO restaurants (
  id,
  name,
  slug,
  address,
  phone,
  email,
  owner_id,
  time_slot_duration_minutes,
  created_at,
  updated_at
) VALUES (
  '660e8400-e29b-41d4-a716-446655440000',
  'Premium Test Restaurant',
  'premium-test-restaurant',
  '123 Test Street, Test City, TC 12345',
  '+1-555-123-4567',
  'contact@premiumtest.com',
  '550e8400-e29b-41d4-a716-446655440000',
  15,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create user profile linking user to restaurant
INSERT INTO user_profiles (
  id,
  restaurant_id,
  role,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440000',
  'owner',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create Stripe customer record
INSERT INTO stripe_customers (
  id,
  user_id,
  customer_id,
  created_at,
  updated_at
) VALUES (
  1,
  '550e8400-e29b-41d4-a716-446655440000',
  'cus_test_premium_customer',
  NOW(),
  NOW()
) ON CONFLICT (user_id) DO NOTHING;

-- Create active premium subscription
INSERT INTO stripe_subscriptions (
  id,
  customer_id,
  subscription_id,
  price_id,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  payment_method_brand,
  payment_method_last4,
  status,
  created_at,
  updated_at
) VALUES (
  1,
  'cus_test_premium_customer',
  'sub_test_premium_subscription',
  'price_1RAY0MB1E07AY4srgFYhfB26', -- Premium plan price ID from stripe-config.ts
  EXTRACT(EPOCH FROM NOW())::bigint,
  EXTRACT(EPOCH FROM (NOW() + INTERVAL '1 month'))::bigint,
  false,
  'visa',
  '4242',
  'active',
  NOW(),
  NOW()
) ON CONFLICT (customer_id) DO NOTHING;

-- Create sample tables for the restaurant
INSERT INTO restaurant_tables (
  id,
  restaurant_id,
  table_number,
  capacity,
  status,
  location_notes,
  created_at,
  updated_at
) VALUES 
  (
    '770e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440000',
    'T1',
    2,
    'available',
    'Window table',
    NOW(),
    NOW()
  ),
  (
    '770e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440000',
    'T2',
    4,
    'available',
    'Center dining area',
    NOW(),
    NOW()
  ),
  (
    '770e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440000',
    'T3',
    6,
    'occupied',
    'Large table near bar',
    NOW(),
    NOW()
  ),
  (
    '770e8400-e29b-41d4-a716-446655440004',
    '660e8400-e29b-41d4-a716-446655440000',
    'T4',
    2,
    'reserved',
    'Quiet corner',
    NOW(),
    NOW()
  ),
  (
    '770e8400-e29b-41d4-a716-446655440005',
    '660e8400-e29b-41d4-a716-446655440000',
    'T5',
    8,
    'available',
    'Private dining area',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Create operating hours (open every day 11 AM to 10 PM)
INSERT INTO restaurant_operating_hours (
  id,
  restaurant_id,
  day_of_week,
  opening_time,
  closing_time,
  is_closed,
  created_at,
  updated_at
) VALUES 
  (gen_random_uuid(), '660e8400-e29b-41d4-a716-446655440000', 0, '11:00', '22:00', false, NOW(), NOW()), -- Sunday
  (gen_random_uuid(), '660e8400-e29b-41d4-a716-446655440000', 1, '11:00', '22:00', false, NOW(), NOW()), -- Monday
  (gen_random_uuid(), '660e8400-e29b-41d4-a716-446655440000', 2, '11:00', '22:00', false, NOW(), NOW()), -- Tuesday
  (gen_random_uuid(), '660e8400-e29b-41d4-a716-446655440000', 3, '11:00', '22:00', false, NOW(), NOW()), -- Wednesday
  (gen_random_uuid(), '660e8400-e29b-41d4-a716-446655440000', 4, '11:00', '22:00', false, NOW(), NOW()), -- Thursday
  (gen_random_uuid(), '660e8400-e29b-41d4-a716-446655440000', 5, '11:00', '23:00', false, NOW(), NOW()), -- Friday
  (gen_random_uuid(), '660e8400-e29b-41d4-a716-446655440000', 6, '11:00', '23:00', false, NOW(), NOW())  -- Saturday
ON CONFLICT (restaurant_id, day_of_week) DO NOTHING;

-- Create sample customers
INSERT INTO customers (
  id,
  name,
  email,
  phone,
  created_at,
  updated_at
) VALUES 
  (
    '880e8400-e29b-41d4-a716-446655440001',
    'John Smith',
    'john.smith@email.com',
    '+1-555-111-2222',
    NOW(),
    NOW()
  ),
  (
    '880e8400-e29b-41d4-a716-446655440002',
    'Sarah Johnson',
    'sarah.j@email.com',
    '+1-555-333-4444',
    NOW(),
    NOW()
  ),
  (
    '880e8400-e29b-41d4-a716-446655440003',
    'Mike Wilson',
    'mike.wilson@email.com',
    '+1-555-555-6666',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Create sample bookings for today
INSERT INTO bookings (
  id,
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
  was_on_waitlist,
  created_at,
  updated_at
) VALUES 
  (
    '990e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440003',
    '880e8400-e29b-41d4-a716-446655440001',
    CURRENT_DATE,
    '19:00',
    6,
    'seated',
    'Birthday celebration',
    false,
    'auto',
    false,
    NOW(),
    NOW()
  ),
  (
    '990e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440000',
    '770e8400-e29b-41d4-a716-446655440004',
    '880e8400-e29b-41d4-a716-446655440002',
    CURRENT_DATE,
    '20:00',
    2,
    'confirmed',
    'Anniversary dinner',
    false,
    'auto',
    false,
    NOW(),
    NOW()
  ),
  (
    '990e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440000',
    NULL,
    '880e8400-e29b-41d4-a716-446655440003',
    CURRENT_DATE,
    '18:30',
    4,
    'pending',
    'Business dinner',
    false,
    'auto',
    false,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Create sample waiting list entry
INSERT INTO waiting_list (
  id,
  restaurant_id,
  customer_id,
  requested_date,
  requested_time,
  party_size,
  status,
  priority_order,
  notes,
  created_at,
  updated_at
) VALUES (
  'aa0e8400-e29b-41d4-a716-446655440001',
  '660e8400-e29b-41d4-a716-446655440000',
  '880e8400-e29b-41d4-a716-446655440003',
  CURRENT_DATE,
  '19:30',
  4,
  'waiting',
  1,
  'Prefer window seating',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;