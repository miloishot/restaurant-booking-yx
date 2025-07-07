/*
  # Insert Sample Data for Restaurant Booking System

  1. Sample Restaurant
    - Create "The Golden Spoon" restaurant with contact details

  2. Sample Tables
    - Create 12 tables with varying capacities
    - Mix of 2-person, 4-person, 6-person, and 8-person tables
    - Different locations (window, patio, main dining, private)

  3. Initial Status
    - Most tables available
    - Some tables in different states for demo purposes
*/

-- Insert sample restaurant
INSERT INTO restaurants (name, address, phone, email) VALUES
('The Golden Spoon', '123 Culinary Street, Food District, FC 12345', '+1 (555) 123-4567', 'reservations@goldenspoon.com')
ON CONFLICT DO NOTHING;

-- Get the restaurant ID for foreign key references
DO $$
DECLARE
  restaurant_uuid uuid;
BEGIN
  SELECT id INTO restaurant_uuid FROM restaurants WHERE name = 'The Golden Spoon' LIMIT 1;
  
  -- Insert sample tables
  INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status, location_notes) VALUES
  (restaurant_uuid, 'T1', 2, 'available', 'Window seat with city view'),
  (restaurant_uuid, 'T2', 2, 'available', 'Cozy corner table'),
  (restaurant_uuid, 'T3', 4, 'available', 'Main dining area'),
  (restaurant_uuid, 'T4', 4, 'occupied', 'Main dining area'),
  (restaurant_uuid, 'T5', 4, 'available', 'Near the bar'),
  (restaurant_uuid, 'T6', 6, 'available', 'Large family table'),
  (restaurant_uuid, 'T7', 6, 'reserved', 'Private dining section'),
  (restaurant_uuid, 'T8', 8, 'available', 'Perfect for groups'),
  (restaurant_uuid, 'T9', 2, 'available', 'Patio seating'),
  (restaurant_uuid, 'T10', 4, 'available', 'Patio seating'),
  (restaurant_uuid, 'T11', 4, 'maintenance', 'Main dining area'),
  (restaurant_uuid, 'T12', 6, 'available', 'VIP section')
  ON CONFLICT DO NOTHING;
END $$;

-- Insert some sample customers
INSERT INTO customers (name, email, phone) VALUES
('John Smith', 'john.smith@email.com', '+1-555-0101'),
('Sarah Johnson', 'sarah.j@email.com', '+1-555-0102'),
('Michael Brown', 'mike.brown@email.com', '+1-555-0103'),
('Emily Davis', 'emily.davis@email.com', '+1-555-0104'),
('David Wilson', 'david.w@email.com', '+1-555-0105')
ON CONFLICT DO NOTHING;

-- Insert some sample bookings for today
DO $$
DECLARE
  restaurant_uuid uuid;
  table_t4_uuid uuid;
  table_t7_uuid uuid;
  customer_john_uuid uuid;
  customer_sarah_uuid uuid;
  today_date date := CURRENT_DATE;
BEGIN
  -- Get UUIDs for foreign key references
  SELECT id INTO restaurant_uuid FROM restaurants WHERE name = 'The Golden Spoon' LIMIT 1;
  SELECT id INTO table_t4_uuid FROM restaurant_tables WHERE table_number = 'T4' AND restaurant_id = restaurant_uuid LIMIT 1;
  SELECT id INTO table_t7_uuid FROM restaurant_tables WHERE table_number = 'T7' AND restaurant_id = restaurant_uuid LIMIT 1;
  SELECT id INTO customer_john_uuid FROM customers WHERE name = 'John Smith' LIMIT 1;
  SELECT id INTO customer_sarah_uuid FROM customers WHERE name = 'Sarah Johnson' LIMIT 1;
  
  -- Insert sample bookings
  INSERT INTO bookings (restaurant_id, table_id, customer_id, booking_date, booking_time, party_size, status, notes, is_walk_in) VALUES
  (restaurant_uuid, table_t4_uuid, customer_john_uuid, today_date, '19:00', 4, 'seated', 'Anniversary dinner', false),
  (restaurant_uuid, table_t7_uuid, customer_sarah_uuid, today_date, '20:30', 6, 'confirmed', 'Birthday celebration', false)
  ON CONFLICT DO NOTHING;
END $$;