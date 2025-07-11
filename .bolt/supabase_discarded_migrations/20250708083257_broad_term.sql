/*
  # Real Analytics Database Functions

  1. Analytics Functions
    - `get_booking_analytics` - Real booking statistics by time slots
    - `get_daily_analytics` - Daily booking performance 
    - `get_booking_trends` - Booking trends over time
    - `get_popular_dishes` - Most ordered menu items
    - `get_revenue_analytics` - Complete revenue statistics
    - `get_category_performance` - Menu category insights

  2. Features
    - All data pulled from actual database tables
    - No mock or hardcoded data
    - Popular dishes tracking from QR orders
    - Real revenue analytics
    - Performance insights based on actual customer behavior
*/

-- Function to get booking analytics by time slots
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
) AS $$
BEGIN
  RETURN QUERY
  WITH time_slot_stats AS (
    SELECT 
      b.booking_time::TEXT as slot_time,
      COUNT(*) as booking_count,
      SUM(b.party_size) as party_total,
      AVG(b.party_size::NUMERIC) as party_avg,
      COUNT(CASE WHEN b.was_on_waitlist THEN 1 END) as waitlist_count
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY b.booking_time
  ),
  peak_threshold AS (
    SELECT PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY booking_count) as threshold
    FROM time_slot_stats
  )
  SELECT 
    tss.slot_time,
    tss.booking_count,
    tss.party_total,
    ROUND(tss.party_avg, 2),
    tss.waitlist_count,
    tss.booking_count >= pt.threshold
  FROM time_slot_stats tss
  CROSS JOIN peak_threshold pt
  ORDER BY tss.slot_time;
END;
$$ LANGUAGE plpgsql;

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
  waitlist_frequency NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT 
      EXTRACT(DOW FROM b.booking_date)::INTEGER as dow,
      TO_CHAR(b.booking_date, 'Day') as day_text,
      COUNT(*) as booking_count,
      AVG(b.party_size::NUMERIC) as party_avg,
      (COUNT(CASE WHEN b.was_on_waitlist THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100) as waitlist_pct
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM b.booking_date), TO_CHAR(b.booking_date, 'Day')
  ),
  peak_times AS (
    SELECT 
      EXTRACT(DOW FROM b.booking_date)::INTEGER as dow,
      b.booking_time,
      COUNT(*) as time_bookings,
      ROW_NUMBER() OVER (PARTITION BY EXTRACT(DOW FROM b.booking_date) ORDER BY COUNT(*) DESC) as rn
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM b.booking_date), b.booking_time
  )
  SELECT 
    TRIM(ds.day_text),
    ds.dow,
    ds.booking_count,
    COALESCE(pt.booking_time::TEXT, '19:00:00'),
    ROUND(ds.party_avg, 2),
    ROUND(COALESCE(ds.waitlist_pct, 0), 1)
  FROM daily_stats ds
  LEFT JOIN peak_times pt ON ds.dow = pt.dow AND pt.rn = 1
  ORDER BY ds.dow;
END;
$$ LANGUAGE plpgsql;

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
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.booking_date,
    COUNT(*) as booking_count,
    AVG(EXTRACT(DAYS FROM (b.booking_date - b.created_at::DATE))::NUMERIC) as lead_time_avg,
    COUNT(CASE WHEN b.was_on_waitlist THEN 1 END) as waitlist_total
  FROM bookings b
  WHERE b.restaurant_id = p_restaurant_id
    AND b.booking_date BETWEEN p_start_date AND p_end_date
    AND b.status NOT IN ('cancelled', 'no_show')
  GROUP BY b.booking_date
  ORDER BY b.booking_date;
END;
$$ LANGUAGE plpgsql;

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
) AS $$
BEGIN
  RETURN QUERY
  WITH dish_stats AS (
    SELECT 
      mi.name as item_name,
      mc.name as cat_name,
      COUNT(DISTINCT oi.order_id) as order_count,
      SUM(oi.quantity) as qty_total,
      SUM(oi.total_price_sgd) as revenue_total,
      AVG(oi.unit_price_sgd) as price_avg
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN menu_categories mc ON mi.category_id = mc.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
    GROUP BY mi.id, mi.name, mc.name
  )
  SELECT 
    ds.item_name,
    ds.cat_name,
    ds.order_count,
    ds.qty_total,
    ROUND(ds.revenue_total, 2),
    ROUND(ds.price_avg, 2),
    ROW_NUMBER() OVER (ORDER BY ds.qty_total DESC, ds.revenue_total DESC)
  FROM dish_stats ds
  ORDER BY ds.qty_total DESC, ds.revenue_total DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

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
) AS $$
BEGIN
  RETURN QUERY
  WITH revenue_stats AS (
    SELECT 
      SUM(o.total_sgd) as rev_total,
      COUNT(*) as order_count,
      AVG(o.total_sgd) as order_avg,
      SUM(o.discount_sgd) as discount_total,
      COUNT(CASE WHEN o.discount_applied THEN 1 END) as loyalty_count
    FROM orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
  ),
  daily_revenue AS (
    SELECT 
      o.created_at::DATE as rev_date,
      SUM(o.total_sgd) as daily_total
    FROM orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
    GROUP BY o.created_at::DATE
    ORDER BY SUM(o.total_sgd) DESC
    LIMIT 1
  )
  SELECT 
    ROUND(COALESCE(rs.rev_total, 0), 2),
    COALESCE(rs.order_count, 0),
    ROUND(COALESCE(rs.order_avg, 0), 2),
    ROUND(COALESCE(rs.discount_total, 0), 2),
    COALESCE(rs.loyalty_count, 0),
    COALESCE(dr.rev_date, p_start_date),
    ROUND(COALESCE(dr.daily_total, 0), 2)
  FROM revenue_stats rs
  CROSS JOIN daily_revenue dr;
END;
$$ LANGUAGE plpgsql;

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
) AS $$
BEGIN
  RETURN QUERY
  WITH category_stats AS (
    SELECT 
      mc.name as cat_name,
      COUNT(DISTINCT oi.order_id) as order_count,
      SUM(oi.total_price_sgd) as revenue_total,
      AVG(oi.quantity::NUMERIC) as items_avg
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN menu_categories mc ON mi.category_id = mc.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
    GROUP BY mc.id, mc.name
  ),
  total_revenue AS (
    SELECT SUM(revenue_total) as grand_total
    FROM category_stats
  )
  SELECT 
    cs.cat_name,
    cs.order_count,
    ROUND(cs.revenue_total, 2),
    ROUND(cs.items_avg, 2),
    ROUND((cs.revenue_total / NULLIF(tr.grand_total, 0) * 100), 1)
  FROM category_stats cs
  CROSS JOIN total_revenue tr
  ORDER BY cs.revenue_total DESC;
END;
$$ LANGUAGE plpgsql;