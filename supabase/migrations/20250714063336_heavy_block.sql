/*
  # Update User Roles and Bindings

  1. Changes
     - Add role column to employees table
     - Ensure consistent role values between user_profiles and employees
     - Add function to sync user_profiles when employees are updated
     - Add trigger to maintain consistency between tables
  
  2. Security
     - Maintain existing RLS policies
*/

-- Add role column to employees table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN role text DEFAULT 'staff'::text;
    
    -- Add check constraint to ensure valid roles
    ALTER TABLE public.employees 
    ADD CONSTRAINT employees_role_check 
    CHECK (role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]));
  END IF;
END $$;

-- Create function to sync user_profiles when employees are updated
CREATE OR REPLACE FUNCTION sync_user_profile_from_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if user_id is not null
  IF NEW.user_id IS NOT NULL THEN
    -- Insert or update the user_profile
    INSERT INTO public.user_profiles (id, restaurant_id, role)
    VALUES (NEW.user_id, NEW.restaurant_id, NEW.role)
    ON CONFLICT (id) 
    DO UPDATE SET 
      restaurant_id = NEW.restaurant_id,
      role = NEW.role,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync user_profiles when employees are updated
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'sync_user_profile_from_employee_trigger'
  ) THEN
    CREATE TRIGGER sync_user_profile_from_employee_trigger
    AFTER INSERT OR UPDATE OF user_id, restaurant_id, role
    ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_profile_from_employee();
  END IF;
END $$;

-- Update existing employees to have proper roles based on user_profiles
UPDATE public.employees e
SET role = up.role
FROM public.user_profiles up
WHERE e.user_id = up.id
AND e.user_id IS NOT NULL
AND (e.role IS NULL OR e.role != up.role);

-- Create function to sync employees when user_profiles are updated
CREATE OR REPLACE FUNCTION sync_employee_from_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Find employees with matching user_id
  UPDATE public.employees
  SET 
    restaurant_id = NEW.restaurant_id,
    role = NEW.role,
    updated_at = now()
  WHERE user_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync employees when user_profiles are updated
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'sync_employee_from_user_profile_trigger'
  ) THEN
    CREATE TRIGGER sync_employee_from_user_profile_trigger
    AFTER UPDATE OF restaurant_id, role
    ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_employee_from_user_profile();
  END IF;
END $$;