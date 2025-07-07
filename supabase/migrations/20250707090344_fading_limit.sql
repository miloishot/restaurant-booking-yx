/*
  # Analytics Functions for Booking Dashboard

  1. Functions
    - `get_time_slot_analytics` - Analyze bookings by 15-minute time slots
    - `get_day_analytics` - Analyze bookings by day of week
    - `get_booking_trends` - Track booking trends and lead times

  2. Features
    - Peak time identification
    - Waitlist frequency tracking
    - Party size analytics
    - Booking lead time analysis
*/

-- Function to get time slot analytics
CREATE OR REPLACE FUNCTION get_time_slot_analytics(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  time_slot time,
  total_bookings bigint,
  total_party_size bigint,
  avg_party_size numeric,
  waitlist_triggered bigint,
  peak_indicator boolean
) AS $$
DECLARE
  avg_bookings_per_slot numeric;
BEGIN
  -- Calculate average bookings per slot for peak identification
  SELECT AVG(slot_bookings) INTO avg_bookings_per_slot
  FROM (
    SELECT COUNT(*) as slot_bookings
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status IN ('confirmed', 'seated', 'completed')
    GROUP BY b.booking_time
  ) subq;

  RETURN QUERY
  WITH booking_stats AS (
    SELECT 
      b.booking_time,
      COUNT(*) as booking_count,
      SUM(b.party_size) as total_guests,
      AVG(b.party_size::numeric) as avg_guests
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status IN ('confirmed', 'seated', 'completed')
    GROUP BY b.booking_time
  ),
  waitlist_stats AS (
    SELECT 
      wl.requested_time,
      COUNT(DISTINCT wl.requested_date) as waitlist_days
    FROM waiting_list wl
    WHERE wl.restaurant_id = p_restaurant_id
      AND wl.requested_date BETWEEN p_start_date AND p_end_date
      AND wl.status = 'waiting'
    GROUP BY wl.requested_time
  ),
  all_slots AS (
    SELECT DISTINCT booking_time as slot_time
    FROM bookings
    WHERE restaurant_id = p_restaurant_id
      AND booking_date BETWEEN p_start_date AND p_end_date
    UNION
    SELECT DISTINCT requested_time
    FROM waiting_list
    WHERE restaurant_id = p_restaurant_id
      AND requested_date BETWEEN p_start_date AND p_end_date
  )
  SELECT 
    s.slot_time,
    COALESCE(bs.booking_count, 0),
    COALESCE(bs.total_guests, 0),
    COALESCE(bs.avg_guests, 0),
    COALESCE(ws.waitlist_days, 0),
    COALESCE(bs.booking_count, 0) > COALESCE(avg_bookings_per_slot, 0)
  FROM all_slots s
  LEFT JOIN booking_stats bs ON s.slot_time = bs.booking_time
  LEFT JOIN waitlist_stats ws ON s.slot_time = ws.requested_time
  ORDER BY s.slot_time;
END;
$$ LANGUAGE plpgsql;

-- Function to get day of week analytics
CREATE OR REPLACE FUNCTION get_day_analytics(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  day_name text,
  day_of_week integer,
  total_bookings bigint,
  peak_time_slot time,
  avg_party_size numeric,
  waitlist_frequency numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH day_stats AS (
    SELECT 
      EXTRACT(DOW FROM b.booking_date)::integer as dow,
      COUNT(*) as booking_count,
      AVG(b.party_size::numeric) as avg_guests
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status IN ('confirmed', 'seated', 'completed')
    GROUP BY EXTRACT(DOW FROM b.booking_date)
  ),
  peak_times AS (
    SELECT DISTINCT ON (EXTRACT(DOW FROM b.booking_date))
      EXTRACT(DOW FROM b.booking_date)::integer as dow,
      b.booking_time,
      COUNT(*) as slot_bookings
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status IN ('confirmed', 'seated', 'completed')
    GROUP BY EXTRACT(DOW FROM b.booking_date), b.booking_time
    ORDER BY EXTRACT(DOW FROM b.booking_date), COUNT(*) DESC
  ),
  waitlist_freq AS (
    SELECT 
      EXTRACT(DOW FROM wl.requested_date)::integer as dow,
      COUNT(DISTINCT wl.requested_date) * 100.0 / 
        NULLIF(COUNT(DISTINCT b.booking_date), 0) as freq_percentage
    FROM waiting_list wl
    LEFT JOIN bookings b ON b.restaurant_id = wl.restaurant_id 
      AND b.booking_date = wl.requested_date
    WHERE wl.restaurant_id = p_restaurant_id
      AND wl.requested_date BETWEEN p_start_date AND p_end_date
    GROUP BY EXTRACT(DOW FROM wl.requested_date)
  ),
  day_names AS (
    SELECT 0 as dow, 'Sunday' as name
    UNION SELECT 1, 'Monday'
    UNION SELECT 2, 'Tuesday'
    UNION SELECT 3, 'Wednesday'
    UNION SELECT 4, 'Thursday'
    UNION SELECT 5, 'Friday'
    UNION SELECT 6, 'Saturday'
  )
  SELECT 
    dn.name,
    dn.dow,
    COALESCE(ds.booking_count, 0),
    pt.booking_time,
    COALESCE(ds.avg_guests, 0),
    COALESCE(wf.freq_percentage, 0)
  FROM day_names dn
  LEFT JOIN day_stats ds ON dn.dow = ds.dow
  LEFT JOIN peak_times pt ON dn.dow = pt.dow
  LEFT JOIN waitlist_freq wf ON dn.dow = wf.dow
  ORDER BY dn.dow;
END;
$$ LANGUAGE plpgsql;

-- Function to get booking trends and lead times
CREATE OR REPLACE FUNCTION get_booking_trends(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  booking_date date,
  total_bookings bigint,
  avg_lead_time numeric,
  waitlist_count bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_bookings AS (
    SELECT 
      b.booking_date,
      COUNT(*) as booking_count,
      AVG(EXTRACT(EPOCH FROM (b.booking_date::timestamp - b.created_at)) / 86400) as lead_days
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status IN ('confirmed', 'seated', 'completed')
    GROUP BY b.booking_date
  ),
  daily_waitlist AS (
    SELECT 
      wl.requested_date,
      COUNT(*) as waitlist_entries
    FROM waiting_list wl
    WHERE wl.restaurant_id = p_restaurant_id
      AND wl.requested_date BETWEEN p_start_date AND p_end_date
    GROUP BY wl.requested_date
  ),
  date_series AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date as date_val
  )
  SELECT 
    ds.date_val,
    COALESCE(db.booking_count, 0),
    COALESCE(db.lead_days, 0),
    COALESCE(dw.waitlist_entries, 0)
  FROM date_series ds
  LEFT JOIN daily_bookings db ON ds.date_val = db.booking_date
  LEFT JOIN daily_waitlist dw ON ds.date_val = dw.requested_date
  ORDER BY ds.date_val;
END;
$$ LANGUAGE plpgsql;