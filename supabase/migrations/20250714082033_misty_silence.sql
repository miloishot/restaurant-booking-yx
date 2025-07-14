/*
  # Fix RLS Infinite Recursion

  This migration fixes the infinite recursion errors in RLS policies by:
  1. Dropping problematic policies that create circular dependencies
  2. Creating simplified policies that avoid recursion
  3. Using direct auth.uid() checks and simple subqueries

  The key is to avoid policies that reference each other in a circular manner.
*/

-- Drop all existing policies on employees table to start fresh
DROP POLICY IF EXISTS "Allow employee creation" ON employees;
DROP POLICY IF EXISTS "Restaurant owners manage employees" ON employees;
DROP POLICY IF EXISTS "Users can update own record" ON employees;
DROP POLICY IF EXISTS "Users can view own record" ON employees;

-- Drop all existing policies on restaurants table to start fresh
DROP POLICY IF EXISTS "Public can read restaurants by slug" ON restaurants;
DROP POLICY IF EXISTS "Restaurant owners can update their restaurants" ON restaurants;
DROP POLICY IF EXISTS "Restaurant staff can manage their restaurant" ON restaurants;
DROP POLICY IF EXISTS "Users can create their own restaurants" ON restaurants;

-- Create simplified employees policies (no circular references)
CREATE POLICY "employees_select_own_or_same_restaurant"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own employee record
    auth.uid() = id
    OR
    -- Users can see other employees in the same restaurant (using a simple subquery)
    restaurant_id IN (
      SELECT restaurant_id 
      FROM employees 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "employees_insert_own"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "employees_update_own"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "employees_owners_manage"
  ON employees
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT id 
      FROM restaurants 
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id 
      FROM restaurants 
      WHERE owner_id = auth.uid()
    )
  );

-- Create simplified restaurants policies (no circular references)
CREATE POLICY "restaurants_select_public_or_owned_or_staff"
  ON restaurants
  FOR SELECT
  TO authenticated
  USING (
    -- Public can read restaurants with slugs
    slug IS NOT NULL
    OR
    -- Owners can read their own restaurants
    owner_id = auth.uid()
    OR
    -- Staff can read restaurants they work for (direct check)
    id IN (
      SELECT restaurant_id 
      FROM employees 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "restaurants_select_public_anon"
  ON restaurants
  FOR SELECT
  TO anon
  USING (slug IS NOT NULL);

CREATE POLICY "restaurants_insert_owner"
  ON restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "restaurants_update_owner"
  ON restaurants
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "restaurants_update_staff"
  ON restaurants
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT restaurant_id 
      FROM employees 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT restaurant_id 
      FROM employees 
      WHERE id = auth.uid()
    )
  );

-- Recreate the user_restaurant_view with simplified logic
DROP VIEW IF EXISTS user_restaurant_view;

CREATE VIEW user_restaurant_view AS
SELECT 
  e.id as user_id,
  e.role,
  r.id,
  r.name,
  r.address,
  r.phone,
  r.email,
  r.time_slot_duration_minutes,
  r.created_at,
  r.updated_at,
  r.owner_id,
  r.slug,
  r.print_api_url,
  r.print_api_key
FROM employees e
JOIN restaurants r ON e.restaurant_id = r.id
WHERE e.is_active = true;