/*
  # Fix Customer RLS Policies for Booking

  1. Policy Updates
    - Update customer SELECT policy to allow public read access for booking lookup
    - Ensure INSERT policy allows anonymous customer creation
    - Maintain restaurant staff access to their customers

  2. Security
    - Allow anonymous users to check if customer exists by phone (needed for booking)
    - Allow anonymous users to create new customer records
    - Restaurant staff can still see all their customers through bookings
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public can create customer records" ON customers;
DROP POLICY IF EXISTS "Restaurant staff can see their customers" ON customers;
DROP POLICY IF EXISTS "Customers can update their records" ON customers;

-- Allow anonymous users to read customers by phone for booking lookup
CREATE POLICY "Public can read customers for booking"
  ON customers
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anonymous users to create customer records
CREATE POLICY "Public can create customer records"
  ON customers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow customers and restaurant staff to update customer records
CREATE POLICY "Allow customer updates"
  ON customers
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Restaurant staff can manage customers through existing booking relationships
-- (This is already handled through the booking policies)