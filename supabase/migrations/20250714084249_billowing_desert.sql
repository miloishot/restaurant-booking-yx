/*
  # Fix RLS Policies with Correct auth.uid() Function

  1. Changes
     - Replace incorrect uid() function with correct auth.uid() function
     - Simplify policies to avoid recursion
     - Implement role-based access for employees table
*/

-- Temporarily disable RLS to allow policy changes
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies that might be causing recursion
DROP POLICY IF EXISTS employees_view_own ON public.employees;
DROP POLICY IF EXISTS employees_select_self ON public.employees;
DROP POLICY IF EXISTS employees_select_as_manager ON public.employees;
DROP POLICY IF EXISTS employees_update_self ON public.employees;
DROP POLICY IF EXISTS employees_update_as_manager ON public.employees;
DROP POLICY IF EXISTS employees_insert_as_manager ON public.employees;
DROP POLICY IF EXISTS employees_delete_as_manager ON public.employees;

DROP POLICY IF EXISTS restaurants_select_as_owner ON public.restaurants;
DROP POLICY IF EXISTS restaurants_select_as_employee ON public.restaurants;
DROP POLICY IF EXISTS restaurants_select_public ON public.restaurants;
DROP POLICY IF EXISTS restaurants_insert_as_owner ON public.restaurants;
DROP POLICY IF EXISTS restaurants_update_as_owner ON public.restaurants;
DROP POLICY IF EXISTS restaurants_delete_as_owner ON public.restaurants;

-- Re-enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Create new, simple policies for employees table
-- 1. Staff can view their own record
-- 2. Owners/managers can view all employees in their restaurant
CREATE POLICY employees_select ON public.employees
FOR SELECT TO authenticated
USING (
  (auth.uid() = id) OR  -- Staff can see their own record
  (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid() AND (e.role = 'owner' OR e.role = 'manager')
      AND e.restaurant_id = employees.restaurant_id
    )
  )
);

-- Staff can update their own record
CREATE POLICY employees_update_self ON public.employees
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Owners/managers can update employees in their restaurant
CREATE POLICY employees_update_as_manager ON public.employees
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = auth.uid() AND (e.role = 'owner' OR e.role = 'manager')
    AND e.restaurant_id = employees.restaurant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = auth.uid() AND (e.role = 'owner' OR e.role = 'manager')
    AND e.restaurant_id = employees.restaurant_id
  )
);

-- Owners/managers can insert employees in their restaurant
CREATE POLICY employees_insert_as_manager ON public.employees
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = auth.uid() AND (e.role = 'owner' OR e.role = 'manager')
    AND e.restaurant_id = employees.restaurant_id
  )
);

-- Owners/managers can delete employees in their restaurant
CREATE POLICY employees_delete_as_manager ON public.employees
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = auth.uid() AND (e.role = 'owner' OR e.role = 'manager')
    AND e.restaurant_id = employees.restaurant_id
  )
);

-- Create new, simple policies for restaurants table
-- Owners can see their restaurants
CREATE POLICY restaurants_select_as_owner ON public.restaurants
FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

-- Employees can see restaurants they work for
CREATE POLICY restaurants_select_as_employee ON public.restaurants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE employees.id = auth.uid() AND employees.restaurant_id = restaurants.id
  )
);

-- Public can see restaurants with slugs
CREATE POLICY restaurants_select_public ON public.restaurants
FOR SELECT TO anon, authenticated
USING (slug IS NOT NULL);

-- Owners can insert restaurants
CREATE POLICY restaurants_insert_as_owner ON public.restaurants
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Owners can update their restaurants
CREATE POLICY restaurants_update_as_owner ON public.restaurants
FOR UPDATE TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Owners can delete their restaurants
CREATE POLICY restaurants_delete_as_owner ON public.restaurants
FOR DELETE TO authenticated
USING (auth.uid() = owner_id);