/*
  # Setup Employee Authentication System

  1. Database Functions
    - `hash_password()` - Hashes passwords using bcrypt
    - `verify_password()` - Verifies passwords against hashes
    - `hash_employee_password()` - Trigger function for auto-hashing

  2. Test Employees
    - Creates test employees with hashed passwords for demo purposes
    - Includes the demo credentials shown in the login form

  3. Security
    - Passwords are automatically hashed on insert/update
    - Verification uses secure bcrypt comparison
*/

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to hash a password
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify a password
CREATE OR REPLACE FUNCTION verify_password(password text, hashed_password text)
RETURNS boolean AS $$
BEGIN
  RETURN crypt(password, hashed_password) = hashed_password;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically hash employee passwords
CREATE OR REPLACE FUNCTION hash_employee_password()
RETURNS trigger AS $$
BEGIN
  -- Only hash if password is not already hashed (doesn't start with $2)
  IF NEW.password IS NOT NULL AND NOT (NEW.password LIKE '$2%') THEN
    NEW.password := hash_password(NEW.password);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS hash_employee_password_trigger ON employees;
CREATE TRIGGER hash_employee_password_trigger
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION hash_employee_password();

-- Get the first restaurant ID for test employees
DO $$
DECLARE
  restaurant_uuid uuid;
BEGIN
  -- Get the first restaurant ID
  SELECT id INTO restaurant_uuid FROM restaurants LIMIT 1;
  
  IF restaurant_uuid IS NOT NULL THEN
    -- Insert test employees with plain text passwords (will be auto-hashed by trigger)
    INSERT INTO employees (restaurant_id, employee_id, name, password, is_active)
    VALUES 
      (restaurant_uuid, 'kahweng', 'Kah Weng', 'Eisgrade1!', true),
      (restaurant_uuid, 'yongxuan', 'Yong Xuan', 'Qwerasdf1@3$', true),
      (restaurant_uuid, 'test', 'Test Employee', 'password123', true)
    ON CONFLICT (restaurant_id, employee_id) 
    DO UPDATE SET 
      name = EXCLUDED.name,
      password = EXCLUDED.password,
      is_active = EXCLUDED.is_active;
  END IF;
END $$;