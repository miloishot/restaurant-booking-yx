/*
  # Remove employee password column and related functions

  1. Changes
    - Drop the hash_employee_password_trigger from employees table
    - Drop the hash_employee_password function
    - Remove the password column from employees table
    
  2. Rationale
    - Centralizing authentication with Supabase Auth
    - Removing redundant internal password management
    - Simplifying the employee data model
*/

-- Drop the trigger first
DROP TRIGGER IF EXISTS hash_employee_password_trigger ON public.employees;

-- Drop the function
DROP FUNCTION IF EXISTS public.hash_employee_password();

-- Remove the password column
ALTER TABLE public.employees DROP COLUMN IF EXISTS password;