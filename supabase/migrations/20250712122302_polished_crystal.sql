/*
  # Fix Employee Login

  1. New Data
    - Add employee records with correct credentials
    - Ensure passwords match exactly as specified
  2. Changes
    - Use INSERT with ON CONFLICT to handle existing records
*/

-- Insert employees with the exact specified credentials
INSERT INTO public.employees (
  id,
  restaurant_id,
  employee_id,
  name,
  password,
  is_active,
  created_at,
  updated_at
)
VALUES
  (
    gen_random_uuid(),
    (SELECT id FROM restaurants LIMIT 1),
    'kahweng',
    'Kah Weng',
    'Eisgrade1!',
    true,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM restaurants LIMIT 1),
    'yongxuan',
    'Yong Xuan',
    'Qwerasdf1@3$',
    true,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM restaurants LIMIT 1),
    'test',
    'Test User',
    'password123',
    true,
    now(),
    now()
  )
ON CONFLICT (restaurant_id, employee_id) 
DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  is_active = true,
  updated_at = now();