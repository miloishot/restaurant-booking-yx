/*
  # Fix Order Sessions RLS Policy

  1. Security Updates
    - Add INSERT policy for order_sessions table
    - Allow restaurant staff to create order sessions for their restaurant
    - Allow restaurant owners to create order sessions for their restaurants

  2. Changes
    - Creates policy that checks if authenticated user is an employee or owner of the restaurant
    - Ensures only authorized users can create order sessions
*/

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow staff to create order sessions for their restaurant" ON public.order_sessions;
DROP POLICY IF EXISTS "Restaurant staff can manage order sessions" ON public.order_sessions;

-- Create comprehensive INSERT policy for order_sessions
CREATE POLICY "Restaurant staff can create order sessions" 
ON public.order_sessions 
FOR INSERT 
WITH CHECK (
  -- Allow if user is an employee of the restaurant
  (restaurant_id IN (
    SELECT employees.restaurant_id 
    FROM employees 
    WHERE employees.id = auth.uid() 
    AND employees.is_active = true
  ))
  OR
  -- Allow if user is the owner of the restaurant
  (restaurant_id IN (
    SELECT restaurants.id 
    FROM restaurants 
    WHERE restaurants.owner_id = auth.uid()
  ))
);

-- Update existing SELECT policy to be more comprehensive
DROP POLICY IF EXISTS "Public can read order sessions" ON public.order_sessions;

CREATE POLICY "Allow reading order sessions" 
ON public.order_sessions 
FOR SELECT 
USING (
  -- Public can read active sessions for restaurants with slugs (for QR ordering)
  ((restaurant_id IN (
    SELECT restaurants.id 
    FROM restaurants 
    WHERE restaurants.slug IS NOT NULL
  )) AND is_active = true)
  OR
  -- Restaurant staff can read all sessions for their restaurant
  (restaurant_id IN (
    SELECT employees.restaurant_id 
    FROM employees 
    WHERE employees.id = auth.uid() 
    AND employees.is_active = true
  ))
  OR
  -- Restaurant owners can read all sessions for their restaurants
  (restaurant_id IN (
    SELECT restaurants.id 
    FROM restaurants 
    WHERE restaurants.owner_id = auth.uid()
  ))
);

-- Update existing UPDATE policy
DROP POLICY IF EXISTS "Restaurant staff can manage order sessions" ON public.order_sessions;

CREATE POLICY "Restaurant staff can update order sessions" 
ON public.order_sessions 
FOR UPDATE 
USING (
  -- Restaurant staff can update sessions for their restaurant
  (restaurant_id IN (
    SELECT employees.restaurant_id 
    FROM employees 
    WHERE employees.id = auth.uid() 
    AND employees.is_active = true
  ))
  OR
  -- Restaurant owners can update sessions for their restaurants
  (restaurant_id IN (
    SELECT restaurants.id 
    FROM restaurants 
    WHERE restaurants.owner_id = auth.uid()
  ))
)
WITH CHECK (
  -- Same conditions for the updated row
  (restaurant_id IN (
    SELECT employees.restaurant_id 
    FROM employees 
    WHERE employees.id = auth.uid() 
    AND employees.is_active = true
  ))
  OR
  (restaurant_id IN (
    SELECT restaurants.id 
    FROM restaurants 
    WHERE restaurants.owner_id = auth.uid()
  ))
);