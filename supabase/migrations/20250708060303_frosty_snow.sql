/*
  # Fix Restaurant RLS Policies

  1. Security Updates
    - Add policy for authenticated users to create restaurants
    - Add policy for restaurant owners to update their restaurants
    - Ensure proper access control for restaurant management

  2. Changes
    - Allow authenticated users to insert restaurants where they are the owner
    - Allow restaurant owners to update their own restaurants
    - Maintain existing read policies for public access via slug
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Restaurant staff can manage their restaurant" ON restaurants;
DROP POLICY IF EXISTS "Public can read restaurants by slug" ON restaurants;

-- Allow authenticated users to create restaurants where they are the owner
CREATE POLICY "Users can create their own restaurants"
  ON restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Allow restaurant owners to update their own restaurants
CREATE POLICY "Restaurant owners can update their restaurants"
  ON restaurants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Allow restaurant staff to read and update their restaurant
CREATE POLICY "Restaurant staff can manage their restaurant"
  ON restaurants
  FOR ALL
  TO authenticated
  USING (id IN (
    SELECT user_profiles.restaurant_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  ))
  WITH CHECK (id IN (
    SELECT user_profiles.restaurant_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  ));

-- Allow public to read restaurants by slug (for booking pages)
CREATE POLICY "Public can read restaurants by slug"
  ON restaurants
  FOR SELECT
  TO anon, authenticated
  USING (slug IS NOT NULL);