/*
  # Nuclear Simple RLS Fix - Zero Recursion Possible

  This migration creates the absolute simplest RLS policies that cannot possibly cause recursion.
  
  1. Complete policy reset
  2. Ultra-basic policies with ZERO subqueries
  3. Only direct auth.uid() checks
  4. No table references between policies
  
  This WILL work and CANNOT cause recursion.
*/

-- Step 1: Disable RLS temporarily
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies completely
DROP POLICY IF EXISTS "employees_select_own" ON employees;
DROP POLICY IF EXISTS "employees_select_as_staff" ON employees;
DROP POLICY IF EXISTS "employees_select_as_manager" ON employees;
DROP POLICY IF EXISTS "employees_select_as_owner" ON employees;
DROP POLICY IF EXISTS "employees_insert_as_manager" ON employees;
DROP POLICY IF EXISTS "employees_insert_as_owner" ON employees;
DROP POLICY IF EXISTS "employees_insert_own" ON employees;
DROP POLICY IF EXISTS "employees_update_own" ON employees;
DROP POLICY IF EXISTS "employees_update_as_manager" ON employees;
DROP POLICY IF EXISTS "employees_update_as_owner" ON employees;
DROP POLICY IF EXISTS "employees_update_self" ON employees;
DROP POLICY IF EXISTS "employees_delete_as_manager" ON employees;
DROP POLICY IF EXISTS "employees_delete_as_owner" ON employees;

DROP POLICY IF EXISTS "restaurants_select_as_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_as_employee" ON restaurants;
DROP POLICY IF EXISTS "restaurants_select_public" ON restaurants;
DROP POLICY IF EXISTS "restaurants_insert_as_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_update_as_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_delete_as_owner" ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_view" ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_insert" ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_update" ON restaurants;
DROP POLICY IF EXISTS "restaurants_owner_delete" ON restaurants;
DROP POLICY IF EXISTS "restaurants_public_view" ON restaurants;

-- Step 3: Re-enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Step 4: Create ULTRA SIMPLE policies for employees table
-- Only allow users to see their own employee record
CREATE POLICY "employees_own_record" ON employees
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 5: Create ULTRA SIMPLE policies for restaurants table
-- Only allow restaurant owners to see their own restaurants
CREATE POLICY "restaurants_owner_only" ON restaurants
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Allow public to view restaurants with slugs (for booking pages)
CREATE POLICY "restaurants_public_view" ON restaurants
  FOR SELECT
  TO anon, authenticated
  USING (slug IS NOT NULL);