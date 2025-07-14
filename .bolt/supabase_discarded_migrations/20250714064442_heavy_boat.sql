/*
  # Consolidate User Profiles and Employees Tables

  1. Schema Changes
    - Rename existing tables to preserve data
    - Create new consolidated employees table
    - Migrate data from both tables
    - Update foreign key references
    - Recreate RLS policies

  2. Data Migration
    - Merge user_profiles and employees data
    - Preserve role information
    - Maintain restaurant associations
*/

-- Disable RLS temporarily for migration
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries DISABLE ROW LEVEL SECURITY;

-- Drop triggers that sync between the tables
DROP TRIGGER IF EXISTS sync_employee_from_user_profile_trigger ON public.user_profiles;
DROP TRIGGER IF EXISTS sync_user_profile_from_employee_trigger ON public.employees;

-- Drop trigger functions
DROP FUNCTION IF EXISTS public.sync_employee_from_user_profile();
DROP FUNCTION IF EXISTS public.sync_user_profile_from_employee();

-- Create backup tables
CREATE TABLE IF NOT EXISTS public.user_profiles_backup AS 
SELECT * FROM public.user_profiles;

CREATE TABLE IF NOT EXISTS public.employees_backup AS 
SELECT * FROM public.employees;

-- Drop foreign key constraints on time_entries
ALTER TABLE IF EXISTS public.time_entries 
DROP CONSTRAINT IF EXISTS time_entries_restaurant_id_employee_id_fkey;

-- Create new consolidated employees table
CREATE TABLE public.new_employees (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    employee_id text,
    name text,
    role text CHECK (role IN ('owner', 'manager', 'staff')),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create unique constraint on restaurant_id and employee_id
ALTER TABLE public.new_employees 
ADD CONSTRAINT new_employees_restaurant_id_employee_id_key 
UNIQUE (restaurant_id, employee_id) 
WHERE employee_id IS NOT NULL;

-- Migrate data from user_profiles and employees
INSERT INTO public.new_employees (id, restaurant_id, role, created_at, updated_at)
SELECT 
    up.id,
    up.restaurant_id,
    COALESCE(up.role, 'staff'),
    up.created_at,
    up.updated_at
FROM 
    public.user_profiles up
ON CONFLICT (id) DO NOTHING;

-- Update with employee data where available
WITH employee_data AS (
    SELECT 
        e.user_id,
        e.employee_id,
        e.name,
        e.is_active,
        e.role
    FROM 
        public.employees e
    WHERE 
        e.user_id IS NOT NULL
)
UPDATE public.new_employees ne
SET 
    employee_id = ed.employee_id,
    name = ed.name,
    is_active = ed.is_active,
    role = COALESCE(ed.role, ne.role)
FROM 
    employee_data ed
WHERE 
    ne.id = ed.user_id;

-- Insert employees that don't have user profiles yet
INSERT INTO public.new_employees (
    id, 
    restaurant_id, 
    employee_id, 
    name, 
    role, 
    is_active, 
    created_at, 
    updated_at
)
SELECT 
    e.user_id,
    e.restaurant_id,
    e.employee_id,
    e.name,
    COALESCE(e.role, 'staff'),
    e.is_active,
    e.created_at,
    e.updated_at
FROM 
    public.employees e
WHERE 
    e.user_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.new_employees ne WHERE ne.id = e.user_id
    )
ON CONFLICT (id) DO NOTHING;

-- Update time_entries to use employee_id directly
ALTER TABLE public.time_entries
ADD COLUMN IF NOT EXISTS employee_uuid uuid;

-- Update the employee_uuid column with the corresponding user_id from employees
UPDATE public.time_entries te
SET employee_uuid = e.user_id
FROM public.employees e
WHERE te.restaurant_id = e.restaurant_id AND te.employee_id = e.employee_id;

-- Rename tables
ALTER TABLE public.employees RENAME TO employees_old;
ALTER TABLE public.user_profiles RENAME TO user_profiles_old;
ALTER TABLE public.new_employees RENAME TO employees;

-- Add foreign key from time_entries to employees
ALTER TABLE public.time_entries
ADD CONSTRAINT time_entries_employee_uuid_fkey
FOREIGN KEY (employee_uuid)
REFERENCES public.employees(id)
ON DELETE CASCADE;

-- Create updated_at trigger for employees
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Re-enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for employees
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
    (restaurant_id IN (
        SELECT e.restaurant_id
        FROM public.employees e
        WHERE e.id = auth.uid()
    ))
    OR
    (restaurant_id IN (
        SELECT r.id
        FROM public.restaurants r
        WHERE r.owner_id = auth.uid()
    ))
)
WITH CHECK (
    (restaurant_id IN (
        SELECT e.restaurant_id
        FROM public.employees e
        WHERE e.id = auth.uid()
    ))
    OR
    (restaurant_id IN (
        SELECT r.id
        FROM public.restaurants r
        WHERE r.owner_id = auth.uid()
    ))
);

-- Update time_entries RLS policies
DROP POLICY IF EXISTS "Restaurant staff can manage time entries" ON public.time_entries;

CREATE POLICY "Restaurant staff can manage time entries"
ON public.time_entries
FOR ALL
TO authenticated
USING (
    (restaurant_id IN (
        SELECT e.restaurant_id
        FROM public.employees e
        WHERE e.id = auth.uid()
    ))
    OR
    (restaurant_id IN (
        SELECT r.id
        FROM public.restaurants r
        WHERE r.owner_id = auth.uid()
    ))
)
WITH CHECK (
    (restaurant_id IN (
        SELECT e.restaurant_id
        FROM public.employees e
        WHERE e.id = auth.uid()
    ))
    OR
    (restaurant_id IN (
        SELECT r.id
        FROM public.restaurants r
        WHERE r.owner_id = auth.uid()
    ))
);

-- Add policy for employees to manage their own time entries
CREATE POLICY "Employees can manage their own time entries"
ON public.time_entries
FOR ALL
TO authenticated
USING (employee_uuid = auth.uid())
WITH CHECK (employee_uuid = auth.uid());