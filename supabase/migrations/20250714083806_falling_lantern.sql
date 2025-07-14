/*
  # Simple RLS Fix - Eliminate Infinite Recursion

  This migration completely removes all complex RLS policies and replaces them with
  the simplest possible policies that cannot cause recursion.

  ## Changes Made:
  1. Drop all existing policies on employees and restaurants tables
  2. Create ultra-simple policies that only use auth.uid() directly
  3. No subqueries, no joins, no complex conditions
  4. Separate policies for different operations to avoid conflicts

  ## Security Model:
  - Employees: Users can only see their own record
  - Restaurants: Users can only see restaurants they own directly
  - Public access for restaurants with slugs (for booking pages)
*/

-- Disable RLS temporarily to avoid issues during policy changes
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "employees_select_self" ON employees;
DROP POLICY IF EXISTS "employees_select_as_manager" ON employees;
DROP POLICY IF EXISTS "employees_insert_as_manager" ON employees;
DROP POLICY IF EXISTS "employees_update_self" ON employees;
DROP POLICY IF EXISTS "employees_update_as_manager" ON employees;
DROP POLICY IF EXISTS "employees_delete_as_manager" ON employees;
DROP POLICY IF EXISTS "Allow employees to view all in restaurant" ON employees;
DROP POLICY IF EXISTS "Allow managers to insert employees" ON employees;
DROP POLICY IF EXISTS "Allow managers to update employees" ON employees;
DROP POLICY IF EXISTS "Allow managers to delete employees" ON employees;

DROP POLICY IF EXISTS "restaurants_select_public" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_as_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_as_employee" ON restaurants;
DROP POLICY IF EXISTS "restaurants_insert_as_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_update_as_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_delete_as_owner" ON restaurants;
DROP POLICY IF EXISTS "Allow public to view restaurants with slug" ON restaurants;
DROP POLICY IF EXISTS "Allow owners to view their restaurants" ON restaurants;
DROP POLICY IF EXISTS "Allow employees to view their restaurant" ON restaurants;
DROP POLICY IF EXISTS "Allow owners to insert restaurants" ON restaurants;
DROP POLICY IF EXISTS "Allow owners to update restaurants" ON restaurants;
DROP POLICY IF EXISTS "Allow owners to delete restaurants" ON restaurants;

-- Re-enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- EMPLOYEES TABLE POLICIES (Ultra Simple - No Recursion Possible)

-- Policy 1: Users can view their own employee record
CREATE POLICY "employees_view_own" ON employees
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy 2: Users can update their own employee record
CREATE POLICY "employees_update_own" ON employees
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy 3: Allow authenticated users to insert employee records (for registration)
CREATE POLICY "employees_insert_own" ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RESTAURANTS TABLE POLICIES (Ultra Simple - No Recursion Possible)

-- Policy 1: Public can view restaurants with slugs (for booking pages)
CREATE POLICY "restaurants_public_view" ON restaurants
  FOR SELECT
  TO anon, authenticated
  USING (slug IS NOT NULL);

-- Policy 2: Owners can view their own restaurants
CREATE POLICY "restaurants_owner_view" ON restaurants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Policy 3: Owners can insert restaurants they own
CREATE POLICY "restaurants_owner_insert" ON restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Policy 4: Owners can update their own restaurants
CREATE POLICY "restaurants_owner_update" ON restaurants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy 5: Owners can delete their own restaurants
CREATE POLICY "restaurants_owner_delete" ON restaurants
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON employees TO authenticated;
GRANT SELECT ON restaurants TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON restaurants TO authenticated;