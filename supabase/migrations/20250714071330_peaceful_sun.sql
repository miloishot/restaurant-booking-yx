/*
  # Fix Employees RLS Policies

  1. Changes
     - Drop existing RLS policies on employees table
     - Create new policies using auth.uid() instead of uid()
     - Fix employee-restaurant binding with proper policies
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow employee creation" ON public.employees;
DROP POLICY IF EXISTS "Restaurant owners manage employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update own record" ON public.employees;
DROP POLICY IF EXISTS "Users can view own record" ON public.employees;

-- Create new policies with auth.uid() instead of uid()
CREATE POLICY "Users can view own record" 
ON public.employees
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own record" 
ON public.employees
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow employee creation" 
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Restaurant owners manage employees" 
ON public.employees
FOR ALL
TO authenticated
USING (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT id FROM restaurants WHERE owner_id = auth.uid()
  )
);

-- Add index for faster employee-restaurant lookups
CREATE INDEX IF NOT EXISTS idx_employees_restaurant_id_user_id 
ON public.employees(restaurant_id, id);