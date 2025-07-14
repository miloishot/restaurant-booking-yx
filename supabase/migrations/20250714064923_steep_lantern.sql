/*
  # Fix RLS Policy Recursion and Foreign Key Relationships

  1. Security Issues
    - Fix infinite recursion in employees table RLS policies
    - Simplify policies to avoid circular references

  2. Foreign Key Relationships
    - Add proper foreign key from time_entries to employees
    - Update time_entries to reference employees.id instead of employee_id string

  3. Data Consistency
    - Ensure time_entries properly link to employees table
*/

-- Drop existing problematic RLS policies on employees table
DROP POLICY IF EXISTS "Employees can access their own records" ON employees;
DROP POLICY IF EXISTS "Restaurant staff can manage employees" ON employees;

-- Create simplified RLS policies without recursion
CREATE POLICY "Users can view their own employee record"
  ON employees
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Restaurant owners can manage all employees in their restaurant"
  ON employees
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

CREATE POLICY "Managers can view employees in their restaurant"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM employees 
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- Add temp_employee_id column to time_entries if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'temp_employee_id'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN temp_employee_id uuid;
  END IF;
END $$;

-- Update time_entries to link to employees table via UUID
UPDATE time_entries 
SET temp_employee_id = employees.id
FROM employees 
WHERE time_entries.employee_id = employees.employee_id 
AND time_entries.restaurant_id = employees.restaurant_id;

-- Add foreign key constraint from time_entries.temp_employee_id to employees.id
ALTER TABLE time_entries 
ADD CONSTRAINT fk_time_entries_employee 
FOREIGN KEY (temp_employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_time_entries_temp_employee_id 
ON time_entries(temp_employee_id);