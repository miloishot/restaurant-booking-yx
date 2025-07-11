/*
  # Add Database Sync Triggers and Functions

  1. Functions
    - `update_updated_at_column()` - Updates the updated_at timestamp
    - `notify_booking_changes()` - Sends real-time notifications for booking changes
    - `notify_table_changes()` - Sends real-time notifications for table changes
    - `notify_waitlist_changes()` - Sends real-time notifications for waitlist changes

  2. Triggers
    - Update timestamps on all relevant tables
    - Send real-time notifications for critical changes
    - Ensure data consistency across all operations

  3. Indexes
    - Add performance indexes for frequently queried columns
    - Optimize real-time query performance
*/

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create notification functions for real-time updates
CREATE OR REPLACE FUNCTION notify_booking_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify about booking changes
    PERFORM pg_notify('booking_changes', json_build_object(
        'operation', TG_OP,
        'record', row_to_json(COALESCE(NEW, OLD)),
        'restaurant_id', COALESCE(NEW.restaurant_id, OLD.restaurant_id),
        'timestamp', CURRENT_TIMESTAMP
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION notify_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify about table status changes
    PERFORM pg_notify('table_changes', json_build_object(
        'operation', TG_OP,
        'record', row_to_json(COALESCE(NEW, OLD)),
        'restaurant_id', COALESCE(NEW.restaurant_id, OLD.restaurant_id),
        'timestamp', CURRENT_TIMESTAMP
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION notify_waitlist_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify about waitlist changes
    PERFORM pg_notify('waitlist_changes', json_build_object(
        'operation', TG_OP,
        'record', row_to_json(COALESCE(NEW, OLD)),
        'restaurant_id', COALESCE(NEW.restaurant_id, OLD.restaurant_id),
        'timestamp', CURRENT_TIMESTAMP
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
DROP TRIGGER IF EXISTS update_restaurant_tables_updated_at ON restaurant_tables;
DROP TRIGGER IF EXISTS update_waiting_list_updated_at ON waiting_list;
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON restaurants;
DROP TRIGGER IF EXISTS update_operating_hours_updated_at ON restaurant_operating_hours;

DROP TRIGGER IF EXISTS notify_booking_changes_trigger ON bookings;
DROP TRIGGER IF EXISTS notify_table_changes_trigger ON restaurant_tables;
DROP TRIGGER IF EXISTS notify_waitlist_changes_trigger ON waiting_list;

-- Create updated_at triggers for all relevant tables
CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurant_tables_updated_at
    BEFORE UPDATE ON restaurant_tables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_waiting_list_updated_at
    BEFORE UPDATE ON waiting_list
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at
    BEFORE UPDATE ON restaurants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operating_hours_updated_at
    BEFORE UPDATE ON restaurant_operating_hours
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create real-time notification triggers
CREATE TRIGGER notify_booking_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION notify_booking_changes();

CREATE TRIGGER notify_table_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON restaurant_tables
    FOR EACH ROW
    EXECUTE FUNCTION notify_table_changes();

CREATE TRIGGER notify_waitlist_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON waiting_list
    FOR EACH ROW
    EXECUTE FUNCTION notify_waitlist_changes();

-- Add performance indexes for real-time queries
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_date_status 
    ON bookings(restaurant_id, booking_date, status);

CREATE INDEX IF NOT EXISTS idx_bookings_table_status 
    ON bookings(table_id, status) WHERE table_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date_status 
    ON waiting_list(restaurant_id, requested_date, status);

CREATE INDEX IF NOT EXISTS idx_waitlist_priority 
    ON waiting_list(restaurant_id, requested_date, requested_time, priority_order) 
    WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status 
    ON restaurant_tables(restaurant_id, status);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_bookings_datetime_lookup 
    ON bookings(restaurant_id, booking_date, booking_time, status);

CREATE INDEX IF NOT EXISTS idx_customers_phone_lookup 
    ON customers(phone) WHERE phone IS NOT NULL;

-- Ensure RLS is enabled on all tables
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_operating_hours ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates the updated_at timestamp on row modifications';
COMMENT ON FUNCTION notify_booking_changes() IS 'Sends real-time notifications for booking table changes';
COMMENT ON FUNCTION notify_table_changes() IS 'Sends real-time notifications for restaurant table changes';
COMMENT ON FUNCTION notify_waitlist_changes() IS 'Sends real-time notifications for waiting list changes';

COMMENT ON INDEX idx_bookings_restaurant_date_status IS 'Optimizes queries for daily booking management';
COMMENT ON INDEX idx_waitlist_priority IS 'Optimizes waiting list priority ordering queries';
COMMENT ON INDEX idx_tables_restaurant_status IS 'Optimizes table status queries for real-time updates';