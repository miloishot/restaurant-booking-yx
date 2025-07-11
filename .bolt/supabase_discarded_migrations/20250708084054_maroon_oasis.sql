/*
  # Fix get_booking_trends function EXTRACT syntax

  1. Functions
    - Drop and recreate `get_booking_trends` function with correct EXTRACT syntax
    - Fix PostgreSQL EXTRACT function calls to use proper `EXTRACT(field FROM source)` format

  2. Changes
    - Corrects EXTRACT function syntax from `EXTRACT(field, source)` to `EXTRACT(field FROM source)`
    - Ensures function returns proper booking trend analytics data
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_booking_trends(uuid, date, date);

-- Create the corrected function with proper EXTRACT syntax
CREATE OR REPLACE FUNCTION get_booking_trends(
  restaurant_id_param uuid,
  start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  booking_date date,
  total_bookings bigint,
  confirmed_bookings bigint,
  cancelled_bookings bigint,
  day_of_week integer,
  week_number integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.booking_date,
    COUNT(*) as total_bookings,
    COUNT(*) FILTER (WHERE b.status = 'confirmed') as confirmed_bookings,
    COUNT(*) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
    EXTRACT(DOW FROM b.booking_date)::integer as day_of_week,
    EXTRACT(WEEK FROM b.booking_date)::integer as week_number
  FROM bookings b
  WHERE b.restaurant_id = restaurant_id_param
    AND b.booking_date >= start_date
    AND b.booking_date <= end_date
  GROUP BY b.booking_date
  ORDER BY b.booking_date;
END;
$$;