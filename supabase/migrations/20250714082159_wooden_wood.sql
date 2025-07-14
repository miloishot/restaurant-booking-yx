/*
  # Fix RLS Infinite Recursion

  This migration completely rebuilds the RLS policies for employees and restaurants tables
  to eliminate circular dependencies that cause infinite recursion errors.

  ## Changes Made:
  1. Drop all existing policies on employees and restaurants tables
  2. Create simple, non-recursive policies that avoid cross-table references
  3. Use direct auth.uid() checks instead of complex joins
  4. Separate policies for different operations to maintain clarity

  ## Key Principles:
  - No policy should reference another table that has a policy referencing back
  - Use simple, direct conditions wherever possible
  - Avoid complex subqueries in policy conditions
*/

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "employees_insert_own" ON employees;
DROP POLICY IF EXISTS "employees_owners_manage" ON employees;
DROP POLICY IF EXISTS "employees_select_own_or_same_restaurant" ON employees;
DROP POLICY IF EXISTS "employees_update_own" ON employees;

DROP POLICY IF EXISTS "restaurants_insert_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_public_anon" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_public_or_owned_or_staff" ON restaurants;
DROP POLICY IF EXISTS "restaurants_update_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_update_staff" ON restaurants;

-- Create simple policies for employees table
-- Policy 1: Users can see their own employee record
CREATE POLICY "employees_select_own" ON employees
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can insert their own employee record
CREATE POLICY "employees_insert_own" ON employees
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can update their own employee record
CREATE POLICY "employees_update_own" ON employees
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create simple policies for restaurants table
-- Policy 1: Anyone can see restaurants with public slugs
CREATE POLICY "restaurants_select_public" ON restaurants
  FOR SELECT TO anon, authenticated
  USING (slug IS NOT NULL);

-- Policy 2: Owners can see their own restaurants
CREATE POLICY "restaurants_select_owned" ON restaurants
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

-- Policy 3: Owners can insert restaurants
CREATE POLICY "restaurants_insert_owner" ON restaurants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Policy 4: Owners can update their restaurants
CREATE POLICY "restaurants_update_owner" ON restaurants
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Create a separate policy for staff access to restaurants (without recursion)
-- This uses a simple EXISTS check without complex joins
CREATE POLICY "restaurants_select_staff" ON restaurants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees 
      WHERE employees.restaurant_id = restaurants.id 
      AND employees.id = auth.uid()
      AND employees.is_active = true
    )
  );

-- Update policies for other tables to use simple employee checks
-- Update bookings policies
DROP POLICY IF EXISTS "Restaurant staff can manage their bookings" ON bookings;
CREATE POLICY "Restaurant staff can manage bookings" ON bookings
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update restaurant_tables policies
DROP POLICY IF EXISTS "Restaurant owners can manage their tables" ON restaurant_tables;
CREATE POLICY "Restaurant staff can manage tables" ON restaurant_tables
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update waiting_list policies
DROP POLICY IF EXISTS "Restaurant staff can manage waiting list" ON waiting_list;
CREATE POLICY "Restaurant staff can manage waiting list" ON waiting_list
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update restaurant_operating_hours policies
DROP POLICY IF EXISTS "Restaurant staff can manage operating hours" ON restaurant_operating_hours;
CREATE POLICY "Restaurant staff can manage operating hours" ON restaurant_operating_hours
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update restaurant_closed_dates policies
DROP POLICY IF EXISTS "Restaurant staff can manage closed dates" ON restaurant_closed_dates;
CREATE POLICY "Restaurant staff can manage closed dates" ON restaurant_closed_dates
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update restaurant_custom_hours policies
DROP POLICY IF EXISTS "Restaurant staff can manage custom hours" ON restaurant_custom_hours;
CREATE POLICY "Restaurant staff can manage custom hours" ON restaurant_custom_hours
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update menu_categories policies
DROP POLICY IF EXISTS "Restaurant staff can manage menu categories" ON menu_categories;
CREATE POLICY "Restaurant staff can manage menu categories" ON menu_categories
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update menu_items policies
DROP POLICY IF EXISTS "Restaurant staff can manage menu items" ON menu_items;
CREATE POLICY "Restaurant staff can manage menu items" ON menu_items
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update loyalty_users policies
DROP POLICY IF EXISTS "Restaurant staff can manage loyalty users" ON loyalty_users;
CREATE POLICY "Restaurant staff can manage loyalty users" ON loyalty_users
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update order_sessions policies
DROP POLICY IF EXISTS "Restaurant staff can create order sessions" ON order_sessions;
DROP POLICY IF EXISTS "Restaurant staff can update order sessions" ON order_sessions;

CREATE POLICY "Restaurant staff can manage order sessions" ON order_sessions
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update orders policies
DROP POLICY IF EXISTS "Restaurant staff can manage orders" ON orders;
CREATE POLICY "Restaurant staff can manage orders" ON orders
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update printer_configs policies
DROP POLICY IF EXISTS "Restaurant staff can manage printer configs" ON printer_configs;
CREATE POLICY "Restaurant staff can manage printer configs" ON printer_configs
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Update time_entries policies
DROP POLICY IF EXISTS "Employees can manage time entries" ON time_entries;
CREATE POLICY "Employees can manage time entries" ON time_entries
  FOR ALL TO authenticated
  USING (
    temp_employee_id = auth.uid() OR
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    temp_employee_id = auth.uid() OR
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- Recreate the user_restaurant_view without recursion
DROP VIEW IF EXISTS user_restaurant_view;
CREATE VIEW user_restaurant_view AS
SELECT 
  e.id as user_id,
  e.role,
  r.*
FROM employees e
JOIN restaurants r ON e.restaurant_id = r.id
WHERE e.is_active = true;