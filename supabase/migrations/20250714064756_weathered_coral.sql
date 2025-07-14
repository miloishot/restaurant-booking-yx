/*
  # Consolidate user_profiles and employees tables

  1. Changes
     - Consolidates user_profiles and employees tables into a single employees table
     - Makes id column reference auth.users.id directly
     - Preserves role information (owner, manager, staff)
     - Updates foreign key constraints and RLS policies
*/

-- Step 1: Create a temporary table to hold the consolidated data
CREATE TABLE IF NOT EXISTS public.new_employees (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  employee_id TEXT,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('owner', 'manager', 'staff')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Migrate data from user_profiles
INSERT INTO public.new_employees (id, restaurant_id, role, name, created_at, updated_at)
SELECT 
  up.id,
  up.restaurant_id,
  COALESCE(up.role, 'staff'),
  COALESCE(
    (SELECT name FROM public.employees WHERE user_id = up.id LIMIT 1),
    (SELECT email FROM auth.users WHERE id = up.id LIMIT 1),
    'Unknown User'
  ),
  up.created_at,
  up.updated_at
FROM public.user_profiles up
ON CONFLICT (id) DO NOTHING;

-- Step 3: Migrate data from employees that have user_id
INSERT INTO public.new_employees (id, restaurant_id, employee_id, name, role, is_active, created_at, updated_at)
SELECT 
  e.user_id,
  e.restaurant_id,
  e.employee_id,
  e.name,
  COALESCE(e.role, 'staff'),
  e.is_active,
  e.created_at,
  e.updated_at
FROM public.employees e
WHERE e.user_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  is_active = EXCLUDED.is_active;

-- Step 4: Create a unique constraint on (restaurant_id, employee_id) for non-null employee_ids
ALTER TABLE public.new_employees 
ADD CONSTRAINT new_employees_restaurant_id_employee_id_key 
UNIQUE (restaurant_id, employee_id) 
DEFERRABLE INITIALLY DEFERRED;

-- Step 5: Update time_entries to reference the new employees table
-- First, create a temporary column to store the user_id
ALTER TABLE public.time_entries ADD COLUMN temp_employee_id UUID;

-- Update the temp_employee_id with the user_id from the employees table
UPDATE public.time_entries t
SET temp_employee_id = e.user_id
FROM public.employees e
WHERE t.restaurant_id = e.restaurant_id AND t.employee_id = e.employee_id;

-- Step 6: Rename tables
ALTER TABLE public.employees RENAME TO old_employees;
ALTER TABLE public.user_profiles RENAME TO old_user_profiles;
ALTER TABLE public.new_employees RENAME TO employees;

-- Step 7: Update time_entries foreign key
ALTER TABLE public.time_entries 
DROP CONSTRAINT IF EXISTS time_entries_restaurant_id_employee_id_fkey;

-- Update the time_entries table to use the new structure
-- This will need to be handled separately as it depends on the specific structure
-- of your time_entries table and how it references employees

-- Step 8: Enable RLS on the new employees table
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies for the new employees table
CREATE POLICY "Employees can access their own records"
  ON public.employees
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Restaurant staff can manage employees"
  ON public.employees
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.employees 
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.employees 
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- Step 10: Create a trigger function to update the updated_at column
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Create a trigger to update the updated_at column
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION update_employees_updated_at();