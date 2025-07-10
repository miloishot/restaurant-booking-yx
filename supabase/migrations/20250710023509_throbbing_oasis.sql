-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_booking_analytics(uuid, date, date);
DROP FUNCTION IF EXISTS get_daily_analytics(uuid, date, date);
DROP FUNCTION IF EXISTS get_booking_trends(uuid, date, date);
DROP FUNCTION IF EXISTS get_popular_dishes(uuid, date, date, integer);
DROP FUNCTION IF EXISTS get_revenue_analytics(uuid, date, date);
DROP FUNCTION IF EXISTS get_category_performance(uuid, date, date);

-- Function to get booking analytics by time slot
CREATE OR REPLACE FUNCTION get_booking_analytics(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  time_slot text,
  total_bookings bigint,
  total_party_size bigint,
  avg_party_size numeric,
  waitlist_triggered bigint,
  peak_indicator boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_bookings bigint;
BEGIN
  -- Get time slot analytics
  CREATE TEMP TABLE temp_slot_data AS
  SELECT 
    b.booking_time::text as slot_time,
    COUNT(*) as booking_count,
    SUM(b.party_size) as total_guests,
    AVG(b.party_size::numeric) as avg_guests,
    COUNT(CASE WHEN w.id IS NOT NULL THEN 1 END) as waitlist_count
  FROM bookings b
  LEFT JOIN waiting_list w ON w.restaurant_id = b.restaurant_id 
    AND w.requested_date = b.booking_date 
    AND w.requested_time = b.booking_time
  WHERE b.restaurant_id = p_restaurant_id
    AND b.booking_date BETWEEN p_start_date AND p_end_date
    AND b.status NOT IN ('cancelled', 'no_show')
  GROUP BY b.booking_time
  ORDER BY b.booking_time;

  -- Get max bookings for peak detection
  SELECT MAX(booking_count) INTO max_bookings FROM temp_slot_data;
  
  -- Return results with peak detection
  RETURN QUERY
  SELECT 
    tsd.slot_time,
    tsd.booking_count,
    tsd.total_guests,
    ROUND(tsd.avg_guests, 1),
    tsd.waitlist_count,
    (tsd.booking_count >= (max_bookings * 0.8)) as is_peak
  FROM temp_slot_data tsd
  ORDER BY tsd.slot_time;

  DROP TABLE temp_slot_data;
END;
$$;

-- Function to get daily analytics
CREATE OR REPLACE FUNCTION get_daily_analytics(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  day_name text,
  day_of_week integer,
  total_bookings bigint,
  peak_time_slot text,
  avg_party_size numeric,
  waitlist_frequency bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT 
      TRIM(TO_CHAR(b.booking_date, 'Day')) as day_name,
      EXTRACT(DOW FROM b.booking_date)::integer as dow,
      COUNT(*) as bookings,
      AVG(b.party_size::numeric) as avg_guests,
      COUNT(CASE WHEN w.id IS NOT NULL THEN 1 END) as waitlist_count
    FROM bookings b
    LEFT JOIN waiting_list w ON w.restaurant_id = b.restaurant_id 
      AND w.requested_date = b.booking_date
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM b.booking_date), TRIM(TO_CHAR(b.booking_date, 'Day'))
  ),
  peak_times AS (
    SELECT 
      EXTRACT(DOW FROM b.booking_date)::integer as dow,
      b.booking_time::text as time_slot,
      COUNT(*) as slot_bookings,
      ROW_NUMBER() OVER (PARTITION BY EXTRACT(DOW FROM b.booking_date) ORDER BY COUNT(*) DESC) as rn
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM b.booking_date), b.booking_time
  )
  SELECT 
    ds.day_name,
    ds.dow,
    ds.bookings,
    COALESCE(pt.time_slot, '12:00:00') as peak_time,
    ROUND(ds.avg_guests, 1),
    ds.waitlist_count
  FROM daily_stats ds
  LEFT JOIN peak_times pt ON pt.dow = ds.dow AND pt.rn = 1
  ORDER BY ds.dow;
END;
$$;

-- Function to get booking trends
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
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.booking_date,
    COUNT(*)::bigint as bookings,
    AVG(EXTRACT(EPOCH FROM (b.booking_date::timestamp - b.created_at)) / 86400)::numeric as lead_days,
    COUNT(CASE WHEN w.id IS NOT NULL THEN 1 END)::bigint as waitlist_entries
  FROM bookings b
  LEFT JOIN waiting_list w ON w.restaurant_id = b.restaurant_id 
    AND w.requested_date = b.booking_date
  WHERE b.restaurant_id = p_restaurant_id
    AND b.booking_date BETWEEN p_start_date AND p_end_date
    AND b.status NOT IN ('cancelled', 'no_show')
  GROUP BY b.booking_date
  ORDER BY b.booking_date;
END;
$$;

-- Function to get popular dishes
CREATE OR REPLACE FUNCTION get_popular_dishes(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  dish_name text,
  category_name text,
  total_orders bigint,
  total_quantity bigint,
  total_revenue numeric,
  avg_price numeric,
  popularity_rank bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mi.name,
    mc.name,
    COUNT(DISTINCT oi.order_id)::bigint,
    SUM(oi.quantity)::bigint,
    SUM(oi.total_price_sgd),
    AVG(oi.unit_price_sgd),
    ROW_NUMBER() OVER (ORDER BY SUM(oi.quantity) DESC)::bigint
  FROM order_items oi
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  JOIN menu_categories mc ON mc.id = mi.category_id
  JOIN orders o ON o.id = oi.order_id
  WHERE mi.restaurant_id = p_restaurant_id
    AND o.created_at::date BETWEEN p_start_date AND p_end_date
    AND o.status != 'pending'
  GROUP BY mi.id, mi.name, mc.name
  ORDER BY SUM(oi.quantity) DESC
  LIMIT p_limit;
END;
$$;

-- Function to get revenue analytics
CREATE OR REPLACE FUNCTION get_revenue_analytics(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  total_revenue numeric,
  total_orders bigint,
  avg_order_value numeric,
  total_discounts numeric,
  loyalty_orders bigint,
  top_revenue_day date,
  top_revenue_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_top_day date;
  v_top_amount numeric;
BEGIN
  -- Get top revenue day
  SELECT 
    o.created_at::date,
    SUM(o.total_sgd)
  INTO v_top_day, v_top_amount
  FROM orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.created_at::date BETWEEN p_start_date AND p_end_date
    AND o.status != 'pending'
  GROUP BY o.created_at::date
  ORDER BY SUM(o.total_sgd) DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(o.total_sgd), 0),
    COUNT(*)::bigint,
    COALESCE(AVG(o.total_sgd), 0),
    COALESCE(SUM(o.discount_sgd), 0),
    COUNT(CASE WHEN o.discount_applied = true THEN 1 END)::bigint,
    COALESCE(v_top_day, p_start_date),
    COALESCE(v_top_amount, 0)
  FROM orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.created_at::date BETWEEN p_start_date AND p_end_date
    AND o.status != 'pending';
END;
$$;

-- Function to get category performance
CREATE OR REPLACE FUNCTION get_category_performance(
  p_restaurant_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  category_name text,
  total_orders bigint,
  total_revenue numeric,
  avg_items_per_order numeric,
  category_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_revenue_all numeric;
BEGIN
  -- Get total revenue for percentage calculation
  SELECT COALESCE(SUM(oi.total_price_sgd), 0)
  INTO total_revenue_all
  FROM order_items oi
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  JOIN orders o ON o.id = oi.order_id
  WHERE mi.restaurant_id = p_restaurant_id
    AND o.created_at::date BETWEEN p_start_date AND p_end_date
    AND o.status != 'pending';

  RETURN QUERY
  SELECT 
    mc.name,
    COUNT(DISTINCT oi.order_id)::bigint,
    SUM(oi.total_price_sgd),
    AVG(oi.quantity::numeric),
    CASE 
      WHEN total_revenue_all > 0 THEN ROUND((SUM(oi.total_price_sgd) / total_revenue_all * 100), 1)
      ELSE 0
    END
  FROM order_items oi
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  JOIN menu_categories mc ON mc.id = mi.category_id
  JOIN orders o ON o.id = oi.order_id
  WHERE mi.restaurant_id = p_restaurant_id
    AND o.created_at::date BETWEEN p_start_date AND p_end_date
    AND o.status != 'pending'
  GROUP BY mc.id, mc.name
  ORDER BY SUM(oi.total_price_sgd) DESC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_booking_analytics(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_analytics(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_booking_trends(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_dishes(uuid, date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_analytics(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_performance(uuid, date, date) TO authenticated;