/*
  # Integrate Employee Authentication with Supabase Auth

  1. Schema Changes
    - Remove custom password hashing functions and triggers
    - Modify employees table to link with auth.users
    - Add foreign key constraint to link employees with auth users

  2. Data Migration
    - Create auth users for existing employees
    - Link employees to their corresponding auth users
*/

-- Drop existing password hashing trigger and functions
DROP TRIGGER IF EXISTS hash_employee_password_trigger ON public.employees;
DROP FUNCTION IF EXISTS hash_employee_password();
DROP FUNCTION IF EXISTS verify_password(password text, hashed_password text);

-- Modify employees table to link with auth.users
ALTER TABLE public.employees 
  DROP COLUMN IF EXISTS password,
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create unique constraint on user_id
ALTER TABLE public.employees
  ADD CONSTRAINT employees_user_id_key UNIQUE (user_id);

-- Create RLS policy for employees to access their own data
CREATE POLICY "Employees can view their own data"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policy for restaurant owners to manage employees
CREATE POLICY "Restaurant owners can manage employees"
  ON public.employees
  FOR ALL
  TO authenticated
  USING (restaurant_id IN (
    SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
  ));

-- Insert demo users into auth.users and link them to employees
-- Note: This requires admin privileges, which the migration has

-- Helper function to create users and link them to employees
CREATE OR REPLACE FUNCTION create_employee_user(
  p_email TEXT,
  p_password TEXT,
  p_employee_id TEXT
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    recovery_sent_at,
    email_change_sent_at,
    created_at,
    updated_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role_id
  ) VALUES (
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NULL,
    NULL,
    NOW(),
    NOW(),
    NULL,
    '{"provider":"email","providers":["email"]}',
    '{"employee_id":"' || p_employee_id || '"}',
    FALSE,
    (SELECT id FROM auth.roles WHERE name = 'authenticated')
  )
  RETURNING id INTO v_user_id;

  -- Update the employee record with the new user_id
  UPDATE public.employees
  SET user_id = v_user_id
  WHERE employee_id = p_employee_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create demo employee users
SELECT create_employee_user('kahweng@example.com', 'Eisgrade1!', 'kahweng');
SELECT create_employee_user('yongxuan@example.com', 'Qwerasdf1@3$', 'yongxuan');
SELECT create_employee_user('test@example.com', 'password123', 'test');

-- Drop the helper function after use
DROP FUNCTION create_employee_user;