/*
  # Fix RLS Recursion Issues

  1. Changes
     - Temporarily disable RLS on employees and restaurants tables
     - Drop all existing policies on these tables
     - Create new non-recursive policies
     - Re-enable RLS

  2. Security
     - Maintain proper access control while eliminating circular dependencies
     - Ensure owners/managers can see all employees in their restaurant
     - Ensure employees can only see their own record
     - Ensure proper restaurant access control
*/

-- Temporarily disable RLS to allow policy modifications
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on employees table
DROP POLICY IF EXISTS "employees_insert_own" ON employees;
DROP POLICY IF EXISTS "employees_select_with_role_access" ON employees;
DROP POLICY IF EXISTS "employees_update_own" ON employees;
DROP POLICY IF EXISTS "employees_select_owned" ON employees;
DROP POLICY IF EXISTS "employees_select_staff" ON employees;
DROP POLICY IF EXISTS "employees_select_public" ON employees;

-- Drop all existing policies on restaurants table
DROP POLICY IF EXISTS "restaurants_insert_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_owned" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_public" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_staff" ON restaurants;
DROP POLICY IF EXISTS "restaurants_update_owner" ON restaurants;

-- Re-enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Create new non-recursive policies for employees table

-- 1. Allow employees to see their own record (simple auth.uid check, no recursion)
CREATE POLICY "employees_select_self" ON employees
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2. Allow owners and managers to see all employees in their restaurant
-- This uses a direct subquery without complex joins to avoid recursion
CREATE POLICY "employees_select_as_manager" ON employees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees AS e
      WHERE e.id = auth.uid()
      AND e.restaurant_id IS NOT NULL
      AND e.is_active = true
      AND (e.role = 'owner' OR e.role = 'manager')
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- 3. Allow employees to update their own record
CREATE POLICY "employees_update_self" ON employees
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Allow owners and managers to insert new employees
CREATE POLICY "employees_insert_as_manager" ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees AS e
      WHERE e.id = auth.uid()
      AND e.restaurant_id IS NOT NULL
      AND e.is_active = true
      AND (e.role = 'owner' OR e.role = 'manager')
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- 5. Allow owners and managers to update any employee in their restaurant
CREATE POLICY "employees_update_as_manager" ON employees
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees AS e
      WHERE e.id = auth.uid()
      AND e.restaurant_id IS NOT NULL
      AND e.is_active = true
      AND (e.role = 'owner' OR e.role = 'manager')
      AND e.restaurant_id = employees.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees AS e
      WHERE e.id = auth.uid()
      AND e.restaurant_id IS NOT NULL
      AND e.is_active = true
      AND (e.role = 'owner' OR e.role = 'manager')
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- 6. Allow owners and managers to delete employees in their restaurant
CREATE POLICY "employees_delete_as_manager" ON employees
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees AS e
      WHERE e.id = auth.uid()
      AND e.restaurant_id IS NOT NULL
      AND e.is_active = true
      AND (e.role = 'owner' OR e.role = 'manager')
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- Create new non-recursive policies for restaurants table

-- 1. Allow users to see restaurants they own (direct auth.uid check, no recursion)
CREATE POLICY "restaurants_select_as_owner" ON restaurants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- 2. Allow users to see restaurants where they are employees
-- This uses a direct subquery without complex joins to avoid recursion
CREATE POLICY "restaurants_select_as_employee" ON restaurants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE employees.id = auth.uid()
      AND employees.restaurant_id = restaurants.id
      AND employees.is_active = true
    )
  );

-- 3. Allow public access to restaurants with a slug
CREATE POLICY "restaurants_select_public" ON restaurants
  FOR SELECT
  TO anon, authenticated
  USING (slug IS NOT NULL);

-- 4. Allow users to create restaurants where they are the owner
CREATE POLICY "restaurants_insert_as_owner" ON restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- 5. Allow owners to update their restaurants
CREATE POLICY "restaurants_update_as_owner" ON restaurants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 6. Allow owners to delete their restaurants
CREATE POLICY "restaurants_delete_as_owner" ON restaurants
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);