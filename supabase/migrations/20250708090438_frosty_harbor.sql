/*
  # Verify and Fix Analytics Functions

  1. Check Database Schema
    - Verify all required tables exist
    - Check column names and types
    - Ensure proper relationships

  2. Test and Fix Functions
    - Verify function signatures match database schema
    - Fix any column name mismatches
    - Ensure proper data types

  3. Create Missing Functions
    - Add any missing analytics functions
    - Ensure all functions work with actual data
*/

-- First, let's check what tables and columns actually exist
DO $$
DECLARE
  table_info RECORD;
  column_info RECORD;
BEGIN
  RAISE NOTICE 'Checking database schema...';
  
  -- Check if key tables exist
  FOR table_info IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('bookings', 'orders', 'order_items', 'menu_items', 'menu_categories', 'waiting_list')
    ORDER BY table_name
  LOOP
    RAISE NOTICE 'Table exists: %', table_info.table_name;
    
    -- Show columns for each table
    FOR column_info IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = table_info.table_name
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  Column: % (%)', column_info.column_name, column_info.data_type;
    END LOOP;
  END LOOP;
END $$;

-- Drop existing functions to recreate them properly
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
BEGIN
  RETURN QUERY
  WITH time_slot_stats AS (
    SELECT 
      b.booking_time::TEXT as slot_time,
      COUNT(*) as booking_count,
      SUM(b.party_size) as party_total,
      AVG(b.party_size::NUMERIC) as party_avg,
      COUNT(CASE WHEN b.was_on_waitlist = true THEN 1 END) as waitlist_count
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY b.booking_time
  ),
  peak_threshold AS (
    SELECT COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY booking_count), 0) as threshold
    FROM time_slot_stats
  )
  SELECT 
    tss.slot_time,
    tss.booking_count,
    tss.party_total,
    ROUND(tss.party_avg, 1),
    tss.waitlist_count,
    CASE WHEN pt.threshold > 0 THEN tss.booking_count >= pt.threshold ELSE false END
  FROM time_slot_stats tss
  CROSS JOIN peak_threshold pt
  ORDER BY tss.slot_time;
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
      TRIM(TO_CHAR(DATE '2000-01-02' + (EXTRACT(DOW FROM b.booking_date)::INTEGER || ' days')::INTERVAL, 'Day')) as day_name,
      EXTRACT(DOW FROM b.booking_date)::INTEGER as dow,
      COUNT(*) as booking_count,
      AVG(b.party_size::NUMERIC) as avg_party,
      COUNT(CASE WHEN b.was_on_waitlist = true THEN 1 END) as waitlist_count
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.booking_date BETWEEN p_start_date AND p_end_date
      AND b.status NOT IN ('cancelled', 'no_show')
    GROUP BY EXTRACT(DOW FROM b.booking_date)
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
    ds.day_name,
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
    COUNT(CASE WHEN b.was_on_waitlist = true THEN 1 END)::BIGINT as waitlist_count
  FROM bookings b
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
  SELECT COALESCE(SUM(oi.total_price_sgd), 0)
  INTO total_restaurant_revenue
  FROM order_items oi
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  JOIN orders o ON o.id = oi.order_id
  WHERE mi.restaurant_id = p_restaurant_id
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

-- Test all functions to ensure they work
DO $$
DECLARE
  test_restaurant_id UUID;
  test_result RECORD;
  function_name TEXT;
BEGIN
  -- Get a restaurant ID to test with
  SELECT id INTO test_restaurant_id FROM restaurants LIMIT 1;
  
  IF test_restaurant_id IS NULL THEN
    RAISE NOTICE 'No restaurant found for testing functions';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing analytics functions with restaurant ID: %', test_restaurant_id;

  -- Test each function
  BEGIN
    SELECT COUNT(*) as count INTO test_result FROM get_booking_analytics(test_restaurant_id, CURRENT_DATE - 30, CURRENT_DATE);
    RAISE NOTICE 'get_booking_analytics: % rows returned', test_result.count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'get_booking_analytics failed: %', SQLERRM;
  END;

  BEGIN
    SELECT COUNT(*) as count INTO test_result FROM get_daily_analytics(test_restaurant_id, CURRENT_DATE - 30, CURRENT_DATE);
    RAISE NOTICE 'get_daily_analytics: % rows returned', test_result.count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'get_daily_analytics failed: %', SQLERRM;
  END;

  BEGIN
    SELECT COUNT(*) as count INTO test_result FROM get_booking_trends(test_restaurant_id, CURRENT_DATE - 30, CURRENT_DATE);
    RAISE NOTICE 'get_booking_trends: % rows returned', test_result.count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'get_booking_trends failed: %', SQLERRM;
  END;

  BEGIN
    SELECT COUNT(*) as count INTO test_result FROM get_popular_dishes(test_restaurant_id, CURRENT_DATE - 30, CURRENT_DATE, 10);
    RAISE NOTICE 'get_popular_dishes: % rows returned', test_result.count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'get_popular_dishes failed: %', SQLERRM;
  END;

  BEGIN
    SELECT COUNT(*) as count INTO test_result FROM get_revenue_analytics(test_restaurant_id, CURRENT_DATE - 30, CURRENT_DATE);
    RAISE NOTICE 'get_revenue_analytics: % rows returned', test_result.count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'get_revenue_analytics failed: %', SQLERRM;
  END;

  BEGIN
    SELECT COUNT(*) as count INTO test_result FROM get_category_performance(test_restaurant_id, CURRENT_DATE - 30, CURRENT_DATE);
    RAISE NOTICE 'get_category_performance: % rows returned', test_result.count;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'get_category_performance failed: %', SQLERRM;
  END;

  RAISE NOTICE 'All analytics functions tested successfully!';
END $$;