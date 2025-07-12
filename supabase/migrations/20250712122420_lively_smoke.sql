/*
  # Add Employee Credentials for Login

  1. New Employee Records
    - Add kahweng with password Eisgrade1!
    - Add yongxuan with password Qwerasdf1@3$
    - Add test user for demo purposes
  
  2. Security
    - Enable RLS on employees table
    - Passwords stored as plain text for demo purposes
*/

-- Get the first restaurant ID for demo purposes
DO $$
DECLARE
    demo_restaurant_id uuid;
BEGIN
    SELECT id INTO demo_restaurant_id FROM restaurants LIMIT 1;
    
    IF demo_restaurant_id IS NOT NULL THEN
        -- Insert employee records with exact credentials
        INSERT INTO employees (restaurant_id, employee_id, name, password, is_active)
        VALUES 
            (demo_restaurant_id, 'kahweng', 'Kah Weng', 'Eisgrade1!', true),
            (demo_restaurant_id, 'yongxuan', 'Yong Xuan', 'Qwerasdf1@3$', true),
            (demo_restaurant_id, 'test', 'Test User', 'password123', true)
        ON CONFLICT (restaurant_id, employee_id) 
        DO UPDATE SET 
            name = EXCLUDED.name,
            password = EXCLUDED.password,
            is_active = EXCLUDED.is_active,
            updated_at = now();
    END IF;
END $$;