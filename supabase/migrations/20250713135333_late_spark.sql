/*
  # Add password hashing to employees table

  1. New Functions
    - `hash_password`: Function to hash passwords using bcrypt
    - `verify_password`: Function to verify passwords against hashed values
  
  2. Changes
    - Add trigger to automatically hash passwords on insert/update
    - Update existing employee passwords to be hashed
*/

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create function to hash passwords
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to verify passwords
CREATE OR REPLACE FUNCTION verify_password(password TEXT, hashed_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN hashed_password = crypt(password, hashed_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically hash passwords on insert/update
CREATE OR REPLACE FUNCTION hash_employee_password()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.password <> OLD.password THEN
    NEW.password = hash_password(NEW.password);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'hash_employee_password_trigger'
  ) THEN
    CREATE TRIGGER hash_employee_password_trigger
    BEFORE INSERT OR UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION hash_employee_password();
  END IF;
END $$;

-- Hash existing employee passwords
-- This is safe to run multiple times as it will only update unhashed passwords
UPDATE employees
SET password = hash_password(password)
WHERE password NOT LIKE '$2a$%' AND password NOT LIKE '$2b$%' AND password NOT LIKE '$2y$%';

-- Add some test employees if they don't exist
INSERT INTO employees (restaurant_id, employee_id, name, password, is_active)
SELECT 
  (SELECT id FROM restaurants LIMIT 1),
  'test',
  'Test User',
  'password123',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE employee_id = 'test'
);

INSERT INTO employees (restaurant_id, employee_id, name, password, is_active)
SELECT 
  (SELECT id FROM restaurants LIMIT 1),
  'admin',
  'Admin User',
  'admin123',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE employee_id = 'admin'
);