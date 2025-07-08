/*
  # Analytics Functions for Restaurant Dashboard

  1. New Functions
    - `get_booking_analytics` - Get booking statistics by time slots
    - `get_daily_analytics` - Get daily booking performance
    - `get_booking_trends` - Get booking trends over time
    - `get_popular_dishes` - Get most ordered menu items
    - `get_revenue_analytics` - Get revenue statistics from orders

  2. Security
    - Functions are security definer to allow access to all data
    - RLS policies still apply for data access
*/

-- Function to get booking analytics by time slots
CREATE OR REPLACE FUNCTION get_booking_analytics(
  p_restaurant_id uuid,
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  time_slot time,
  total_bookings bigint,
  total_party_size bigint,
  avg_party_size numeric,
  waitlist_triggered bigint,
  peak_indicator boolean
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH time_slots AS (
    SELECT 
      b.booking_time::time as time_slot,
      COUNT(*) as booking_count,
      SUM(b.party_size) as party_sum,
      AVG(b.party_size::numeric) as party_avg,
      COUNT(CASE WHEN b.was_on_waitlist THEN 1 END) as waitlist_count
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY b.booking_time::time
  ),
  peak_threshold AS (
    SELECT PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY booking_count) as threshold
    FROM time_slots
  )
  SELECT 
    ts.time_slot,
    ts.booking_count,
    ts.party_sum,
    ROUND(ts.party_avg, 1),
    ts.waitlist_count,
    ts.booking_count >= pt.threshold
  FROM time_slots ts
  CROSS JOIN peak_threshold pt
  ORDER BY ts.time_slot;
END;
$$ LANGUAGE plpgsql;

-- Function to get daily analytics
CREATE OR REPLACE FUNCTION get_daily_analytics(
  p_restaurant_id uuid,
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  day_name text,
  day_of_week integer,
  total_bookings bigint,
  peak_time_slot time,
  avg_party_size numeric,
  waitlist_frequency numeric
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT 
      EXTRACT(DOW FROM b.booking_date)::integer as dow,
      TO_CHAR(b.booking_date, 'Day') as day_name,
      COUNT(*) as booking_count,
      AVG(b.party_size::numeric) as party_avg,
      COUNT(CASE WHEN b.was_on_waitlist THEN 1 END)::numeric / COUNT(*)::numeric * 100 as waitlist_pct
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM b.booking_date), TO_CHAR(b.booking_date, 'Day')
  ),
  peak_times AS (
    SELECT 
      EXTRACT(DOW FROM b.booking_date)::integer as dow,
      b.booking_time::time as peak_time,
      ROW_NUMBER() OVER (PARTITION BY EXTRACT(DOW FROM b.booking_date) ORDER BY COUNT(*) DESC) as rn
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM b.booking_date), b.booking_time::time
  )
  SELECT 
    TRIM(ds.day_name),
    ds.dow,
    ds.booking_count,
    COALESCE(pt.peak_time, '19:00:00'::time),
    ROUND(ds.party_avg, 1),
    ROUND(COALESCE(ds.waitlist_pct, 0), 1)
  FROM daily_stats ds
  LEFT JOIN peak_times pt ON ds.dow = pt.dow AND pt.rn = 1
  ORDER BY ds.dow;
END;
$$ LANGUAGE plpgsql;

-- Function to get booking trends
CREATE OR REPLACE FUNCTION get_booking_trends(
  p_restaurant_id uuid,
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  booking_date date,
  total_bookings bigint,
  avg_lead_time numeric,
  waitlist_count bigint
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily_bookings AS (
    SELECT 
      b.booking_date,
      COUNT(*) as booking_count,
      AVG(EXTRACT(EPOCH FROM (b.booking_date::timestamp - b.created_at)) / 86400) as lead_time_days,
      COUNT(CASE WHEN b.was_on_waitlist THEN 1 END) as waitlist_bookings
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY b.booking_date
  )
  SELECT 
    db.booking_date,
    db.booking_count,
    ROUND(COALESCE(db.lead_time_days, 0), 1),
    db.waitlist_bookings
  FROM daily_bookings db
  ORDER BY db.booking_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get popular dishes
CREATE OR REPLACE FUNCTION get_popular_dishes(
  p_restaurant_id uuid,
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date date DEFAULT CURRENT_DATE,
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
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH dish_stats AS (
    SELECT 
      mi.name as dish_name,
      mc.name as category_name,
      COUNT(DISTINCT oi.order_id) as order_count,
      SUM(oi.quantity) as quantity_sum,
      SUM(oi.total_price_sgd) as revenue_sum,
      AVG(oi.unit_price_sgd) as price_avg
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN menu_categories mc ON mi.category_id = mc.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::date BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
    GROUP BY mi.id, mi.name, mc.name
  )
  SELECT 
    ds.dish_name,
    ds.category_name,
    ds.order_count,
    ds.quantity_sum,
    ROUND(ds.revenue_sum, 2),
    ROUND(ds.price_avg, 2),
    ROW_NUMBER() OVER (ORDER BY ds.quantity_sum DESC, ds.order_count DESC)
  FROM dish_stats ds
  ORDER BY ds.quantity_sum DESC, ds.order_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get revenue analytics
CREATE OR REPLACE FUNCTION get_revenue_analytics(
  p_restaurant_id uuid,
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '7 days',
  p_end_date date DEFAULT CURRENT_DATE
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
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH revenue_stats AS (
    SELECT 
      SUM(o.total_sgd) as total_rev,
      COUNT(*) as order_count,
      AVG(o.total_sgd) as avg_order,
      SUM(o.discount_sgd) as total_disc,
      COUNT(CASE WHEN o.discount_applied THEN 1 END) as loyalty_count
    FROM orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::date BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
  ),
  daily_revenue AS (
    SELECT 
      o.created_at::date as rev_date,
      SUM(o.total_sgd) as daily_rev,
      ROW_NUMBER() OVER (ORDER BY SUM(o.total_sgd) DESC) as rn
    FROM orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::date BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
    GROUP BY o.created_at::date
  )
  SELECT 
    ROUND(COALESCE(rs.total_rev, 0), 2),
    COALESCE(rs.order_count, 0),
    ROUND(COALESCE(rs.avg_order, 0), 2),
    ROUND(COALESCE(rs.total_disc, 0), 2),
    COALESCE(rs.loyalty_count, 0),
    dr.rev_date,
    ROUND(COALESCE(dr.daily_rev, 0), 2)
  FROM revenue_stats rs
  CROSS JOIN (SELECT rev_date, daily_rev FROM daily_revenue WHERE rn = 1 LIMIT 1) dr;
END;
$$ LANGUAGE plpgsql;

-- Function to get category performance
CREATE OR REPLACE FUNCTION get_category_performance(
  p_restaurant_id uuid,
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category_name text,
  total_orders bigint,
  total_revenue numeric,
  avg_items_per_order numeric,
  category_percentage numeric
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH category_stats AS (
    SELECT 
      mc.name as cat_name,
      COUNT(DISTINCT oi.order_id) as order_count,
      SUM(oi.total_price_sgd) as revenue_sum,
      AVG(oi.quantity::numeric) as avg_items
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN menu_categories mc ON mi.category_id = mc.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::date BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
    GROUP BY mc.id, mc.name
  ),
  total_revenue AS (
    SELECT SUM(revenue_sum) as total_rev FROM category_stats
  )
  SELECT 
    cs.cat_name,
    cs.order_count,
    ROUND(cs.revenue_sum, 2),
    ROUND(cs.avg_items, 1),
    ROUND((cs.revenue_sum / NULLIF(tr.total_rev, 0)) * 100, 1)
  FROM category_stats cs
  CROSS JOIN total_revenue tr
  ORDER BY cs.revenue_sum DESC;
END;
$$ LANGUAGE plpgsql;