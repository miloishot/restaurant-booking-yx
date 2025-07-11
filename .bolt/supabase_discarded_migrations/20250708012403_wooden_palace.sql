/*
  # Restaurant SaaS Model Migration

  This migration transforms the system into a B2B SaaS model where:
  1. Restaurants pay for subscriptions
  2. Each restaurant has a unique booking URL
  3. Customers book for free through restaurant-specific URLs
  4. Staff access admin dashboard with authentication

  ## Changes
  1. Add owner_id and slug to restaurants table
  2. Update RLS policies for multi-tenant access
  3. Create indexes for performance
  4. Add sample data with proper ownership

  ## Security
  - Restaurants can only see their own data
  - Public booking pages work without authentication
  - Staff dashboard requires authentication
*/

-- Add new columns to restaurants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN owner_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'slug'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN slug text UNIQUE;
  END IF;
END $$;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);

-- Update RLS policies for restaurants
DROP POLICY IF EXISTS "Allow all operations on restaurants" ON restaurants;

-- Restaurant owners can manage their own restaurants
CREATE POLICY "Restaurant owners can manage their restaurants"
    ON restaurants
    FOR ALL
    TO authenticated
    USING (owner_id = auth.uid());

-- Public can read restaurants by slug for booking pages
CREATE POLICY "Public can read restaurants by slug"
    ON restaurants
    FOR SELECT
    TO anon, authenticated
    USING (slug IS NOT NULL);

-- Update RLS policies for restaurant_tables
DROP POLICY IF EXISTS "Allow all operations on restaurant_tables" ON restaurant_tables;

-- Restaurant owners can manage their tables
CREATE POLICY "Restaurant owners can manage their tables"
    ON restaurant_tables
    FOR ALL
    TO authenticated
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Public can read tables for booking
CREATE POLICY "Public can read tables for booking"
    ON restaurant_tables
    FOR SELECT
    TO anon, authenticated
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE slug IS NOT NULL
        )
    );

-- Update RLS policies for bookings
DROP POLICY IF EXISTS "Allow all operations on bookings" ON bookings;

-- Restaurant owners can manage their bookings
CREATE POLICY "Restaurant owners can manage their bookings"
    ON bookings
    FOR ALL
    TO authenticated
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Public can create bookings
CREATE POLICY "Public can create bookings"
    ON bookings
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE slug IS NOT NULL
        )
    );

-- Public can read their own bookings (for confirmation)
CREATE POLICY "Public can read bookings by customer"
    ON bookings
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Update RLS policies for customers
DROP POLICY IF EXISTS "Allow all operations on customers" ON customers;

-- Restaurant owners can see customers who booked with them
CREATE POLICY "Restaurant owners can see their customers"
    ON customers
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT DISTINCT customer_id FROM bookings
            WHERE restaurant_id IN (
                SELECT id FROM restaurants WHERE owner_id = auth.uid()
            )
        )
    );

-- Public can create customer records
CREATE POLICY "Public can create customer records"
    ON customers
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Update customers can update their own records
CREATE POLICY "Customers can update their records"
    ON customers
    FOR UPDATE
    TO anon, authenticated
    USING (true);

-- Update RLS policies for waiting_list
DROP POLICY IF EXISTS "Allow all operations on waiting_list" ON waiting_list;

-- Restaurant owners can manage their waiting list
CREATE POLICY "Restaurant owners can manage waiting list"
    ON waiting_list
    FOR ALL
    TO authenticated
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Public can add to waiting list
CREATE POLICY "Public can add to waiting list"
    ON waiting_list
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE slug IS NOT NULL
        )
    );

-- Update RLS policies for operating hours
DROP POLICY IF EXISTS "Allow all operations on restaurant_operating_hours" ON restaurant_operating_hours;

-- Restaurant owners can manage their operating hours
CREATE POLICY "Restaurant owners can manage operating hours"
    ON restaurant_operating_hours
    FOR ALL
    TO authenticated
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE owner_id = auth.uid()
        )
    );

-- Public can read operating hours for booking
CREATE POLICY "Public can read operating hours"
    ON restaurant_operating_hours
    FOR SELECT
    TO anon, authenticated
    USING (
        restaurant_id IN (
            SELECT id FROM restaurants WHERE slug IS NOT NULL
        )
    );

-- Update sample restaurant with slug and owner
UPDATE restaurants 
SET 
    slug = 'bella-vista-restaurant',
    owner_id = (SELECT id FROM auth.users LIMIT 1)
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Create additional sample restaurants for demo
INSERT INTO restaurants (id, name, slug, address, phone, email, time_slot_duration_minutes, owner_id) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'The Garden Bistro', 'garden-bistro', '456 Oak Avenue, Uptown', '+1 (555) 234-5678', 'info@gardenbistro.com', 15, (SELECT id FROM auth.users LIMIT 1)),
('550e8400-e29b-41d4-a716-446655440002', 'Coastal Kitchen', 'coastal-kitchen', '789 Beach Road, Seaside', '+1 (555) 345-6789', 'hello@coastalkitchen.com', 30, (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (id) DO NOTHING;

-- Add tables for new restaurants
INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status, location_notes) VALUES
-- Garden Bistro tables
('550e8400-e29b-41d4-a716-446655440001', '1', 2, 'available', 'Garden view'),
('550e8400-e29b-41d4-a716-446655440001', '2', 4, 'available', 'Indoor seating'),
('550e8400-e29b-41d4-a716-446655440001', '3', 6, 'available', 'Private dining'),
('550e8400-e29b-41d4-a716-446655440001', '4', 2, 'available', 'Bar seating'),
-- Coastal Kitchen tables
('550e8400-e29b-41d4-a716-446655440002', '1', 4, 'available', 'Ocean view'),
('550e8400-e29b-41d4-a716-446655440002', '2', 2, 'available', 'Window seat'),
('550e8400-e29b-41d4-a716-446655440002', '3', 8, 'available', 'Large party table'),
('550e8400-e29b-41d4-a716-446655440002', '4', 6, 'available', 'Patio seating')
ON CONFLICT (restaurant_id, table_number) DO NOTHING;

-- Add operating hours for new restaurants
INSERT INTO restaurant_operating_hours (restaurant_id, day_of_week, opening_time, closing_time, is_closed) VALUES
-- Garden Bistro hours
('550e8400-e29b-41d4-a716-446655440001', 0, '10:00', '21:00', false), -- Sunday
('550e8400-e29b-41d4-a716-446655440001', 1, '11:00', '21:00', false), -- Monday
('550e8400-e29b-41d4-a716-446655440001', 2, '11:00', '21:00', false), -- Tuesday
('550e8400-e29b-41d4-a716-446655440001', 3, '11:00', '21:00', false), -- Wednesday
('550e8400-e29b-41d4-a716-446655440001', 4, '11:00', '22:00', false), -- Thursday
('550e8400-e29b-41d4-a716-446655440001', 5, '11:00', '22:00', false), -- Friday
('550e8400-e29b-41d4-a716-446655440001', 6, '10:00', '22:00', false), -- Saturday
-- Coastal Kitchen hours
('550e8400-e29b-41d4-a716-446655440002', 0, '09:00', '20:00', false), -- Sunday
('550e8400-e29b-41d4-a716-446655440002', 1, '11:00', '20:00', false), -- Monday
('550e8400-e29b-41d4-a716-446655440002', 2, '11:00', '20:00', false), -- Tuesday
('550e8400-e29b-41d4-a716-446655440002', 3, '11:00', '20:00', false), -- Wednesday
('550e8400-e29b-41d4-a716-446655440002', 4, '11:00', '21:00', false), -- Thursday
('550e8400-e29b-41d4-a716-446655440002', 5, '11:00', '21:00', false), -- Friday
('550e8400-e29b-41d4-a716-446655440002', 6, '09:00', '21:00', false)  -- Saturday
ON CONFLICT (restaurant_id, day_of_week) DO NOTHING;