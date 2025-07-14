/*
  # Update Employees RLS Policy

  1. Changes
     - Drop existing SELECT policy on employees table
     - Create new SELECT policy that allows:
       - Users to view their own employee record
       - Owners and managers to view all employees in their restaurant
     - This fixes the issue where owners/managers couldn't see staff members in the management panel
  
  2. Security
     - Maintains proper access control
     - Owners and managers can view all staff
     - Regular staff can only see their own record
*/

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "employees_select_own" ON "public"."employees";

-- Create new SELECT policy with role-based access
CREATE POLICY "employees_select_with_role_access" 
ON "public"."employees"
FOR SELECT
TO authenticated
USING (
  -- Users can see their own record
  (auth.uid() = id)
  OR
  -- Owners and managers can see all employees in their restaurant
  EXISTS (
    SELECT 1 FROM employees 
    WHERE 
      id = auth.uid() 
      AND restaurant_id IS NOT NULL
      AND is_active = true
      AND (role = 'owner' OR role = 'manager')
      AND restaurant_id IN (
        SELECT restaurant_id FROM employees WHERE id = auth.uid()
      )
  )
);

-- Ensure other policies remain in place
-- No changes needed for INSERT and UPDATE policies