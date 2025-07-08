/*
  # Add sample menu data for restaurant

  1. Sample Menu Categories
    - Appetizers
    - Main Courses  
    - Desserts
    - Beverages

  2. Sample Menu Items
    - Various dishes with prices, descriptions, and dietary info
    - Realistic pricing in SGD
    - Proper allergen and dietary information

  3. Data Setup
    - Creates categories first
    - Then creates menu items linked to categories
    - Uses the first restaurant in the system
*/

-- Get the first restaurant ID (assuming there's at least one restaurant)
DO $$
DECLARE
    restaurant_uuid UUID;
    appetizers_id UUID;
    mains_id UUID;
    desserts_id UUID;
    beverages_id UUID;
BEGIN
    -- Get the first restaurant
    SELECT id INTO restaurant_uuid FROM restaurants LIMIT 1;
    
    IF restaurant_uuid IS NOT NULL THEN
        -- Insert menu categories
        INSERT INTO menu_categories (id, restaurant_id, name, description, display_order, is_active) VALUES
        (gen_random_uuid(), restaurant_uuid, 'Appetizers', 'Start your meal with our delicious appetizers', 1, true),
        (gen_random_uuid(), restaurant_uuid, 'Main Courses', 'Hearty and satisfying main dishes', 2, true),
        (gen_random_uuid(), restaurant_uuid, 'Desserts', 'Sweet endings to your perfect meal', 3, true),
        (gen_random_uuid(), restaurant_uuid, 'Beverages', 'Refreshing drinks and specialty beverages', 4, true);

        -- Get category IDs
        SELECT id INTO appetizers_id FROM menu_categories WHERE restaurant_id = restaurant_uuid AND name = 'Appetizers';
        SELECT id INTO mains_id FROM menu_categories WHERE restaurant_id = restaurant_uuid AND name = 'Main Courses';
        SELECT id INTO desserts_id FROM menu_categories WHERE restaurant_id = restaurant_uuid AND name = 'Desserts';
        SELECT id INTO beverages_id FROM menu_categories WHERE restaurant_id = restaurant_uuid AND name = 'Beverages';

        -- Insert appetizers
        INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order, allergens, dietary_info) VALUES
        (restaurant_uuid, appetizers_id, 'Crispy Calamari Rings', 'Fresh squid rings served with tangy marinara sauce and lemon wedges', 16.90, true, 1, ARRAY['shellfish'], ARRAY[]::text[]),
        (restaurant_uuid, appetizers_id, 'Truffle Mushroom Bruschetta', 'Toasted sourdough topped with sautéed mushrooms, truffle oil, and fresh herbs', 14.50, true, 2, ARRAY['gluten'], ARRAY['vegetarian']),
        (restaurant_uuid, appetizers_id, 'Buffalo Chicken Wings', 'Spicy buffalo wings served with celery sticks and blue cheese dip', 18.90, true, 3, ARRAY['dairy'], ARRAY[]::text[]),
        (restaurant_uuid, appetizers_id, 'Avocado Toast', 'Smashed avocado on multigrain bread with cherry tomatoes and feta cheese', 12.90, true, 4, ARRAY['gluten', 'dairy'], ARRAY['vegetarian']);

        -- Insert main courses
        INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order, allergens, dietary_info) VALUES
        (restaurant_uuid, mains_id, 'Grilled Atlantic Salmon', 'Fresh salmon fillet with lemon herb butter, served with roasted vegetables and quinoa', 28.90, true, 1, ARRAY['fish'], ARRAY['gluten-free']),
        (restaurant_uuid, mains_id, 'Wagyu Beef Ribeye', 'Premium 300g wagyu ribeye steak with garlic mashed potatoes and seasonal vegetables', 65.00, true, 2, ARRAY['dairy'], ARRAY[]::text[]),
        (restaurant_uuid, mains_id, 'Chicken Parmigiana', 'Breaded chicken breast topped with marinara sauce and melted mozzarella, served with pasta', 24.90, true, 3, ARRAY['gluten', 'dairy'], ARRAY[]::text[]),
        (restaurant_uuid, mains_id, 'Vegetarian Buddha Bowl', 'Quinoa bowl with roasted vegetables, chickpeas, avocado, and tahini dressing', 19.90, true, 4, ARRAY['sesame'], ARRAY['vegetarian', 'vegan', 'gluten-free']),
        (restaurant_uuid, mains_id, 'Seafood Linguine', 'Fresh prawns, scallops, and mussels in white wine garlic sauce with linguine pasta', 32.90, true, 5, ARRAY['shellfish', 'gluten'], ARRAY[]::text[]),
        (restaurant_uuid, mains_id, 'BBQ Pork Ribs', 'Slow-cooked pork ribs with house BBQ sauce, coleslaw, and sweet potato fries', 29.90, true, 6, ARRAY[], ARRAY[]::text[]);

        -- Insert desserts
        INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order, allergens, dietary_info) VALUES
        (restaurant_uuid, desserts_id, 'Chocolate Lava Cake', 'Warm chocolate cake with molten center, served with vanilla ice cream', 12.90, true, 1, ARRAY['gluten', 'dairy', 'eggs'], ARRAY[]::text[]),
        (restaurant_uuid, desserts_id, 'Tiramisu', 'Classic Italian dessert with coffee-soaked ladyfingers and mascarpone cream', 10.90, true, 2, ARRAY['gluten', 'dairy', 'eggs'], ARRAY[]::text[]),
        (restaurant_uuid, desserts_id, 'Mango Sticky Rice', 'Traditional Thai dessert with sweet coconut milk and fresh mango slices', 8.90, true, 3, ARRAY[], ARRAY['vegan', 'gluten-free']),
        (restaurant_uuid, desserts_id, 'New York Cheesecake', 'Rich and creamy cheesecake with berry compote and graham cracker crust', 11.90, true, 4, ARRAY['gluten', 'dairy', 'eggs'], ARRAY[]::text[]);

        -- Insert beverages
        INSERT INTO menu_items (restaurant_id, category_id, name, description, price_sgd, is_available, display_order, allergens, dietary_info) VALUES
        (restaurant_uuid, beverages_id, 'Fresh Orange Juice', 'Freshly squeezed orange juice', 6.90, true, 1, ARRAY[], ARRAY['vegan', 'gluten-free']),
        (restaurant_uuid, beverages_id, 'Iced Lemon Tea', 'Refreshing iced tea with fresh lemon and mint', 4.90, true, 2, ARRAY[], ARRAY['vegan', 'gluten-free']),
        (restaurant_uuid, beverages_id, 'Cappuccino', 'Rich espresso with steamed milk and foam art', 5.90, true, 3, ARRAY['dairy'], ARRAY[]::text[]),
        (restaurant_uuid, beverages_id, 'Craft Beer', 'Local craft beer selection (ask server for available options)', 8.90, true, 4, ARRAY['gluten'], ARRAY[]::text[]),
        (restaurant_uuid, beverages_id, 'House Wine', 'Red or white wine by the glass', 12.90, true, 5, ARRAY[], ARRAY[]::text[]),
        (restaurant_uuid, beverages_id, 'Coconut Water', 'Fresh young coconut water', 5.90, true, 6, ARRAY[], ARRAY['vegan', 'gluten-free']);

        RAISE NOTICE 'Sample menu data inserted successfully for restaurant %', restaurant_uuid;
    ELSE
        RAISE NOTICE 'No restaurant found. Please create a restaurant first.';
    END IF;
END $$;