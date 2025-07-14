/*
  # Add user_id column to employees table

  1. Schema Changes
    - Add `user_id` column to `employees` table
    - Create foreign key relationship to `auth.users`
    - Add index for performance
    - Update RLS policies to use user_id

  2. Data Migration
    - For existing employees, user_id will be null initially
    - Manual data population will be needed for existing records

  3. Security
    - Update RLS policies to work with user_id column
    - Ensure employees can only access their own records
*/

-- Add user_id column to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN user_id uuid;
  END IF;
END $$;

-- Add foreign key constraint to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'employees_user_id_fkey'
  ) THEN
    ALTER TABLE employees 
    ADD CONSTRAINT employees_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_employees_user_id'
  ) THEN
    CREATE INDEX idx_employees_user_id ON employees(user_id);
  END IF;
END $$;

-- Update RLS policies to include user_id access
DROP POLICY IF EXISTS "Employees can access their own records" ON employees;

CREATE POLICY "Employees can access their own records"
  ON employees
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Keep existing restaurant staff policy
DROP POLICY IF EXISTS "Restaurant staff can manage employees" ON employees;

CREATE POLICY "Restaurant staff can manage employees"
  ON employees
  FOR ALL
  TO authenticated
  USING (
    (restaurant_id IN (
      SELECT user_profiles.restaurant_id
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )) OR 
    (restaurant_id IN (
      SELECT restaurants.id
      FROM restaurants
      WHERE restaurants.owner_id = auth.uid()
    ))
  )
  WITH CHECK (
    (restaurant_id IN (
      SELECT user_profiles.restaurant_id
      FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )) OR 
    (restaurant_id IN (
      SELECT restaurants.id
      FROM restaurants
      WHERE restaurants.owner_id = auth.uid()
    ))
  );