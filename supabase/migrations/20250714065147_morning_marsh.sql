/*
  # Fix RLS Policy Infinite Recursion on Employees Table

  This migration fixes the infinite recursion error in RLS policies for the employees table
  by dropping all existing policies and creating simple, non-recursive ones.

  ## Changes
  1. Drop all existing RLS policies on employees table
  2. Create simple, direct policies that don't reference the employees table recursively
  3. Ensure policies use only auth.uid() and direct column comparisons
*/

-- Drop all existing policies on employees table to start fresh
DROP POLICY IF EXISTS "Users can view their own employee record" ON employees;
DROP POLICY IF EXISTS "Restaurant owners can manage all employees in their restaurant" ON employees;
DROP POLICY IF EXISTS "Managers can view employees in their restaurant" ON employees;
DROP POLICY IF EXISTS "Restaurant staff can manage employees" ON employees;
DROP POLICY IF EXISTS "Employees can access their own records" ON employees;

-- Create simple, non-recursive policies
-- Policy 1: Users can view their own employee record
CREATE POLICY "Users can view own record" ON employees
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can update their own employee record
CREATE POLICY "Users can update own record" ON employees
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Restaurant owners can manage all employees (using restaurants table directly)
CREATE POLICY "Restaurant owners manage employees" ON employees
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

-- Policy 4: Allow authenticated users to insert new employee records (for signup)
CREATE POLICY "Allow employee creation" ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);