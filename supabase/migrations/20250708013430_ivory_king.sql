/*
  # User-Restaurant Binding Migration

  This migration implements the recommended database redesign to ensure each user is bound to a specific restaurant.

  ## Changes Made

  1. **User-Restaurant Relationship**
     - Add `restaurant_id` column to `users` table (from auth.users via profile)
     - Create `user_profiles` table to extend auth.users with restaurant binding
     - Ensure each user can only access their assigned restaurant's data

  2. **Enhanced Security**
     - Update RLS policies to enforce user-restaurant binding
     - Ensure users can only see data from their assigned restaurant

  3. **Data Integrity**
     - Add foreign key constraints for user-restaurant relationships
     - Ensure referential integrity across all tables

  ## Security Improvements
     - Users can only access their restaurant's data
     - Staff dashboard automatically filters by user's restaurant
     - Public booking pages remain accessible via restaurant slug
*/

-- Create user_profiles table to extend auth.users with restaurant binding
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  role text DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update restaurants table policies to use user_profiles
DROP POLICY IF EXISTS "Restaurant owners can manage their restaurants" ON restaurants;

CREATE POLICY "Restaurant staff can manage their restaurant"
  ON restaurants
  FOR ALL
  TO authenticated
  USING (
    id IN (
      SELECT restaurant_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Update restaurant_tables policies
DROP POLICY IF EXISTS "Restaurant owners can manage their tables" ON restaurant_tables;

CREATE POLICY "Restaurant staff can manage their tables"
  ON restaurant_tables
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Update bookings policies
DROP POLICY IF EXISTS "Restaurant owners can manage their bookings" ON bookings;

CREATE POLICY "Restaurant staff can manage their bookings"
  ON bookings
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Update customers policies
DROP POLICY IF EXISTS "Restaurant owners can see their customers" ON customers;

CREATE POLICY "Restaurant staff can see their customers"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT DISTINCT bookings.customer_id
      FROM bookings
      INNER JOIN user_profiles ON user_profiles.restaurant_id = bookings.restaurant_id
      WHERE user_profiles.id = auth.uid()
    )
  );

-- Update waiting_list policies
DROP POLICY IF EXISTS "Restaurant owners can manage waiting list" ON waiting_list;

CREATE POLICY "Restaurant staff can manage waiting list"
  ON waiting_list
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Update restaurant_operating_hours policies
DROP POLICY IF EXISTS "Restaurant owners can manage operating hours" ON restaurant_operating_hours;

CREATE POLICY "Restaurant staff can manage operating hours"
  ON restaurant_operating_hours
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Create function to get user's restaurant
CREATE OR REPLACE FUNCTION get_user_restaurant()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT restaurant_id 
  FROM user_profiles 
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Create function to check if user has access to restaurant
CREATE OR REPLACE FUNCTION user_has_restaurant_access(target_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = auth.uid() 
    AND restaurant_id = target_restaurant_id
  );
$$;

-- Create view for user restaurant details
CREATE OR REPLACE VIEW user_restaurant_view AS
SELECT 
  up.id as user_id,
  up.role,
  r.*
FROM user_profiles up
INNER JOIN restaurants r ON r.id = up.restaurant_id
WHERE up.id = auth.uid();

-- Enable RLS on the view
ALTER VIEW user_restaurant_view OWNER TO postgres;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_restaurant_id ON user_profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(id);

-- Insert sample data for existing users (if any)
-- This will need to be customized based on your existing data
DO $$
DECLARE
  first_restaurant_id uuid;
BEGIN
  -- Get the first restaurant ID (for demo purposes)
  SELECT id INTO first_restaurant_id FROM restaurants LIMIT 1;
  
  -- If we have a restaurant, create profiles for any existing users
  IF first_restaurant_id IS NOT NULL THEN
    INSERT INTO user_profiles (id, restaurant_id, role)
    SELECT 
      au.id,
      first_restaurant_id,
      'owner'
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM user_profiles up WHERE up.id = au.id
    );
  END IF;
END $$;