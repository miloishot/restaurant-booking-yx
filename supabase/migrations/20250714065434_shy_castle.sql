/*
  # Fix auth.uid() function reference

  1. Changes
    - Replace incorrect uid() function calls with auth.uid()
    - Fix RLS policies for employees table
    - Ensure proper authentication checks
*/

-- Drop existing policies that use the incorrect uid() function
DROP POLICY IF EXISTS "Allow employee creation" ON public.employees;
DROP POLICY IF EXISTS "Users can update own record" ON public.employees;
DROP POLICY IF EXISTS "Users can view own record" ON public.employees;
DROP POLICY IF EXISTS "Restaurant owners manage employees" ON public.employees;

-- Create new policies with the correct auth.uid() function
CREATE POLICY "Allow employee creation" 
ON public.employees
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own record" 
ON public.employees
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own record" 
ON public.employees
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Restaurant owners manage employees" 
ON public.employees
FOR ALL
TO authenticated
USING (
  restaurant_id IN (
    SELECT id FROM restaurants 
    WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT id FROM restaurants 
    WHERE owner_id = auth.uid()
  )
);