/*
  # Update old_user_profiles References to employees

  1. Changes
     - Drop and recreate RLS policies that reference old_user_profiles
     - Recreate user_restaurant_view to use employees table
     - Drop old_user_profiles table

  2. Security
     - Maintain same security model but use employees table instead
     - Ensure all tables have appropriate RLS policies
*/

-- Recreate user_restaurant_view to use employees table instead of old_user_profiles
DROP VIEW IF EXISTS user_restaurant_view;
CREATE VIEW user_restaurant_view AS
SELECT 
  e.id AS user_id,
  e.role,
  r.id,
  r.name,
  r.address,
  r.phone,
  r.email,
  r.time_slot_duration_minutes,
  r.created_at,
  r.updated_at,
  r.owner_id,
  r.slug
FROM employees e
JOIN restaurants r ON e.restaurant_id = r.id;

-- Update RLS policies for bookings
DROP POLICY IF EXISTS "Restaurant staff can manage their bookings" ON bookings;
CREATE POLICY "Restaurant staff can manage their bookings" ON bookings
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for restaurant_closed_dates
DROP POLICY IF EXISTS "Restaurant staff can manage closed dates" ON restaurant_closed_dates;
CREATE POLICY "Restaurant staff can manage closed dates" ON restaurant_closed_dates
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for restaurant_custom_hours
DROP POLICY IF EXISTS "Restaurant staff can manage custom hours" ON restaurant_custom_hours;
CREATE POLICY "Restaurant staff can manage custom hours" ON restaurant_custom_hours
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for restaurant_operating_hours
DROP POLICY IF EXISTS "Restaurant staff can manage operating hours" ON restaurant_operating_hours;
CREATE POLICY "Restaurant staff can manage operating hours" ON restaurant_operating_hours
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for printer_configs
DROP POLICY IF EXISTS "Restaurant staff can manage printer configs" ON printer_configs;
CREATE POLICY "Restaurant staff can manage printer configs" ON printer_configs
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for menu_categories
DROP POLICY IF EXISTS "Restaurant staff can manage menu categories" ON menu_categories;
CREATE POLICY "Restaurant staff can manage menu categories" ON menu_categories
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for menu_items
DROP POLICY IF EXISTS "Restaurant staff can manage menu items" ON menu_items;
CREATE POLICY "Restaurant staff can manage menu items" ON menu_items
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for loyalty_users
DROP POLICY IF EXISTS "Restaurant staff can manage loyalty users" ON loyalty_users;
CREATE POLICY "Restaurant staff can manage loyalty users" ON loyalty_users
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for order_sessions
DROP POLICY IF EXISTS "Restaurant staff can create order sessions" ON order_sessions;
CREATE POLICY "Restaurant staff can create order sessions" ON order_sessions
  FOR INSERT
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid() AND is_active = true))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Restaurant staff can update order sessions" ON order_sessions;
CREATE POLICY "Restaurant staff can update order sessions" ON order_sessions
  FOR UPDATE
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid() AND is_active = true))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid() AND is_active = true))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for waiting_list
DROP POLICY IF EXISTS "Restaurant staff can manage waiting list" ON waiting_list;
CREATE POLICY "Restaurant staff can manage waiting list" ON waiting_list
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for restaurant_tables
DROP POLICY IF EXISTS "Restaurant staff can manage assigned tables" ON restaurant_tables;
CREATE POLICY "Restaurant staff can manage assigned tables" ON restaurant_tables
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
  );

-- Update RLS policies for orders
DROP POLICY IF EXISTS "Restaurant staff can manage orders" ON orders;
CREATE POLICY "Restaurant staff can manage orders" ON orders
  USING (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  )
  WITH CHECK (
    (restaurant_id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
    OR 
    (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()))
  );

-- Update RLS policies for restaurants
DROP POLICY IF EXISTS "Restaurant staff can manage their restaurant" ON restaurants;
CREATE POLICY "Restaurant staff can manage their restaurant" ON restaurants
  USING (
    (id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
  )
  WITH CHECK (
    (id IN (SELECT restaurant_id FROM employees WHERE id = auth.uid()))
  );

-- Drop old_user_profiles table if it exists
DROP TABLE IF EXISTS old_user_profiles;