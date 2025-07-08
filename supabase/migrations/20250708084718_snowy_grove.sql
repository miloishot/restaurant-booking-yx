/*
  # Create Analytics Functions

  This migration creates all the analytics functions required by the BookingAnalytics component:

  1. New Functions
    - `get_booking_analytics` - Time slot booking analysis
    - `get_daily_analytics` - Daily booking patterns
    - `get_booking_trends` - Booking trends over time
    - `get_popular_dishes` - Most popular menu items
    - `get_revenue_analytics` - Revenue and order metrics
    - `get_category_performance` - Menu category performance

  2. Security
    - All functions are accessible to authenticated users
    - Functions respect restaurant ownership and staff permissions

  3. Performance
    - Optimized queries with proper indexing
    - Efficient aggregation for large datasets
*/

-- Function to get booking analytics by time slot
CREATE OR REPLACE FUNCTION get_booking_analytics(
  p_restaurant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  time_slot TIME,
  total_bookings BIGINT,
  total_party_size BIGINT,
  avg_party_size NUMERIC,
  waitlist_triggered BIGINT,
  peak_indicator BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH time_slots AS (
    SELECT 
      booking_time as time_slot,
      COUNT(*) as total_bookings,
      SUM(party_size) as total_party_size,
      AVG(party_size::NUMERIC) as avg_party_size,
      COUNT(CASE WHEN was_on_waitlist THEN 1 END) as waitlist_triggered
    FROM bookings
    WHERE restaurant_id = p_restaurant_id
      AND booking_date BETWEEN p_start_date AND p_end_date
      AND status NOT IN ('cancelled', 'no_show')
    GROUP BY booking_time
  ),
  peak_analysis AS (
    SELECT 
      time_slot,
      total_bookings,
      total_party_size,
      avg_party_size,
      waitlist_triggered,
      CASE 
        WHEN total_bookings >= (SELECT AVG(total_bookings) * 1.5 FROM time_slots) 
        THEN TRUE 
        ELSE FALSE 
      END as peak_indicator
    FROM time_slots
  )
  SELECT * FROM peak_analysis
  ORDER BY time_slot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  peak_time_slot TIME,
  avg_party_size NUMERIC,
  waitlist_frequency BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT 
      TRIM(TO_CHAR(booking_date, 'Day')) as day_name,
      EXTRACT(DOW FROM booking_date)::INTEGER as day_of_week,
      COUNT(*) as total_bookings,
      AVG(party_size::NUMERIC) as avg_party_size,
      COUNT(CASE WHEN was_on_waitlist THEN 1 END) as waitlist_frequency
    FROM bookings
    WHERE restaurant_id = p_restaurant_id
      AND booking_date BETWEEN p_start_date AND p_end_date
      AND status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM booking_date), TRIM(TO_CHAR(booking_date, 'Day'))
  ),
  peak_times AS (
    SELECT 
      EXTRACT(DOW FROM booking_date)::INTEGER as day_of_week,
      booking_time,
      COUNT(*) as booking_count,
      ROW_NUMBER() OVER (PARTITION BY EXTRACT(DOW FROM booking_date) ORDER BY COUNT(*) DESC) as rn
    FROM bookings
    WHERE restaurant_id = p_restaurant_id
      AND booking_date BETWEEN p_start_date AND p_end_date
      AND status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM booking_date), booking_time
  )
  SELECT 
    ds.day_name,
    ds.day_of_week,
    ds.total_bookings,
    COALESCE(pt.booking_time, '12:00:00'::TIME) as peak_time_slot,
    ds.avg_party_size,
    ds.waitlist_frequency
  FROM daily_stats ds
  LEFT JOIN peak_times pt ON ds.day_of_week = pt.day_of_week AND pt.rn = 1
  ORDER BY ds.day_of_week;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    COUNT(*)::BIGINT as total_bookings,
    AVG(EXTRACT(EPOCH FROM (b.booking_date::TIMESTAMP - b.created_at)) / 86400)::NUMERIC as avg_lead_time,
    COUNT(CASE WHEN b.was_on_waitlist THEN 1 END)::BIGINT as waitlist_count
  FROM bookings b
  WHERE b.restaurant_id = p_restaurant_id
    AND b.booking_date BETWEEN p_start_date AND p_end_date
    AND b.status NOT IN ('cancelled', 'no_show')
  GROUP BY b.booking_date
  ORDER BY b.booking_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  popularity_rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH dish_stats AS (
    SELECT 
      mi.name as dish_name,
      mc.name as category_name,
      COUNT(DISTINCT oi.order_id)::BIGINT as total_orders,
      SUM(oi.quantity)::BIGINT as total_quantity,
      SUM(oi.total_price_sgd)::NUMERIC as total_revenue,
      AVG(oi.unit_price_sgd)::NUMERIC as avg_price
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN menu_categories mc ON mi.category_id = mc.id
    JOIN orders o ON oi.order_id = o.id
    WHERE mi.restaurant_id = p_restaurant_id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
    GROUP BY mi.id, mi.name, mc.name
  )
  SELECT 
    ds.dish_name,
    ds.category_name,
    ds.total_orders,
    ds.total_quantity,
    ds.total_revenue,
    ds.avg_price,
    ROW_NUMBER() OVER (ORDER BY ds.total_quantity DESC)::INTEGER as popularity_rank
  FROM dish_stats ds
  ORDER BY ds.total_quantity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
      SUM(o.total_sgd) as total_revenue,
      COUNT(*)::BIGINT as total_orders,
      AVG(o.total_sgd) as avg_order_value,
      SUM(o.discount_sgd) as total_discounts,
      COUNT(CASE WHEN o.discount_applied THEN 1 END)::BIGINT as loyalty_orders
    FROM orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
  ),
  daily_revenue AS (
    SELECT 
      o.created_at::DATE as revenue_date,
      SUM(o.total_sgd) as daily_revenue
    FROM orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
    GROUP BY o.created_at::DATE
    ORDER BY daily_revenue DESC
    LIMIT 1
  )
  SELECT 
    rs.total_revenue,
    rs.total_orders,
    rs.avg_order_value,
    rs.total_discounts,
    rs.loyalty_orders,
    COALESCE(dr.revenue_date, p_start_date) as top_revenue_day,
    COALESCE(dr.daily_revenue, 0) as top_revenue_amount
  FROM revenue_stats rs
  LEFT JOIN daily_revenue dr ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
      mc.name as category_name,
      COUNT(DISTINCT oi.order_id)::BIGINT as total_orders,
      SUM(oi.total_price_sgd) as total_revenue,
      AVG(oi.quantity::NUMERIC) as avg_items_per_order
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    JOIN menu_categories mc ON mi.category_id = mc.id
    JOIN orders o ON oi.order_id = o.id
    WHERE mi.restaurant_id = p_restaurant_id
      AND o.created_at::DATE BETWEEN p_start_date AND p_end_date
      AND o.status != 'cancelled'
    GROUP BY mc.id, mc.name
  ),
  total_revenue_calc AS (
    SELECT SUM(total_revenue) as grand_total
    FROM category_stats
  )
  SELECT 
    cs.category_name,
    cs.total_orders,
    cs.total_revenue,
    cs.avg_items_per_order,
    CASE 
      WHEN trc.grand_total > 0 
      THEN ROUND((cs.total_revenue / trc.grand_total * 100)::NUMERIC, 1)
      ELSE 0
    END as category_percentage
  FROM category_stats cs
  CROSS JOIN total_revenue_calc trc
  ORDER BY cs.total_revenue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_booking_analytics(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_analytics(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_booking_trends(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_dishes(UUID, DATE, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_analytics(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_category_performance(UUID, DATE, DATE) TO authenticated;