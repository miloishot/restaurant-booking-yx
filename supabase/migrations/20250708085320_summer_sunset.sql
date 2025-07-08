/*
  # Create Sample Restaurant Data

  This migration creates comprehensive sample data for testing the restaurant analytics dashboard:

  1. Sample Data Created
     - 50 customers with realistic information
     - Menu structure with 5 categories and 25+ menu items
     - 150 bookings spread across the last 30 days
     - Order sessions and orders for completed bookings
     - Order items with realistic combinations
     - 30 waiting list entries
     - 20 loyalty users with spending history

  2. Data Distribution
     - Bookings across different dates, times, and party sizes
     - Various booking statuses (completed, confirmed, cancelled, etc.)
     - Orders with loyalty discounts for some customers
     - Realistic pricing and order combinations
     - Walk-ins and waitlist promotions included

  3. Purpose
     - Enables analytics dashboard to display meaningful data
     - Provides test data for charts, trends, and insights
     - Covers the last 30 days for comprehensive analytics testing
*/

DO $$
DECLARE
  restaurant_uuid UUID;
  customer_ids UUID[];
  category_ids UUID[];
  menu_item_ids UUID[];
  booking_ids UUID[];
  session_ids UUID[];
  table_ids UUID[];
  i INTEGER;
  j INTEGER;
  random_date DATE;
  random_time TIME;
  random_customer UUID;
  random_table UUID;
  random_menu_item UUID;
  random_category UUID;
  order_id UUID;
  session_id UUID;
  booking_id UUID;
BEGIN
  -- Get the first restaurant (or create one if none exists)
  SELECT id INTO restaurant_uuid FROM restaurants LIMIT 1;
  
  IF restaurant_uuid IS NULL THEN
    -- Create a sample restaurant if none exists
    INSERT INTO restaurants (name, slug, address, phone, email, time_slot_duration_minutes)
    VALUES ('Sample Restaurant', 'sample-restaurant', '123 Main St, Singapore', '+65 6123 4567', 'info@sample-restaurant.com', 15)
    RETURNING id INTO restaurant_uuid;
    
    -- Create some tables for the restaurant
    INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status)
    VALUES 
      (restaurant_uuid, '1', 2, 'available'),
      (restaurant_uuid, '2', 4, 'available'),
      (restaurant_uuid, '3', 4, 'available'),
      (restaurant_uuid, '4', 6, 'available'),
      (restaurant_uuid, '5', 8, 'available'),
      (restaurant_uuid, '6', 2, 'available'),
      (restaurant_uuid, '7', 4, 'available'),
      (restaurant_uuid, '8', 6, 'available');
  END IF;
  
  -- Get table IDs
  SELECT ARRAY(SELECT id FROM restaurant_tables WHERE restaurant_id = restaurant_uuid) INTO table_ids;
  
  -- Create sample customers (only if we don't have enough)
  IF (SELECT COUNT(*) FROM customers) < 50 THEN
    FOR i IN 1..50 LOOP
      INSERT INTO customers (name, email, phone)
      VALUES (
        CASE (i % 20)
          WHEN 0 THEN 'John Smith'
          WHEN 1 THEN 'Sarah Johnson'
          WHEN 2 THEN 'Michael Chen'
          WHEN 3 THEN 'Emily Davis'
          WHEN 4 THEN 'David Wilson'
          WHEN 5 THEN 'Lisa Anderson'
          WHEN 6 THEN 'James Brown'
          WHEN 7 THEN 'Jennifer Lee'
          WHEN 8 THEN 'Robert Taylor'
          WHEN 9 THEN 'Amanda White'
          WHEN 10 THEN 'Christopher Martin'
          WHEN 11 THEN 'Michelle Garcia'
          WHEN 12 THEN 'Daniel Rodriguez'
          WHEN 13 THEN 'Jessica Martinez'
          WHEN 14 THEN 'Matthew Hernandez'
          WHEN 15 THEN 'Ashley Lopez'
          WHEN 16 THEN 'Andrew Gonzalez'
          WHEN 17 THEN 'Stephanie Wilson'
          WHEN 18 THEN 'Joshua Anderson'
          ELSE 'Maria Thomas'
        END,
        CASE (i % 10)
          WHEN 0 THEN 'john.smith' || i || '@email.com'
          WHEN 1 THEN 'sarah.j' || i || '@gmail.com'
          WHEN 2 THEN 'mchen' || i || '@yahoo.com'
          WHEN 3 THEN 'emily.d' || i || '@hotmail.com'
          WHEN 4 THEN 'david.w' || i || '@outlook.com'
          ELSE 'customer' || i || '@email.com'
        END,
        '+65 ' || (6000 + (i * 13) % 9999)::TEXT
      );
    END LOOP;
  END IF;
  
  -- Get customer IDs
  SELECT ARRAY(SELECT id FROM customers ORDER BY created_at DESC LIMIT 50) INTO customer_ids;
  
  -- Create menu categories (only if they don't exist for this restaurant)
  IF NOT EXISTS (SELECT 1 FROM menu_categories WHERE restaurant_id = restaurant_uuid) THEN
    INSERT INTO menu_categories (restaurant_id, name, description, display_order, is_active)
    VALUES 
      (restaurant_uuid, 'Appetizers', 'Start your meal with our delicious appetizers', 1, true),
      (restaurant_uuid, 'Main Courses', 'Hearty and satisfying main dishes', 2, true),
      (restaurant_uuid, 'Desserts', 'Sweet endings to your perfect meal', 3, true),
      (restaurant_uuid, 'Beverages', 'Refreshing drinks and specialty beverages', 4, true),
      (restaurant_uuid, 'Salads', 'Fresh and healthy salad options', 5, true);
  END IF;
  
  -- Get category IDs
  SELECT ARRAY(SELECT id FROM menu_categories WHERE restaurant_id = restaurant_uuid) INTO category_ids;
  
  -- Create menu items (only if they don't exist for this restaurant)
  IF NOT EXISTS (SELECT 1 FROM menu_items WHERE restaurant_id = restaurant_uuid) THEN
    -- Appetizers
    SELECT id INTO random_category FROM menu_categories WHERE restaurant_id = restaurant_uuid AND name = 'Appetizers';
    INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order)
    VALUES 
      (restaurant_uuid, random_category, 'Crispy Calamari', 'Fresh squid rings with spicy marinara sauce', 18.90, true, 1),
      (restaurant_uuid, random_category, 'Truffle Arancini', 'Risotto balls with truffle oil and parmesan', 16.50, true, 2),
      (restaurant_uuid, random_category, 'Beef Carpaccio', 'Thinly sliced beef with rocket and parmesan', 22.00, true, 3),
      (restaurant_uuid, random_category, 'Burrata Caprese', 'Fresh burrata with tomatoes and basil', 19.80, true, 4),
      (restaurant_uuid, random_category, 'Garlic Prawns', 'Tiger prawns in garlic butter sauce', 24.50, true, 5);
    
    -- Main Courses
    SELECT id INTO random_category FROM menu_categories WHERE restaurant_id = restaurant_uuid AND name = 'Main Courses';
    INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order)
    VALUES 
      (restaurant_uuid, random_category, 'Grilled Salmon', 'Atlantic salmon with lemon herb butter', 32.00, true, 1),
      (restaurant_uuid, random_category, 'Wagyu Beef Steak', 'Premium wagyu with roasted vegetables', 68.00, true, 2),
      (restaurant_uuid, random_category, 'Lobster Thermidor', 'Fresh lobster in creamy cheese sauce', 58.00, true, 3),
      (restaurant_uuid, random_category, 'Duck Confit', 'Slow-cooked duck leg with orange glaze', 42.00, true, 4),
      (restaurant_uuid, random_category, 'Mushroom Risotto', 'Creamy arborio rice with mixed mushrooms', 28.00, true, 5),
      (restaurant_uuid, random_category, 'Chicken Parmigiana', 'Breaded chicken with tomato and mozzarella', 26.50, true, 6),
      (restaurant_uuid, random_category, 'Fish & Chips', 'Beer-battered fish with crispy fries', 24.80, true, 7),
      (restaurant_uuid, random_category, 'Lamb Rack', 'Herb-crusted lamb with mint sauce', 45.00, true, 8);
    
    -- Desserts
    SELECT id INTO random_category FROM menu_categories WHERE restaurant_id = restaurant_uuid AND name = 'Desserts';
    INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order)
    VALUES 
      (restaurant_uuid, random_category, 'Chocolate Lava Cake', 'Warm chocolate cake with vanilla ice cream', 14.50, true, 1),
      (restaurant_uuid, random_category, 'Tiramisu', 'Classic Italian coffee-flavored dessert', 12.80, true, 2),
      (restaurant_uuid, random_category, 'Crème Brûlée', 'Vanilla custard with caramelized sugar', 13.20, true, 3),
      (restaurant_uuid, random_category, 'Cheesecake', 'New York style with berry compote', 11.90, true, 4),
      (restaurant_uuid, random_category, 'Gelato Selection', 'Three scoops of artisan gelato', 9.80, true, 5);
    
    -- Beverages
    SELECT id INTO random_category FROM menu_categories WHERE restaurant_id = restaurant_uuid AND name = 'Beverages';
    INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order)
    VALUES 
      (restaurant_uuid, random_category, 'House Wine Red', 'Cabernet Sauvignon by the glass', 12.00, true, 1),
      (restaurant_uuid, random_category, 'House Wine White', 'Chardonnay by the glass', 12.00, true, 2),
      (restaurant_uuid, random_category, 'Craft Beer', 'Local brewery selection', 8.50, true, 3),
      (restaurant_uuid, random_category, 'Fresh Juice', 'Orange, apple, or mixed berry', 6.80, true, 4),
      (restaurant_uuid, random_category, 'Espresso', 'Double shot Italian espresso', 4.50, true, 5),
      (restaurant_uuid, random_category, 'Cappuccino', 'Espresso with steamed milk foam', 5.80, true, 6),
      (restaurant_uuid, random_category, 'Cocktail Special', 'Daily signature cocktail', 15.00, true, 7);
    
    -- Salads
    SELECT id INTO random_category FROM menu_categories WHERE restaurant_id = restaurant_uuid AND name = 'Salads';
    INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order)
    VALUES 
      (restaurant_uuid, random_category, 'Caesar Salad', 'Romaine lettuce with parmesan and croutons', 16.50, true, 1),
      (restaurant_uuid, random_category, 'Greek Salad', 'Mixed greens with feta and olives', 15.80, true, 2),
      (restaurant_uuid, random_category, 'Quinoa Bowl', 'Superfood salad with avocado and nuts', 18.90, true, 3),
      (restaurant_uuid, random_category, 'Asian Chicken Salad', 'Grilled chicken with sesame dressing', 19.50, true, 4);
  END IF;
  
  -- Get menu item IDs
  SELECT ARRAY(SELECT id FROM menu_items WHERE restaurant_id = restaurant_uuid) INTO menu_item_ids;
  
  -- Create sample bookings for the last 30 days (only if we don't have recent bookings)
  IF (SELECT COUNT(*) FROM bookings WHERE restaurant_id = restaurant_uuid AND booking_date >= CURRENT_DATE - INTERVAL '30 days') < 50 THEN
    FOR i IN 1..150 LOOP
      -- Random date in the last 30 days
      random_date := CURRENT_DATE - (random() * 30)::INTEGER;
      
      -- Random time between 11:00 and 22:00
      random_time := ('11:00:00'::TIME + (random() * INTERVAL '11 hours'))::TIME;
      
      -- Round to nearest 15 minutes
      random_time := (EXTRACT(EPOCH FROM random_time) / 900)::INTEGER * 900 * INTERVAL '1 second';
      
      -- Random customer
      random_customer := customer_ids[1 + (random() * (array_length(customer_ids, 1) - 1))::INTEGER];
      
      -- Random table
      random_table := table_ids[1 + (random() * (array_length(table_ids, 1) - 1))::INTEGER];
      
      INSERT INTO bookings (
        restaurant_id, 
        table_id, 
        customer_id, 
        booking_date, 
        booking_time, 
        party_size, 
        status, 
        notes, 
        is_walk_in, 
        assignment_method, 
        was_on_waitlist,
        created_at
      )
      VALUES (
        restaurant_uuid,
        random_table,
        random_customer,
        random_date,
        random_time,
        1 + (random() * 7)::INTEGER, -- Party size 1-8
        CASE (random() * 10)::INTEGER
          WHEN 0 THEN 'cancelled'
          WHEN 1 THEN 'no_show'
          WHEN 2 THEN 'pending'
          WHEN 3 THEN 'confirmed'
          ELSE 'completed'
        END,
        CASE WHEN random() < 0.3 THEN 'Special dietary requirements' ELSE NULL END,
        random() < 0.2, -- 20% walk-ins
        CASE WHEN random() < 0.1 THEN 'manual' ELSE 'auto' END,
        random() < 0.15, -- 15% from waitlist
        random_date - (random() * 7)::INTEGER -- Created 0-7 days before booking date
      );
    END LOOP;
  END IF;
  
  -- Get booking IDs for completed/seated bookings
  SELECT ARRAY(SELECT id FROM bookings WHERE restaurant_id = restaurant_uuid AND status IN ('completed', 'seated')) INTO booking_ids;
  
  -- Create order sessions for some bookings (only if we don't have many orders)
  IF (SELECT COUNT(*) FROM orders WHERE restaurant_id = restaurant_uuid) < 50 THEN
    FOR i IN 1..LEAST(array_length(booking_ids, 1), 100) LOOP
      IF random() < 0.7 THEN -- 70% of completed bookings have orders
        SELECT table_id INTO random_table FROM bookings WHERE id = booking_ids[i];
        
        INSERT INTO order_sessions (restaurant_id, table_id, booking_id, session_token, is_active)
        VALUES (
          restaurant_uuid,
          random_table,
          booking_ids[i],
          'session_' || booking_ids[i]::TEXT,
          false -- Historical sessions are inactive
        )
        RETURNING id INTO session_id;
        
        session_ids := array_append(session_ids, session_id);
      END IF;
    END LOOP;
    
    -- Create orders for the sessions
    FOR i IN 1..array_length(session_ids, 1) LOOP
      -- Create 1-3 orders per session
      FOR j IN 1..(1 + (random() * 2)::INTEGER) LOOP
        INSERT INTO orders (
          restaurant_id,
          session_id,
          order_number,
          loyalty_user_ids,
          subtotal_sgd,
          discount_sgd,
          total_sgd,
          discount_applied,
          triggering_user_id,
          status,
          notes,
          created_at
        )
        VALUES (
          restaurant_uuid,
          session_ids[i],
          'ORD' || LPAD((i * 100 + j)::TEXT, 6, '0'),
          CASE WHEN random() < 0.2 THEN ARRAY['user_' || (random() * 100)::INTEGER::TEXT] ELSE NULL END,
          20 + (random() * 80)::NUMERIC, -- Subtotal $20-100
          CASE WHEN random() < 0.2 THEN (20 + (random() * 80)::NUMERIC) * 0.1 ELSE 0 END, -- 10% discount sometimes
          0, -- Will be calculated
          random() < 0.2, -- 20% have loyalty discount
          CASE WHEN random() < 0.2 THEN 'user_' || (random() * 100)::INTEGER::TEXT ELSE NULL END,
          CASE (random() * 4)::INTEGER
            WHEN 0 THEN 'pending'
            WHEN 1 THEN 'confirmed'
            WHEN 2 THEN 'preparing'
            ELSE 'paid'
          END,
          CASE WHEN random() < 0.1 THEN 'Extra spicy please' ELSE NULL END,
          NOW() - (random() * INTERVAL '30 days')
        )
        RETURNING id INTO order_id;
        
        -- Create order items for each order
        FOR j IN 1..(2 + (random() * 4)::INTEGER) LOOP -- 2-6 items per order
          random_menu_item := menu_item_ids[1 + (random() * (array_length(menu_item_ids, 1) - 1))::INTEGER];
          
          INSERT INTO order_items (
            order_id,
            menu_item_id,
            quantity,
            unit_price_sgd,
            total_price_sgd,
            special_instructions
          )
          SELECT 
            order_id,
            random_menu_item,
            1 + (random() * 2)::INTEGER, -- Quantity 1-3
            mi.price_sgd,
            mi.price_sgd * (1 + (random() * 2)::INTEGER),
            CASE WHEN random() < 0.1 THEN 'No onions please' ELSE NULL END
          FROM menu_items mi
          WHERE mi.id = random_menu_item;
        END LOOP;
        
        -- Update order total based on items
        UPDATE orders 
        SET 
          subtotal_sgd = (
            SELECT SUM(total_price_sgd) 
            FROM order_items 
            WHERE order_id = orders.id
          ),
          total_sgd = (
            SELECT SUM(total_price_sgd) 
            FROM order_items 
            WHERE order_id = orders.id
          ) - discount_sgd
        WHERE id = order_id;
      END LOOP;
    END LOOP;
  END IF;
  
  -- Create some waiting list entries (only if we don't have many)
  IF (SELECT COUNT(*) FROM waiting_list WHERE restaurant_id = restaurant_uuid) < 20 THEN
    FOR i IN 1..30 LOOP
      random_date := CURRENT_DATE - (random() * 30)::INTEGER;
      random_time := ('11:00:00'::TIME + (random() * INTERVAL '11 hours'))::TIME;
      random_time := (EXTRACT(EPOCH FROM random_time) / 900)::INTEGER * 900 * INTERVAL '1 second';
      random_customer := customer_ids[1 + (random() * (array_length(customer_ids, 1) - 1))::INTEGER];
      
      INSERT INTO waiting_list (
        restaurant_id,
        customer_id,
        requested_date,
        requested_time,
        party_size,
        status,
        priority_order,
        notes,
        created_at
      )
      VALUES (
        restaurant_uuid,
        random_customer,
        random_date,
        random_time,
        1 + (random() * 6)::INTEGER,
        CASE (random() * 5)::INTEGER
          WHEN 0 THEN 'waiting'
          WHEN 1 THEN 'notified'
          WHEN 2 THEN 'confirmed'
          WHEN 3 THEN 'expired'
          ELSE 'cancelled'
        END,
        i,
        CASE WHEN random() < 0.2 THEN 'Celebrating anniversary' ELSE NULL END,
        random_date - (random() * 2)::INTEGER
      );
    END LOOP;
  END IF;
  
  -- Create some loyalty users (only if we don't have many)
  IF (SELECT COUNT(*) FROM loyalty_users WHERE restaurant_id = restaurant_uuid) < 10 THEN
    FOR i IN 1..20 LOOP
      INSERT INTO loyalty_users (
        restaurant_id,
        user_id,
        name,
        email,
        phone,
        total_spent_sgd,
        order_count,
        discount_eligible,
        last_order_date
      )
      SELECT 
        restaurant_uuid,
        'user_' || i::TEXT,
        c.name,
        c.email,
        c.phone,
        50 + (random() * 500)::NUMERIC, -- $50-550 spent
        5 + (random() * 20)::INTEGER, -- 5-25 orders
        random() < 0.6, -- 60% eligible for discount
        CURRENT_DATE - (random() * 60)::INTEGER
      FROM customers c
      ORDER BY random()
      LIMIT 1;
    END LOOP;
  END IF;

  RAISE NOTICE 'Sample data created successfully for restaurant: %', restaurant_uuid;
  RAISE NOTICE 'Created comprehensive test data for analytics dashboard';
  
  -- Display summary
  RAISE NOTICE 'Data Summary:';
  RAISE NOTICE '- Customers: %', (SELECT COUNT(*) FROM customers);
  RAISE NOTICE '- Bookings: %', (SELECT COUNT(*) FROM bookings WHERE restaurant_id = restaurant_uuid);
  RAISE NOTICE '- Orders: %', (SELECT COUNT(*) FROM orders WHERE restaurant_id = restaurant_uuid);
  RAISE NOTICE '- Menu Items: %', (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = restaurant_uuid);
  RAISE NOTICE '- Waiting List: %', (SELECT COUNT(*) FROM waiting_list WHERE restaurant_id = restaurant_uuid);
  RAISE NOTICE '- Loyalty Users: %', (SELECT COUNT(*) FROM loyalty_users WHERE restaurant_id = restaurant_uuid);
END;
$$;