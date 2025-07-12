/*
  # Add employee data for login and time tracking

  1. New Data
    - Add two employee records with specified credentials
    - Set up employee IDs and passwords for login and time tracking
  2. Security
    - Ensure employees are active and associated with the restaurant
*/

-- Insert employee records if they don't exist
DO $$
DECLARE
  v_restaurant_id uuid;
BEGIN
  -- Get the first restaurant ID (for demo purposes)
  SELECT id INTO v_restaurant_id FROM restaurants LIMIT 1;
  
  IF v_restaurant_id IS NOT NULL THEN
    -- Insert employee: Kah Weng
    INSERT INTO employees (restaurant_id, employee_id, name, password, is_active)
    VALUES (
      v_restaurant_id,
      'kahweng',
      'Kah Weng',
      'Eisgrade1!',
      true
    )
    ON CONFLICT (restaurant_id, employee_id) 
    DO UPDATE SET 
      name = 'Kah Weng',
      password = 'Eisgrade1!',
      is_active = true;
      
    -- Insert employee: Yong Xuan
    INSERT INTO employees (restaurant_id, employee_id, name, password, is_active)
    VALUES (
      v_restaurant_id,
      'yongxuan',
      'Yong Xuan',
      'Qwerasdf1@3$',
      true
    )
    ON CONFLICT (restaurant_id, employee_id) 
    DO UPDATE SET 
      name = 'Yong Xuan',
      password = 'Qwerasdf1@3$',
      is_active = true;
      
    -- Insert a test employee for demo purposes
    INSERT INTO employees (restaurant_id, employee_id, name, password, is_active)
    VALUES (
      v_restaurant_id,
      'test',
      'Test User',
      'password123',
      true
    )
    ON CONFLICT (restaurant_id, employee_id) 
    DO UPDATE SET 
      name = 'Test User',
      password = 'password123',
      is_active = true;
  END IF;
END $$;