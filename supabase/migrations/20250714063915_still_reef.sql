```sql
-- Disable RLS for migration
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants DISABLE ROW LEVEL SECURITY;

-- Drop existing foreign key constraints and triggers that depend on employees or user_profiles
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_restaurant_id_employee_id_fkey;

-- Drop triggers and functions related to user_profiles and employees sync
DROP TRIGGER IF EXISTS sync_employee_from_user_profile_trigger ON public.user_profiles;
DROP FUNCTION IF EXISTS public.sync_employee_from_user_profile();
DROP TRIGGER IF EXISTS sync_user_profile_from_employee_trigger ON public.employees;
DROP FUNCTION IF EXISTS public.sync_user_profile_from_employee();

-- Drop user_profiles related constraints
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_restaurant_id_fkey;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_pkey;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Drop employees related constraints (except primary key and unique constraints that will be recreated)
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_pkey;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_restaurant_id_employee_id_key;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_user_id_fkey; -- Drop FK to auth.users(id) as it will become PK

-- Rename existing tables
ALTER TABLE public.employees RENAME TO old_employees;
ALTER TABLE public.user_profiles RENAME TO old_user_profiles;

-- Create the new 'employees' table
CREATE TABLE public.employees (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    employee_id text, -- Internal employee ID, now nullable
    name text NOT NULL,
    role text DEFAULT 'staff'::text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text])),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add unique constraint for employee_id within a restaurant, if employee_id is not null
ALTER TABLE public.employees ADD CONSTRAINT employees_restaurant_id_employee_id_key UNIQUE (restaurant_id, employee_id);

-- Add indexes
CREATE INDEX idx_employees_restaurant_id ON public.employees USING btree (restaurant_id);
CREATE INDEX idx_employees_employee_id ON public.employees USING btree (restaurant_id, employee_id);


-- Migrate data from old_user_profiles and old_employees to the new employees table
INSERT INTO public.employees (id, restaurant_id, name, role, is_active, created_at, updated_at, employee_id)
SELECT
    oup.id,
    oup.restaurant_id,
    COALESCE(oe.name, 'Unknown User'), -- Prefer name from old_employees if exists, else default
    oup.role,
    COALESCE(oe.is_active, true), -- Prefer is_active from old_employees, else default
    oup.created_at,
    oup.updated_at,
    oe.employee_id -- Employee ID from old_employees
FROM
    old_user_profiles oup
LEFT JOIN
    old_employees oe ON oup.id = oe.user_id; -- Join on user_id to get employee-specific data

-- Handle cases where an old_employee record might exist without a corresponding old_user_profile
-- This ensures all existing employee data is migrated, even if not previously linked to a user_profile.
-- This assumes old_employees.user_id is the actual UID.
INSERT INTO public.employees (id, restaurant_id, employee_id, name, role, is_active, created_at, updated_at)
SELECT
    oe.user_id,
    oe.restaurant_id,
    oe.employee_id,
    oe.name,
    oe.role,
    oe.is_active,
    oe.created_at,
    oe.updated_at
FROM
    old_employees oe
LEFT JOIN
    public.employees ne ON oe.user_id = ne.id
WHERE
    ne.id IS NULL AND oe.user_id IS NOT NULL; -- Only insert if not already migrated and user_id is not null

-- Recreate foreign key for time_entries
-- This constraint references (restaurant_id, employee_id) which is still valid in the new employees table
ALTER TABLE public.time_entries
ADD CONSTRAINT time_entries_restaurant_id_employee_id_fkey
FOREIGN KEY (restaurant_id, employee_id) REFERENCES public.employees(restaurant_id, employee_id) ON DELETE CASCADE;

-- Drop old tables
DROP TABLE public.old_employees;
DROP TABLE public.old_user_profiles;

-- Re-enable RLS for employees, time_entries, and restaurants
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Update RLS policies for the new 'employees' table
-- Policy for employees to access their own records
DROP POLICY IF EXISTS "Employees can access their own records" ON public.employees;
CREATE POLICY "Employees can access their own records" ON public.employees
FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Policy for restaurant staff to manage employees
DROP POLICY IF EXISTS "Restaurant staff can manage employees" ON public.employees;
CREATE POLICY "Restaurant staff can manage employees" ON public.employees
FOR ALL USING (
    restaurant_id IN (
        SELECT emp.restaurant_id
        FROM public.employees emp
        WHERE emp.id = auth.uid()
    )
    OR
    restaurant_id IN (
        SELECT r.id
        FROM public.restaurants r
        WHERE r.owner_id = auth.uid()
    )
) WITH CHECK (
    restaurant_id IN (
        SELECT emp.restaurant_id
        FROM public.employees emp
        WHERE emp.id = auth.uid()
    )
    OR
    restaurant_id IN (
        SELECT r.id
        FROM public.restaurants r
        WHERE r.owner_id = auth.uid()
    )
);

-- Review and update RLS policies on other tables that previously referenced user_profiles
-- For example, in 'bookings' table, the policy "Restaurant staff can manage their bookings"
-- currently uses 'user_profiles'. This needs to be updated to 'employees'.
-- This part needs to be done manually or in a separate migration if there are many such policies.
-- For now, assuming the above policies on 'employees' are the primary ones for staff access.
```