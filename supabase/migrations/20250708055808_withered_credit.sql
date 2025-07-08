/*
  # Clear all data from database tables

  This migration removes all existing data from the database while preserving
  the table structure and relationships. This allows for a fresh start with
  new restaurant data.

  ## What this migration does:
  1. Temporarily disables triggers to prevent cascading issues
  2. Truncates all tables in proper dependency order
  3. Resets all sequences to start from 1
  4. Re-enables triggers
  5. Verifies all tables are empty
*/

-- Disable triggers temporarily to avoid cascading issues
SET session_replication_role = replica;

-- Clear all data from tables (in dependency order)
TRUNCATE TABLE stripe_orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE stripe_subscriptions RESTART IDENTITY CASCADE;
TRUNCATE TABLE stripe_customers RESTART IDENTITY CASCADE;
TRUNCATE TABLE waiting_list RESTART IDENTITY CASCADE;
TRUNCATE TABLE bookings RESTART IDENTITY CASCADE;
TRUNCATE TABLE restaurant_tables RESTART IDENTITY CASCADE;
TRUNCATE TABLE restaurant_operating_hours RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_profiles RESTART IDENTITY CASCADE;
TRUNCATE TABLE restaurants RESTART IDENTITY CASCADE;
TRUNCATE TABLE customers RESTART IDENTITY CASCADE;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Reset any sequences that might not have been reset by RESTART IDENTITY
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN 
        SELECT schemaname, sequencename 
        FROM pg_sequences 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || quote_ident(seq_record.schemaname) || '.' || quote_ident(seq_record.sequencename) || ' RESTART WITH 1';
    END LOOP;
END $$;

-- Verify all tables are empty
DO $$
DECLARE
    table_record RECORD;
    row_count INTEGER;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename != 'schema_migrations'
    LOOP
        EXECUTE 'SELECT COUNT(*) FROM ' || quote_ident(table_record.tablename) INTO row_count;
        IF row_count > 0 THEN
            RAISE NOTICE 'Table % still has % rows', table_record.tablename, row_count;
        END IF;
    END LOOP;
END $$;

-- Add a comment to track when data was cleared using proper SQL syntax
DO $$
BEGIN
    EXECUTE 'COMMENT ON SCHEMA public IS ''Database cleared on ' || CURRENT_TIMESTAMP::text || ' - ready for fresh data entry''';
END $$;