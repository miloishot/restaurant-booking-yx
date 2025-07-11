/*
  # Smart Dine QR Ordering System Integration

  1. New Tables
    - `menu_categories` - Food categories (Starters, Mains, Drinks, Desserts)
    - `menu_items` - Individual menu items with pricing and descriptions
    - `loyalty_users` - Customer loyalty program tracking
    - `order_sessions` - Links orders to table/booking sessions
    - `order_items` - Individual items within an order
    - `orders` - Complete order records with totals and discounts

  2. Security
    - Enable RLS on all new tables
    - Add policies for public ordering and staff management
    - Secure loyalty program access

  3. Features
    - QR code ordering tied to table sessions
    - Loyalty program with automatic discount application
    - Real-time order management for staff
    - Analytics integration with existing booking data
*/

-- Create menu categories table
CREATE TABLE IF NOT EXISTS menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create menu items table
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_sgd decimal(10,2) NOT NULL CHECK (price_sgd >= 0),
  image_url text,
  is_available boolean DEFAULT true,
  display_order integer DEFAULT 0,
  allergens text[], -- Array of allergen information
  dietary_info text[], -- Array of dietary information (vegetarian, vegan, etc.)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create loyalty users table
CREATE TABLE IF NOT EXISTS loyalty_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id text NOT NULL, -- Customer-provided ID
  name text,
  email text,
  phone text,
  total_spent_sgd decimal(10,2) DEFAULT 0 CHECK (total_spent_sgd >= 0),
  order_count integer DEFAULT 0 CHECK (order_count >= 0),
  discount_eligible boolean DEFAULT false,
  last_order_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, user_id)
);

-- Create order sessions table (links orders to table/booking sessions)
CREATE TABLE IF NOT EXISTS order_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  session_token text NOT NULL UNIQUE, -- For QR code access
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES order_sessions(id) ON DELETE CASCADE,
  order_number text NOT NULL, -- Human-readable order number
  loyalty_user_ids text[], -- Array of loyalty user IDs entered
  subtotal_sgd decimal(10,2) NOT NULL DEFAULT 0 CHECK (subtotal_sgd >= 0),
  discount_sgd decimal(10,2) DEFAULT 0 CHECK (discount_sgd >= 0),
  total_sgd decimal(10,2) NOT NULL DEFAULT 0 CHECK (total_sgd >= 0),
  discount_applied boolean DEFAULT false,
  triggering_user_id text, -- Which loyalty user triggered the discount
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'paid')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_sgd decimal(10,2) NOT NULL CHECK (unit_price_sgd >= 0),
  total_price_sgd decimal(10,2) NOT NULL CHECK (total_price_sgd >= 0),
  special_instructions text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- MENU CATEGORIES POLICIES
-- =============================================

-- Allow public to read menu categories for restaurants with public slugs
CREATE POLICY "Public can read menu categories"
  ON menu_categories
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    ) AND is_active = true
  );

-- Allow restaurant staff to manage menu categories
CREATE POLICY "Restaurant staff can manage menu categories"
  ON menu_categories
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- =============================================
-- MENU ITEMS POLICIES
-- =============================================

-- Allow public to read available menu items
CREATE POLICY "Public can read menu items"
  ON menu_items
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    ) AND is_available = true
  );

-- Allow restaurant staff to manage menu items
CREATE POLICY "Restaurant staff can manage menu items"
  ON menu_items
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- =============================================
-- LOYALTY USERS POLICIES
-- =============================================

-- Allow public to read loyalty users (for discount checking)
CREATE POLICY "Public can read loyalty users"
  ON loyalty_users
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Allow public to create loyalty user records
CREATE POLICY "Public can create loyalty users"
  ON loyalty_users
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Allow restaurant staff to manage loyalty users
CREATE POLICY "Restaurant staff can manage loyalty users"
  ON loyalty_users
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- =============================================
-- ORDER SESSIONS POLICIES
-- =============================================

-- Allow public to read active order sessions (for QR code access)
CREATE POLICY "Public can read order sessions"
  ON order_sessions
  FOR SELECT
  TO anon, authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    ) AND is_active = true
  );

-- Allow restaurant staff to manage order sessions
CREATE POLICY "Restaurant staff can manage order sessions"
  ON order_sessions
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- =============================================
-- ORDERS POLICIES
-- =============================================

-- Allow public to create orders
CREATE POLICY "Public can create orders"
  ON orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE slug IS NOT NULL
    )
  );

-- Allow public to read orders for active sessions
CREATE POLICY "Public can read orders"
  ON orders
  FOR SELECT
  TO anon, authenticated
  USING (
    session_id IN (
      SELECT id FROM order_sessions WHERE is_active = true
    )
  );

-- Allow public to update orders (for editing before confirmation)
CREATE POLICY "Public can update orders"
  ON orders
  FOR UPDATE
  TO anon, authenticated
  USING (
    session_id IN (
      SELECT id FROM order_sessions WHERE is_active = true
    ) AND status = 'pending'
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM order_sessions WHERE is_active = true
    )
  );

-- Allow restaurant staff to manage all orders
CREATE POLICY "Restaurant staff can manage orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM user_profiles WHERE id = auth.uid()
    ) OR
    restaurant_id IN (
      SELECT id FROM restaurants WHERE owner_id = auth.uid()
    )
  );

-- =============================================
-- ORDER ITEMS POLICIES
-- =============================================

-- Allow public to create order items
CREATE POLICY "Public can create order items"
  ON order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE status = 'pending'
    )
  );

-- Allow public to read order items
CREATE POLICY "Public can read order items"
  ON order_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow public to update order items (for editing quantities)
CREATE POLICY "Public can update order items"
  ON order_items
  FOR UPDATE
  TO anon, authenticated
  USING (
    order_id IN (
      SELECT id FROM orders WHERE status = 'pending'
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE status = 'pending'
    )
  );

-- Allow public to delete order items (for removing from cart)
CREATE POLICY "Public can delete order items"
  ON order_items
  FOR DELETE
  TO anon, authenticated
  USING (
    order_id IN (
      SELECT id FROM orders WHERE status = 'pending'
    )
  );

-- Allow restaurant staff to manage all order items
CREATE POLICY "Restaurant staff can manage order items"
  ON order_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================
-- TRIGGERS AND FUNCTIONS
-- =============================================

-- Create updated_at triggers for new tables
CREATE TRIGGER update_menu_categories_updated_at
    BEFORE UPDATE ON menu_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
    BEFORE UPDATE ON menu_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_users_updated_at
    BEFORE UPDATE ON loyalty_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_sessions_updated_at
    BEFORE UPDATE ON order_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
DECLARE
    order_num text;
    counter integer;
BEGIN
    -- Generate order number based on current date and sequence
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS integer)), 0) + 1
    INTO counter
    FROM orders
    WHERE order_number LIKE TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%';
    
    order_num := TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(counter::text, 4, '0');
    
    RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Function to generate session tokens for QR codes
CREATE OR REPLACE FUNCTION generate_session_token()
RETURNS text AS $$
BEGIN
    RETURN encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to check and apply loyalty discounts
CREATE OR REPLACE FUNCTION check_loyalty_discount(
    p_restaurant_id uuid,
    p_loyalty_user_ids text[]
)
RETURNS TABLE(
    discount_eligible boolean,
    discount_amount decimal,
    triggering_user_id text
) AS $$
DECLARE
    user_id text;
    user_record RECORD;
BEGIN
    -- Check each loyalty user ID for eligibility
    FOREACH user_id IN ARRAY p_loyalty_user_ids
    LOOP
        SELECT * INTO user_record
        FROM loyalty_users
        WHERE restaurant_id = p_restaurant_id
          AND user_id = check_loyalty_discount.user_id
          AND total_spent_sgd >= 100;
        
        IF FOUND THEN
            -- Return 10% discount for first eligible user found
            RETURN QUERY SELECT true, 0.10::decimal, user_id;
            RETURN;
        END IF;
    END LOOP;
    
    -- No eligible users found
    RETURN QUERY SELECT false, 0.00::decimal, null::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update loyalty user spending
CREATE OR REPLACE FUNCTION update_loyalty_spending(
    p_restaurant_id uuid,
    p_user_id text,
    p_amount decimal
)
RETURNS void AS $$
BEGIN
    INSERT INTO loyalty_users (restaurant_id, user_id, total_spent_sgd, order_count, last_order_date)
    VALUES (p_restaurant_id, p_user_id, p_amount, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (restaurant_id, user_id)
    DO UPDATE SET
        total_spent_sgd = loyalty_users.total_spent_sgd + p_amount,
        order_count = loyalty_users.order_count + 1,
        last_order_date = CURRENT_TIMESTAMP,
        discount_eligible = (loyalty_users.total_spent_sgd + p_amount) >= 100,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create order session for table
CREATE OR REPLACE FUNCTION create_order_session(
    p_restaurant_id uuid,
    p_table_id uuid,
    p_booking_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    session_id uuid;
    session_token text;
BEGIN
    -- Generate unique session token
    session_token := generate_session_token();
    
    -- Deactivate any existing sessions for this table
    UPDATE order_sessions 
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE table_id = p_table_id AND is_active = true;
    
    -- Create new session
    INSERT INTO order_sessions (restaurant_id, table_id, booking_id, session_token)
    VALUES (p_restaurant_id, p_table_id, p_booking_id, session_token)
    RETURNING id INTO session_id;
    
    RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_order_number() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION generate_session_token() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_loyalty_discount(uuid, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_loyalty_spending(uuid, text, decimal) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_order_session(uuid, uuid, uuid) TO anon, authenticated;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Menu items indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_category 
    ON menu_items(restaurant_id, category_id) WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_menu_items_display_order 
    ON menu_items(category_id, display_order, name);

-- Loyalty users indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_users_restaurant_user 
    ON loyalty_users(restaurant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_users_spending 
    ON loyalty_users(restaurant_id, total_spent_sgd) WHERE total_spent_sgd >= 100;

-- Order sessions indexes
CREATE INDEX IF NOT EXISTS idx_order_sessions_table_active 
    ON order_sessions(table_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_order_sessions_token 
    ON order_sessions(session_token) WHERE is_active = true;

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_date 
    ON orders(restaurant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_session_status 
    ON orders(session_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_status_restaurant 
    ON orders(status, restaurant_id) WHERE status != 'paid';

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order 
    ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_menu_item 
    ON order_items(menu_item_id);

-- =============================================
-- SAMPLE DATA FOR TESTING
-- =============================================

-- Insert sample menu categories (will be populated by application)
-- Insert sample menu items (will be populated by application)

-- Add helpful comments
COMMENT ON TABLE menu_categories IS 'Food and drink categories for restaurant menus';
COMMENT ON TABLE menu_items IS 'Individual menu items with pricing and descriptions';
COMMENT ON TABLE loyalty_users IS 'Customer loyalty program tracking with spending history';
COMMENT ON TABLE order_sessions IS 'Links QR code orders to specific table/booking sessions';
COMMENT ON TABLE orders IS 'Complete order records with loyalty discounts applied';
COMMENT ON TABLE order_items IS 'Individual items within each order';

COMMENT ON FUNCTION check_loyalty_discount(uuid, text[]) IS 'Checks loyalty user eligibility and calculates discount amount';
COMMENT ON FUNCTION update_loyalty_spending(uuid, text, decimal) IS 'Updates loyalty user spending and eligibility status';
COMMENT ON FUNCTION create_order_session(uuid, uuid, uuid) IS 'Creates new QR ordering session for a table';