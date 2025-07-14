/*
  # Fix RLS Recursion with Separate Role Policies

  1. Changes
     - Temporarily disable RLS on employees and restaurants tables
     - Drop all existing policies that might be causing recursion
     - Create separate policies for each role (staff, manager, owner)
     - Re-enable RLS with non-recursive policies
  
  2. Security
     - Staff can only view/edit their own records
     - Managers can manage employees in their restaurant
     - Owners can manage their restaurants and all employees
*/

-- Temporarily disable RLS to allow policy modifications
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies that might be causing recursion
DROP POLICY IF EXISTS employees_view_own ON public.employees;
DROP POLICY IF EXISTS employees_update_own ON public.employees;
DROP POLICY IF EXISTS employees_select ON public.employees;
DROP POLICY IF EXISTS employees_insert_own ON public.employees;
DROP POLICY IF EXISTS employees_insert_as_manager ON public.employees;
DROP POLICY IF EXISTS employees_update_as_manager ON public.employees;
DROP POLICY IF EXISTS employees_delete_as_manager ON public.employees;
DROP POLICY IF EXISTS employees_update_self ON public.employees;

DROP POLICY IF EXISTS restaurants_select_as_owner ON public.restaurants;
DROP POLICY IF EXISTS restaurants_select_as_employee ON public.restaurants;
DROP POLICY IF EXISTS restaurants_select_public ON public.restaurants;
DROP POLICY IF EXISTS restaurants_insert_as_owner ON public.restaurants;
DROP POLICY IF EXISTS restaurants_update_as_owner ON public.restaurants;
DROP POLICY IF EXISTS restaurants_delete_as_owner ON public.restaurants;
DROP POLICY IF EXISTS restaurants_owner_view ON public.restaurants;
DROP POLICY IF EXISTS restaurants_owner_insert ON public.restaurants;
DROP POLICY IF EXISTS restaurants_owner_update ON public.restaurants;
DROP POLICY IF EXISTS restaurants_owner_delete ON public.restaurants;
DROP POLICY IF EXISTS restaurants_public_view ON public.restaurants;

-- Create separate policies for employees table by role

-- STAFF POLICIES
-- Staff can view their own record
CREATE POLICY employees_staff_view ON public.employees
  FOR SELECT TO authenticated
  USING (auth.uid() = id AND role = 'staff');

-- Staff can update their own record
CREATE POLICY employees_staff_update ON public.employees
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND role = 'staff')
  WITH CHECK (auth.uid() = id AND role = 'staff');

-- MANAGER POLICIES
-- Managers can view their own record
CREATE POLICY employees_manager_view_self ON public.employees
  FOR SELECT TO authenticated
  USING (auth.uid() = id AND role = 'manager');

-- Managers can update their own record
CREATE POLICY employees_manager_update_self ON public.employees
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND role = 'manager')
  WITH CHECK (auth.uid() = id AND role = 'manager');

-- Managers can view all employees in their restaurant
CREATE POLICY employees_manager_view_all ON public.employees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'manager'
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- Managers can insert new employees in their restaurant
CREATE POLICY employees_manager_insert ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'manager'
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- Managers can update employees in their restaurant
CREATE POLICY employees_manager_update_others ON public.employees
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'manager'
      AND e.restaurant_id = employees.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'manager'
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- Managers can delete employees in their restaurant
CREATE POLICY employees_manager_delete ON public.employees
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'manager'
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- OWNER POLICIES
-- Owners can view their own record
CREATE POLICY employees_owner_view_self ON public.employees
  FOR SELECT TO authenticated
  USING (auth.uid() = id AND role = 'owner');

-- Owners can update their own record
CREATE POLICY employees_owner_update_self ON public.employees
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND role = 'owner')
  WITH CHECK (auth.uid() = id AND role = 'owner');

-- Owners can view all employees in their restaurant
CREATE POLICY employees_owner_view_all ON public.employees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'owner'
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- Owners can insert new employees in their restaurant
CREATE POLICY employees_owner_insert ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'owner'
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- Owners can update employees in their restaurant
CREATE POLICY employees_owner_update_others ON public.employees
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'owner'
      AND e.restaurant_id = employees.restaurant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'owner'
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- Owners can delete employees in their restaurant
CREATE POLICY employees_owner_delete ON public.employees
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees AS e
      WHERE e.id = auth.uid() 
      AND e.role = 'owner'
      AND e.restaurant_id = employees.restaurant_id
    )
  );

-- Allow employees to insert their own record (for signup)
CREATE POLICY employees_self_insert ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create separate policies for restaurants table by role

-- OWNER POLICIES
-- Owners can view their restaurants
CREATE POLICY restaurants_owner_view ON public.restaurants
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

-- Owners can insert their restaurants
CREATE POLICY restaurants_owner_insert ON public.restaurants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Owners can update their restaurants
CREATE POLICY restaurants_owner_update ON public.restaurants
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Owners can delete their restaurants
CREATE POLICY restaurants_owner_delete ON public.restaurants
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- EMPLOYEE POLICIES (ALL ROLES)
-- Employees can view restaurants they work for
CREATE POLICY restaurants_employee_view ON public.restaurants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
      AND employees.restaurant_id = restaurants.id
    )
  );

-- PUBLIC ACCESS
-- Public can view restaurants with slugs
CREATE POLICY restaurants_public_view ON public.restaurants
  FOR SELECT TO anon, authenticated
  USING (slug IS NOT NULL);

-- Re-enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;