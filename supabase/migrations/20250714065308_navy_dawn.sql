/*
  # Fix Employee-Restaurant Binding

  1. Changes
    - Drops and recreates RLS policies for employees table
    - Adds proper indexes for employee-restaurant lookups
    - Ensures proper binding between users and restaurants
    - Fixes the relationship between employees and restaurants
  
  2. Security
    - Enables RLS on employees table
    - Adds policies for authenticated users to manage their own records
    - Adds policies for restaurant owners to manage their employees
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Allow employee creation" ON public.employees;
DROP POLICY IF EXISTS "Restaurant owners manage employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update own record" ON public.employees;
DROP POLICY IF EXISTS "Users can view own record" ON public.employees;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_restaurant_id ON public.employees(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(id);

-- Create new policies with proper binding logic
CREATE POLICY "Allow employee creation" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (uid() = id);

CREATE POLICY "Restaurant owners manage employees" ON public.employees
  FOR ALL TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = uid()
  ))
  WITH CHECK (restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = uid()
  ));

CREATE POLICY "Users can update own record" ON public.employees
  FOR UPDATE TO authenticated
  USING (uid() = id)
  WITH CHECK (uid() = id);

CREATE POLICY "Users can view own record" ON public.employees
  FOR SELECT TO authenticated
  USING (uid() = id);

-- Ensure RLS is enabled
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Add a function to check if a user is associated with a restaurant
CREATE OR REPLACE FUNCTION public.is_user_in_restaurant(user_id uuid, restaurant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = user_id AND restaurant_id = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to get a user's restaurant
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(user_id uuid)
RETURNS uuid AS $$
DECLARE
  rest_id uuid;
BEGIN
  SELECT restaurant_id INTO rest_id FROM public.employees WHERE id = user_id LIMIT 1;
  RETURN rest_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;