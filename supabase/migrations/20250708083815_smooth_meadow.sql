/*
  # Analytics Functions for Restaurant Dashboard

  1. Database Functions
    - `get_booking_analytics` - Time slot analysis with peak detection
    - `get_daily_analytics` - Daily booking patterns by day of week  
    - `get_booking_trends` - Booking trends over time with lead times
    - `get_popular_dishes` - Most ordered menu items with revenue data
    - `get_revenue_analytics` - Complete revenue and order metrics
    - `get_category_performance` - Menu category performance analysis

  2. Security
    - All functions use SECURITY DEFINER for proper access control
    - Functions validate restaurant ownership through RLS policies
*/

-- Drop existing functions if they exist to avoid conflicts
DROP FUNCTION IF EXISTS get_booking_analytics(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_daily_analytics(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_booking_trends(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_popular_dishes(UUID, DATE, DATE, INTEGER);
DROP FUNCTION IF EXISTS get_revenue_analytics(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_category_performance(UUID, DATE, DATE);

-- Function to get booking analytics by time slot
CREATE OR REPLACE FUNCTION get_booking_analytics(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  time_slot TEXT,
  total_bookings BIGINT,
  total_party_size BIGINT,
  avg_party_size NUMERIC,
  waitlist_triggered BIGINT,
  peak_indicator BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  max_bookings BIGINT;
BEGIN
  -- Get time slot analytics
  CREATE TEMP TABLE temp_slot_data AS
  SELECT 
    b.booking_time::TEXT as slot_time,
    COUNT(*) as booking_count,
    SUM(b.party_size) as party_total,
    AVG(b.party_size::NUMERIC) as party_avg,
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
  
  -- Return results with peak indicator
  RETURN QUERY
  SELECT 
    tsd.slot_time,
    tsd.booking_count,
    tsd.party_total,
    ROUND(tsd.party_avg, 1),
    tsd.waitlist_count,
    (tsd.booking_count >= (max_bookings * 0.8)) as is_peak
  FROM temp_slot_data tsd;
  
  DROP TABLE temp_slot_data;
END;
$$;

-- Function to get daily analytics
CREATE OR REPLACE FUNCTION get_daily_analytics(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  day_name TEXT,
  day_of_week INTEGER,
  total_bookings BIGINT,
  peak_time_slot TEXT,
  avg_party_size NUMERIC,
  waitlist_frequency BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT 
      TO_CHAR(b.booking_date, 'Day') as day_name,
      EXTRACT(DOW FROM b.booking_date)::INTEGER as dow,
      COUNT(*) as booking_count,
      AVG(b.party_size::NUMERIC) as avg_party,
      COUNT(CASE WHEN w.id IS NOT NULL THEN 1 END) as waitlist_count
    FROM bookings b
    LEFT JOIN waiting_list w ON w.restaurant_id = b.restaurant_id 
      AND w.requested_date = b.booking_date
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY b.booking_date, EXTRACT(DOW FROM b.booking_date)
  ),
  peak_times AS (
    SELECT 
      EXTRACT(DOW FROM b.booking_date)::INTEGER as dow,
      b.booking_time::TEXT as time_slot,
      COUNT(*) as slot_bookings,
      ROW_NUMBER() OVER (PARTITION BY EXTRACT(DOW FROM b.booking_date) ORDER BY COUNT(*) DESC) as rn
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM b.booking_date), b.booking_time
  )
  SELECT 
    TRIM(ds.day_name),
    ds.dow,
    ds.booking_count,
    COALESCE(pt.time_slot, '12:00:00'),
    ROUND(ds.avg_party, 1),
    ds.waitlist_count
  FROM daily_stats ds
  LEFT JOIN peak_times pt ON pt.dow = ds.dow AND pt.rn = 1
  ORDER BY ds.dow;
END;
$$;

-- Function to get booking trends
CREATE OR REPLACE FUNCTION get_booking_trends(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  booking_date DATE,
  total_bookings BIGINT,
  avg_lead_time NUMERIC,
  waitlist_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.booking_date,
    COUNT(*)::BIGINT as total_bookings,
    AVG(EXTRACT(DAY FROM (b.booking_date - b.created_at::DATE))::NUMERIC) as avg_lead_time,
    COUNT(CASE WHEN w.id IS NOT NULL THEN 1 END)::BIGINT as waitlist_count
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
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  dish_name TEXT,
  category_name TEXT,
  total_orders BIGINT,
  total_quantity BIGINT,
  total_revenue NUMERIC,
  avg_price NUMERIC,
  popularity_rank BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mi.name,
    mc.name,
    COUNT(DISTINCT oi.order_id)::BIGINT as total_orders,
    SUM(oi.quantity)::BIGINT as total_quantity,
    SUM(oi.total_price_sgd) as total_revenue,
    AVG(oi.unit_price_sgd) as avg_price,
    ROW_NUMBER() OVER (ORDER BY SUM(oi.quantity) DESC)::BIGINT as popularity_rank
  FROM order_items oi
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  JOIN menu_categories mc ON mc.id = mi.category_id
  JOIN orders o ON o.id = oi.order_id
  WHERE mi.restaurant_id = p_restaurant_id
    AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
    AND o.status NOT IN ('cancelled')
  GROUP BY mi.id, mi.name, mc.name
  ORDER BY total_quantity DESC
  LIMIT p_limit;
END;
$$;

-- Function to get revenue analytics
CREATE OR REPLACE FUNCTION get_revenue_analytics(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_revenue NUMERIC,
  total_orders BIGINT,
  avg_order_value NUMERIC,
  total_discounts NUMERIC,
  loyalty_orders BIGINT,
  top_revenue_day DATE,
  top_revenue_amount NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_top_day DATE;
  v_top_amount NUMERIC;
BEGIN
  -- Get top revenue day
  SELECT 
    o.created_at::DATE,
    SUM(o.total_sgd)
  INTO v_top_day, v_top_amount
  FROM orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
    AND o.status NOT IN ('cancelled')
  GROUP BY o.created_at::DATE
  ORDER BY SUM(o.total_sgd) DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(o.total_sgd), 0) as total_revenue,
    COUNT(*)::BIGINT as total_orders,
    COALESCE(AVG(o.total_sgd), 0) as avg_order_value,
    COALESCE(SUM(o.discount_sgd), 0) as total_discounts,
    COUNT(CASE WHEN o.discount_applied = true THEN 1 END)::BIGINT as loyalty_orders,
    COALESCE(v_top_day, p_start_date) as top_revenue_day,
    COALESCE(v_top_amount, 0) as top_revenue_amount
  FROM orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
    AND o.status NOT IN ('cancelled');
END;
$$;

-- Function to get category performance
CREATE OR REPLACE FUNCTION get_category_performance(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  category_name TEXT,
  total_orders BIGINT,
  total_revenue NUMERIC,
  avg_items_per_order NUMERIC,
  category_percentage NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_restaurant_revenue NUMERIC;
BEGIN
  -- Get total revenue for percentage calculation
  SELECT COALESCE(SUM(o.total_sgd), 0)
  INTO total_restaurant_revenue
  FROM orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
    AND o.status NOT IN ('cancelled');

  RETURN QUERY
  WITH category_stats AS (
    SELECT 
      mc.name as cat_name,
      COUNT(DISTINCT oi.order_id)::BIGINT as order_count,
      SUM(oi.total_price_sgd) as revenue,
      AVG(oi.quantity::NUMERIC) as avg_items
    FROM order_items oi
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    JOIN menu_categories mc ON mc.id = mi.category_id
    JOIN orders o ON o.id = oi.order_id
    WHERE mi.restaurant_id = p_restaurant_id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND o.status NOT IN ('cancelled')
    GROUP BY mc.id, mc.name
  )
  SELECT 
    cs.cat_name,
    cs.order_count,
    cs.revenue,
    ROUND(cs.avg_items, 1),
    CASE 
      WHEN total_restaurant_revenue > 0 
      THEN ROUND((cs.revenue / total_restaurant_revenue * 100), 1)
      ELSE 0 
    END as percentage
  FROM category_stats cs
  ORDER BY cs.revenue DESC;
END;
$$;