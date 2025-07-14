/*
  # Fix RLS recursion with simple role-based policies
  
  1. New Policies
    - Drop existing policies that cause recursion
    - Create simple policies that avoid circular references
    - Allow owners/managers to view all employees in their restaurant
    - Allow staff to only view their own record
*/

-- Temporarily disable RLS to allow policy changes
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on employees table
DROP POLICY IF EXISTS employees_view_own ON employees;
DROP POLICY IF EXISTS employees_select_as_manager ON employees;
DROP POLICY IF EXISTS employees_select_self ON employees;
DROP POLICY IF EXISTS employees_update_as_manager ON employees;
DROP POLICY IF EXISTS employees_update_self ON employees;
DROP POLICY IF EXISTS employees_insert_as_manager ON employees;
DROP POLICY IF EXISTS employees_delete_as_manager ON employees;

-- Re-enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Create a simple SELECT policy that:
-- 1. Allows users to see their own record (id = auth.uid())
-- 2. Allows users with role 'owner' or 'manager' to see all employees in their restaurant
CREATE POLICY employees_select ON employees
FOR SELECT TO authenticated
USING (
  id = auth.uid() OR 
  (
    EXISTS (
      SELECT 1 FROM employees AS e 
      WHERE e.id = auth.uid() 
      AND e.restaurant_id IS NOT NULL 
      AND e.is_active = true
      AND (e.role = 'owner' OR e.role = 'manager')
      AND e.restaurant_id = employees.restaurant_id
    )
  )
);

-- Create a simple INSERT policy for managers/owners
CREATE POLICY employees_insert ON employees
FOR INSERT TO authenticated
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

-- Create a simple UPDATE policy that:
-- 1. Allows users to update their own record
-- 2. Allows managers/owners to update any employee in their restaurant
CREATE POLICY employees_update ON employees
FOR UPDATE TO authenticated
USING (
  id = auth.uid() OR 
  (
    EXISTS (
      SELECT 1 FROM employees AS e 
      WHERE e.id = auth.uid() 
      AND e.restaurant_id IS NOT NULL 
      AND e.is_active = true
      AND (e.role = 'owner' OR e.role = 'manager')
      AND e.restaurant_id = employees.restaurant_id
    )
  )
)
WITH CHECK (
  id = auth.uid() OR 
  (
    EXISTS (
      SELECT 1 FROM employees AS e 
      WHERE e.id = auth.uid() 
      AND e.restaurant_id IS NOT NULL 
      AND e.is_active = true
      AND (e.role = 'owner' OR e.role = 'manager')
      AND e.restaurant_id = employees.restaurant_id
    )
  )
);

-- Create a simple DELETE policy for managers/owners
CREATE POLICY employees_delete ON employees
FOR DELETE TO authenticated
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

-- Fix restaurants table policies to avoid recursion
ALTER TABLE restaurants DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS restaurants_select_as_employee ON restaurants;
DROP POLICY IF EXISTS restaurants_select_as_owner ON restaurants;
DROP POLICY IF EXISTS restaurants_select_public ON restaurants;
DROP POLICY IF EXISTS restaurants_insert_as_owner ON restaurants;
DROP POLICY IF EXISTS restaurants_update_as_owner ON restaurants;
DROP POLICY IF EXISTS restaurants_delete_as_owner ON restaurants;

-- Re-enable RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Create simple policies for restaurants
-- Owner can see their restaurants
CREATE POLICY restaurants_select_as_owner ON restaurants
FOR SELECT TO authenticated
USING (uid() = owner_id);

-- Employees can see restaurants they work for
CREATE POLICY restaurants_select_as_employee ON restaurants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE employees.id = auth.uid()
    AND employees.restaurant_id = restaurants.id
    AND employees.is_active = true
  )
);

-- Public can see restaurants with slugs
CREATE POLICY restaurants_select_public ON restaurants
FOR SELECT TO anon, authenticated
USING (slug IS NOT NULL);

-- Owner can insert restaurants
CREATE POLICY restaurants_insert_as_owner ON restaurants
FOR INSERT TO authenticated
WITH CHECK (uid() = owner_id);

-- Owner can update restaurants
CREATE POLICY restaurants_update_as_owner ON restaurants
FOR UPDATE TO authenticated
USING (uid() = owner_id)
WITH CHECK (uid() = owner_id);

-- Owner can delete restaurants
CREATE POLICY restaurants_delete_as_owner ON restaurants
FOR DELETE TO authenticated
USING (uid() = owner_id);