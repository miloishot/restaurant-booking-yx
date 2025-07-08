/*
  # Sample Booking Data for Trend Analytics

  This migration creates comprehensive sample booking data to populate trend analytics:
  
  1. Sample Data Created
     - 30 days of booking history with realistic patterns
     - Weekend vs weekday variations
     - Peak hour distributions
     - Various booking statuses and party sizes
     - Waitlist entries for high-demand periods
     - Order data with menu items and revenue
     
  2. Data Patterns
     - Higher booking volumes on weekends
     - Peak dinner hours (6-8 PM)
     - Lunch rush (12-2 PM) 
     - Seasonal variations
     - Realistic lead times for bookings
     
  3. Analytics Support
     - Time slot analytics
     - Daily trends
     - Revenue patterns
     - Popular dish tracking
     - Category performance
*/

-- Only create sample data if no recent bookings exist
DO $$
DECLARE
  restaurant_record RECORD;
  customer_record RECORD;
  table_record RECORD;
  category_record RECORD;
  menu_item_record RECORD;
  booking_id UUID;
  session_id UUID;
  order_id UUID;
  current_date_iter DATE;
  booking_time TIME;
  party_size INTEGER;
  booking_status TEXT;
  order_number TEXT;
  days_back INTEGER;
  hour_slot INTEGER;
  minute_slot INTEGER;
  booking_count INTEGER;
  weekend_multiplier NUMERIC;
  peak_hour_multiplier NUMERIC;
  random_factor NUMERIC;
  lead_time_days INTEGER;
  booking_created_at TIMESTAMP;
  should_create_order BOOLEAN;
  order_total NUMERIC;
  discount_amount NUMERIC;
  loyalty_applied BOOLEAN;
  item_count INTEGER;
  selected_items UUID[];
  item_id UUID;
  item_price NUMERIC;
  item_quantity INTEGER;
  existing_bookings INTEGER;
BEGIN
  -- Check if we already have recent booking data
  SELECT COUNT(*) INTO existing_bookings
  FROM bookings 
  WHERE booking_date >= CURRENT_DATE - INTERVAL '30 days';
  
  IF existing_bookings > 50 THEN
    RAISE NOTICE 'Sample booking data already exists (% bookings found). Skipping creation.', existing_bookings;
    RETURN;
  END IF;

  RAISE NOTICE 'Creating comprehensive sample booking data for trend analytics...';

  -- Get the first restaurant (or create one if none exists)
  SELECT * INTO restaurant_record FROM restaurants LIMIT 1;
  
  IF restaurant_record IS NULL THEN
    RAISE NOTICE 'No restaurant found. Creating sample restaurant...';
    INSERT INTO restaurants (name, slug, address, phone, email, time_slot_duration_minutes)
    VALUES ('Sample Restaurant', 'sample-restaurant', '123 Main Street', '+65 6123 4567', 'info@sample.com', 15)
    RETURNING * INTO restaurant_record;
  END IF;

  -- Ensure we have tables
  IF NOT EXISTS (SELECT 1 FROM restaurant_tables WHERE restaurant_id = restaurant_record.id) THEN
    RAISE NOTICE 'Creating sample tables...';
    FOR i IN 1..12 LOOP
      INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status)
      VALUES (restaurant_record.id, i::TEXT, 
        CASE 
          WHEN i <= 6 THEN 2 
          WHEN i <= 10 THEN 4 
          ELSE 6 
        END, 
        'available');
    END LOOP;
  END IF;

  -- Ensure we have menu categories and items
  IF NOT EXISTS (SELECT 1 FROM menu_categories WHERE restaurant_id = restaurant_record.id) THEN
    RAISE NOTICE 'Creating sample menu...';
    
    -- Create categories
    INSERT INTO menu_categories (restaurant_id, name, description, display_order, is_active) VALUES
    (restaurant_record.id, 'Appetizers', 'Start your meal with our delicious appetizers', 1, true),
    (restaurant_record.id, 'Main Courses', 'Hearty and satisfying main dishes', 2, true),
    (restaurant_record.id, 'Desserts', 'Sweet endings to your meal', 3, true),
    (restaurant_record.id, 'Beverages', 'Refreshing drinks and cocktails', 4, true),
    (restaurant_record.id, 'Salads', 'Fresh and healthy salad options', 5, true);

    -- Create menu items for each category
    FOR category_record IN SELECT * FROM menu_categories WHERE restaurant_id = restaurant_record.id LOOP
      CASE category_record.name
        WHEN 'Appetizers' THEN
          INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order) VALUES
          (restaurant_record.id, category_record.id, 'Crispy Calamari', 'Fresh squid rings with marinara sauce', 18.90, true, 1),
          (restaurant_record.id, category_record.id, 'Truffle Arancini', 'Risotto balls with truffle oil', 22.50, true, 2),
          (restaurant_record.id, category_record.id, 'Beef Carpaccio', 'Thinly sliced raw beef with capers', 26.80, true, 3),
          (restaurant_record.id, category_record.id, 'Burrata Cheese', 'Creamy cheese with tomatoes', 24.90, true, 4),
          (restaurant_record.id, category_record.id, 'Oysters (6pc)', 'Fresh Pacific oysters', 32.00, true, 5);
          
        WHEN 'Main Courses' THEN
          INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order) VALUES
          (restaurant_record.id, category_record.id, 'Wagyu Ribeye', 'Premium wagyu beef steak', 89.90, true, 1),
          (restaurant_record.id, category_record.id, 'Lobster Thermidor', 'Whole lobster in cream sauce', 78.50, true, 2),
          (restaurant_record.id, category_record.id, 'Duck Confit', 'Slow-cooked duck leg with orange glaze', 45.80, true, 3),
          (restaurant_record.id, category_record.id, 'Seafood Paella', 'Traditional Spanish rice dish', 52.90, true, 4),
          (restaurant_record.id, category_record.id, 'Lamb Rack', 'Herb-crusted lamb with rosemary', 58.60, true, 5),
          (restaurant_record.id, category_record.id, 'Salmon Teriyaki', 'Grilled salmon with teriyaki glaze', 38.90, true, 6);
          
        WHEN 'Desserts' THEN
          INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order) VALUES
          (restaurant_record.id, category_record.id, 'Chocolate Lava Cake', 'Warm chocolate cake with molten center', 16.90, true, 1),
          (restaurant_record.id, category_record.id, 'Tiramisu', 'Classic Italian coffee-flavored dessert', 14.50, true, 2),
          (restaurant_record.id, category_record.id, 'Crème Brûlée', 'Vanilla custard with caramelized sugar', 15.80, true, 3),
          (restaurant_record.id, category_record.id, 'Gelato Selection', 'Three scoops of artisan gelato', 12.90, true, 4);
          
        WHEN 'Beverages' THEN
          INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order) VALUES
          (restaurant_record.id, category_record.id, 'House Wine (Glass)', 'Red or white wine selection', 12.00, true, 1),
          (restaurant_record.id, category_record.id, 'Craft Beer', 'Local brewery selection', 8.50, true, 2),
          (restaurant_record.id, category_record.id, 'Signature Cocktail', 'Bartender special creation', 18.90, true, 3),
          (restaurant_record.id, category_record.id, 'Fresh Juice', 'Orange, apple, or mixed fruit', 6.80, true, 4),
          (restaurant_record.id, category_record.id, 'Espresso', 'Italian-style coffee', 4.50, true, 5);
          
        WHEN 'Salads' THEN
          INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order) VALUES
          (restaurant_record.id, category_record.id, 'Caesar Salad', 'Romaine lettuce with parmesan and croutons', 19.90, true, 1),
          (restaurant_record.id, category_record.id, 'Greek Salad', 'Tomatoes, olives, feta cheese', 17.50, true, 2),
          (restaurant_record.id, category_record.id, 'Quinoa Bowl', 'Superfood salad with avocado', 21.80, true, 3);
      END CASE;
    END LOOP;
  END IF;

  -- Create sample customers if needed
  IF NOT EXISTS (SELECT 1 FROM customers LIMIT 1) THEN
    RAISE NOTICE 'Creating sample customers...';
    INSERT INTO customers (name, email, phone) VALUES
    ('John Smith', 'john.smith@email.com', '+65 9123 4567'),
    ('Sarah Johnson', 'sarah.j@email.com', '+65 9234 5678'),
    ('Michael Chen', 'michael.chen@email.com', '+65 9345 6789'),
    ('Emily Wong', 'emily.wong@email.com', '+65 9456 7890'),
    ('David Lee', 'david.lee@email.com', '+65 9567 8901'),
    ('Lisa Tan', 'lisa.tan@email.com', '+65 9678 9012'),
    ('Robert Kim', 'robert.kim@email.com', '+65 9789 0123'),
    ('Jennifer Liu', 'jennifer.liu@email.com', '+65 9890 1234'),
    ('Mark Brown', 'mark.brown@email.com', '+65 9901 2345'),
    ('Amanda Davis', 'amanda.davis@email.com', '+65 9012 3456'),
    ('Kevin Zhang', 'kevin.zhang@email.com', '+65 9123 4567'),
    ('Rachel Green', 'rachel.green@email.com', '+65 9234 5678'),
    ('Steven Lim', 'steven.lim@email.com', '+65 9345 6789'),
    ('Michelle Ng', 'michelle.ng@email.com', '+65 9456 7890'),
    ('Daniel Park', 'daniel.park@email.com', '+65 9567 8901');
  END IF;

  -- Create loyalty users
  IF NOT EXISTS (SELECT 1 FROM loyalty_users WHERE restaurant_id = restaurant_record.id) THEN
    RAISE NOTICE 'Creating sample loyalty users...';
    INSERT INTO loyalty_users (restaurant_id, user_id, name, email, phone, total_spent_sgd, order_count, discount_eligible)
    SELECT 
      restaurant_record.id,
      'user_' || generate_random_uuid()::TEXT,
      c.name,
      c.email,
      c.phone,
      (random() * 500 + 100)::NUMERIC(10,2),
      (random() * 20 + 5)::INTEGER,
      (random() * 500 + 100) >= 100
    FROM customers c
    ORDER BY random()
    LIMIT 10;
  END IF;

  RAISE NOTICE 'Generating 30 days of booking data with realistic patterns...';

  -- Generate bookings for the last 30 days
  FOR days_back IN 0..29 LOOP
    current_date_iter := CURRENT_DATE - days_back;
    
    -- Weekend multiplier (Friday, Saturday, Sunday get more bookings)
    weekend_multiplier := CASE EXTRACT(DOW FROM current_date_iter)
      WHEN 0 THEN 1.8  -- Sunday
      WHEN 5 THEN 1.6  -- Friday  
      WHEN 6 THEN 2.0  -- Saturday
      ELSE 1.0         -- Weekdays
    END;
    
    -- Generate bookings for different time slots throughout the day
    FOR hour_slot IN 11..22 LOOP  -- 11 AM to 10 PM
      FOR minute_slot IN 0..3 LOOP  -- Every 15 minutes
        booking_time := (hour_slot || ':' || (minute_slot * 15)::TEXT || ':00')::TIME;
        
        -- Peak hour multiplier
        peak_hour_multiplier := CASE 
          WHEN hour_slot BETWEEN 12 AND 14 THEN 1.5  -- Lunch rush
          WHEN hour_slot BETWEEN 18 AND 20 THEN 2.0  -- Dinner rush
          WHEN hour_slot BETWEEN 21 AND 22 THEN 0.7  -- Late evening
          ELSE 1.0
        END;
        
        -- Random factor for natural variation
        random_factor := 0.5 + random();
        
        -- Calculate number of bookings for this slot
        booking_count := FLOOR(weekend_multiplier * peak_hour_multiplier * random_factor * 2)::INTEGER;
        
        -- Create bookings for this time slot
        FOR i IN 1..booking_count LOOP
          -- Random customer
          SELECT * INTO customer_record FROM customers ORDER BY random() LIMIT 1;
          
          -- Random table
          SELECT * INTO table_record FROM restaurant_tables 
          WHERE restaurant_id = restaurant_record.id 
          ORDER BY random() LIMIT 1;
          
          -- Random party size (weighted towards smaller groups)
          party_size := CASE 
            WHEN random() < 0.4 THEN 2
            WHEN random() < 0.7 THEN 4
            WHEN random() < 0.9 THEN 3
            ELSE (random() * 4 + 2)::INTEGER
          END;
          
          -- Booking status (most confirmed, some cancelled/no-show)
          booking_status := CASE 
            WHEN random() < 0.85 THEN 'completed'
            WHEN random() < 0.95 THEN 'confirmed'
            WHEN random() < 0.98 THEN 'cancelled'
            ELSE 'no_show'
          END;
          
          -- Lead time (how far in advance booking was made)
          lead_time_days := CASE
            WHEN random() < 0.3 THEN 0  -- Same day
            WHEN random() < 0.6 THEN 1  -- Next day
            WHEN random() < 0.8 THEN (random() * 7)::INTEGER  -- Within a week
            ELSE (random() * 30)::INTEGER  -- Up to a month
          END;
          
          booking_created_at := (current_date_iter - lead_time_days)::TIMESTAMP + 
                               (random() * INTERVAL '24 hours');
          
          -- Create the booking
          INSERT INTO bookings (
            restaurant_id, table_id, customer_id, booking_date, booking_time,
            party_size, status, notes, is_walk_in, assignment_method, 
            was_on_waitlist, created_at, updated_at
          ) VALUES (
            restaurant_record.id, table_record.id, customer_record.id, 
            current_date_iter, booking_time, party_size, booking_status,
            CASE WHEN random() < 0.2 THEN 'Special dietary requirements' ELSE NULL END,
            random() < 0.15,  -- 15% walk-ins
            'auto',
            random() < 0.1,   -- 10% from waitlist
            booking_created_at,
            booking_created_at + INTERVAL '1 hour'
          ) RETURNING id INTO booking_id;
          
          -- Create order session and orders for completed bookings
          should_create_order := booking_status = 'completed' AND random() < 0.8;  -- 80% of completed bookings have orders
          
          IF should_create_order THEN
            -- Create order session
            INSERT INTO order_sessions (
              restaurant_id, table_id, booking_id, session_token, is_active, created_at, updated_at
            ) VALUES (
              restaurant_record.id, table_record.id, booking_id, 
              'session_' || generate_random_uuid()::TEXT, false,
              booking_created_at + INTERVAL '2 hours',
              booking_created_at + INTERVAL '4 hours'
            ) RETURNING id INTO session_id;
            
            -- Generate order number
            order_number := 'ORD' || TO_CHAR(current_date_iter, 'YYYYMMDD') || 
                           LPAD((random() * 999)::TEXT, 3, '0');
            
            -- Determine if loyalty discount applies
            loyalty_applied := random() < 0.2;  -- 20% of orders get loyalty discount
            
            -- Create order
            INSERT INTO orders (
              restaurant_id, session_id, order_number, 
              subtotal_sgd, discount_sgd, total_sgd, discount_applied,
              triggering_user_id, status, created_at, updated_at
            ) VALUES (
              restaurant_record.id, session_id, order_number,
              0, 0, 0, loyalty_applied,
              CASE WHEN loyalty_applied THEN 'user_' || generate_random_uuid()::TEXT ELSE NULL END,
              'paid',
              booking_created_at + INTERVAL '2 hours',
              booking_created_at + INTERVAL '3 hours'
            ) RETURNING id INTO order_id;
            
            -- Add order items
            order_total := 0;
            item_count := (random() * 4 + 1)::INTEGER;  -- 1-5 items per order
            
            -- Select random menu items
            SELECT ARRAY_AGG(id) INTO selected_items 
            FROM (
              SELECT id FROM menu_items 
              WHERE restaurant_id = restaurant_record.id 
              ORDER BY random() 
              LIMIT item_count
            ) items;
            
            -- Create order items
            FOREACH item_id IN ARRAY selected_items LOOP
              SELECT price_sgd INTO item_price FROM menu_items WHERE id = item_id;
              item_quantity := (random() * 2 + 1)::INTEGER;  -- 1-3 quantity
              
              INSERT INTO order_items (
                order_id, menu_item_id, quantity, unit_price_sgd, 
                total_price_sgd, special_instructions, created_at
              ) VALUES (
                order_id, item_id, item_quantity, item_price,
                item_price * item_quantity,
                CASE WHEN random() < 0.1 THEN 'Extra spicy' ELSE NULL END,
                booking_created_at + INTERVAL '2 hours'
              );
              
              order_total := order_total + (item_price * item_quantity);
            END LOOP;
            
            -- Calculate discount
            discount_amount := CASE WHEN loyalty_applied THEN order_total * 0.1 ELSE 0 END;
            
            -- Update order totals
            UPDATE orders SET 
              subtotal_sgd = order_total,
              discount_sgd = discount_amount,
              total_sgd = order_total - discount_amount
            WHERE id = order_id;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;
    
    -- Add some waitlist entries for peak times
    IF EXTRACT(DOW FROM current_date_iter) IN (5, 6, 0) THEN  -- Weekend
      FOR i IN 1..(random() * 5 + 2)::INTEGER LOOP
        SELECT * INTO customer_record FROM customers ORDER BY random() LIMIT 1;
        
        INSERT INTO waiting_list (
          restaurant_id, customer_id, requested_date, requested_time,
          party_size, status, priority_order, notes, created_at, updated_at
        ) VALUES (
          restaurant_record.id, customer_record.id, current_date_iter,
          ('19:' || (random() * 60)::INTEGER::TEXT || ':00')::TIME,
          (random() * 4 + 2)::INTEGER,
          CASE WHEN random() < 0.7 THEN 'confirmed' ELSE 'waiting' END,
          i,
          'Peak time waitlist',
          current_date_iter::TIMESTAMP + (random() * INTERVAL '12 hours'),
          current_date_iter::TIMESTAMP + (random() * INTERVAL '24 hours')
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Update loyalty user spending based on orders
  UPDATE loyalty_users lu SET 
    total_spent_sgd = COALESCE((
      SELECT SUM(o.total_sgd) 
      FROM orders o 
      WHERE o.triggering_user_id = lu.user_id
    ), lu.total_spent_sgd),
    order_count = COALESCE((
      SELECT COUNT(*) 
      FROM orders o 
      WHERE o.triggering_user_id = lu.user_id
    ), lu.order_count),
    discount_eligible = COALESCE((
      SELECT SUM(o.total_sgd) 
      FROM orders o 
      WHERE o.triggering_user_id = lu.user_id
    ), lu.total_spent_sgd) >= 100,
    last_order_date = COALESCE((
      SELECT MAX(o.created_at) 
      FROM orders o 
      WHERE o.triggering_user_id = lu.user_id
    ), lu.created_at)
  WHERE restaurant_id = restaurant_record.id;

  RAISE NOTICE 'Sample booking data creation completed successfully!';
  RAISE NOTICE 'Created comprehensive data for trend analytics including:';
  RAISE NOTICE '- 30 days of booking history with realistic patterns';
  RAISE NOTICE '- Weekend vs weekday variations';
  RAISE NOTICE '- Peak hour distributions (lunch & dinner rush)';
  RAISE NOTICE '- Order data with menu items and revenue tracking';
  RAISE NOTICE '- Waitlist entries for high-demand periods';
  RAISE NOTICE '- Loyalty program data with spending history';
  
END $$;