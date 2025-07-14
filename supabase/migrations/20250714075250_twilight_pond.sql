/*
  # Fix Time Entries RLS Policy

  1. Security Updates
    - Update RLS policy for time_entries table to work with current employees table structure
    - Allow authenticated employees to insert/update their own time entries
    - Allow restaurant owners and staff to manage time entries for their restaurant

  2. Changes
    - Drop existing policy that references old_user_profiles
    - Create new policy that works with the employees table
    - Ensure employees can punch in/out for themselves
*/

-- Drop the existing policy that references old_user_profiles
DROP POLICY IF EXISTS "Restaurant staff can manage time entries" ON time_entries;

-- Create new policy that allows employees to manage time entries
CREATE POLICY "Employees can manage time entries"
  ON time_entries
  FOR ALL
  TO authenticated
  USING (
    -- Allow if user is the employee themselves (temp_employee_id matches auth.uid())
    temp_employee_id = auth.uid()
    OR
    -- Allow if user is restaurant owner
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
    OR
    -- Allow if user is staff member of the restaurant
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    -- Same conditions for INSERT/UPDATE
    temp_employee_id = auth.uid()
    OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
    OR
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND is_active = true
    )
  );