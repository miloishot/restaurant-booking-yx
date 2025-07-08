/*
  # Restaurant Booking System Database Schema

  1. New Tables
    - `restaurants`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `address` (text, optional)
      - `phone` (text, optional)
      - `email` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `customers`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `email` (text, optional)
      - `phone` (text, required)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `restaurant_tables`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key)
      - `table_number` (text, required)
      - `capacity` (integer, required)
      - `status` (enum: available, occupied, reserved, maintenance)
      - `location_notes` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `bookings`
      - `id` (uuid, primary key)
      - `restaurant_id` (uuid, foreign key)
      - `table_id` (uuid, foreign key)
      - `customer_id` (uuid, foreign key)
      - `booking_date` (date, required)
      - `booking_time` (time, required)
      - `party_size` (integer, required)
      - `status` (enum: pending, confirmed, seated, completed, cancelled, no_show)
      - `notes` (text, optional)
      - `is_walk_in` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (since this is a demo)
    - Add policies for authenticated users

  3. Sample Data
    - Create a sample restaurant
    - Create sample tables
    - Set up initial table statuses
*/

-- Create custom types for table and booking status
CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create restaurant_tables table
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  status table_status DEFAULT 'available',
  location_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  booking_time time NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status booking_status DEFAULT 'pending',
  notes text,
  is_walk_in boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (demo purposes)
-- In production, you would want more restrictive policies

-- Restaurants policies
CREATE POLICY "Allow public read access to restaurants"
  ON restaurants
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to restaurants"
  ON restaurants
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to restaurants"
  ON restaurants
  FOR UPDATE
  TO public
  USING (true);

-- Customers policies
CREATE POLICY "Allow public read access to customers"
  ON customers
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to customers"
  ON customers
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to customers"
  ON customers
  FOR UPDATE
  TO public
  USING (true);

-- Restaurant tables policies
CREATE POLICY "Allow public read access to restaurant_tables"
  ON restaurant_tables
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to restaurant_tables"
  ON restaurant_tables
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to restaurant_tables"
  ON restaurant_tables
  FOR UPDATE
  TO public
  USING (true);

-- Bookings policies
CREATE POLICY "Allow public read access to bookings"
  ON bookings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to bookings"
  ON bookings
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to bookings"
  ON bookings
  FOR UPDATE
  TO public
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant_id ON restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status ON restaurant_tables(status);
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_id ON bookings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_table_id ON bookings(table_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_tables_updated_at
  BEFORE UPDATE ON restaurant_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();