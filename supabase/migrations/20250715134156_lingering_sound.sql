/*
  # Fix loyalty discount function ambiguous column reference

  1. Function Updates
    - Fix ambiguous `user_id` column reference in check_loyalty_discount function
    - Explicitly qualify column references with table aliases
    - Ensure proper table aliasing throughout the function

  2. Changes Made
    - Replace ambiguous `user_id` references with `lu.user_id`
    - Add proper table aliases for clarity
    - Maintain existing function signature and behavior
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS check_loyalty_discount(uuid, text[]);

-- Recreate the function with fixed column references
CREATE OR REPLACE FUNCTION check_loyalty_discount(
  p_restaurant_id uuid,
  p_loyalty_user_ids text[]
)
RETURNS TABLE (
  discount_eligible boolean,
  discount_amount numeric,
  triggering_user_id text,
  qualifying_users jsonb
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN COUNT(*) FILTER (WHERE lu.total_spent_sgd >= 100) > 0 THEN true
      ELSE false
    END as discount_eligible,
    CASE 
      WHEN COUNT(*) FILTER (WHERE lu.total_spent_sgd >= 100) > 0 THEN 0.10::numeric
      ELSE 0::numeric
    END as discount_amount,
    (
      SELECT lu2.user_id 
      FROM loyalty_users lu2 
      WHERE lu2.restaurant_id = p_restaurant_id 
        AND lu2.user_id = ANY(p_loyalty_user_ids)
        AND lu2.total_spent_sgd >= 100
      ORDER BY lu2.total_spent_sgd DESC
      LIMIT 1
    ) as triggering_user_id,
    jsonb_agg(
      jsonb_build_object(
        'user_id', lu.user_id,
        'name', lu.name,
        'total_spent_sgd', lu.total_spent_sgd,
        'discount_eligible', lu.total_spent_sgd >= 100
      )
    ) as qualifying_users
  FROM loyalty_users lu
  WHERE lu.restaurant_id = p_restaurant_id 
    AND lu.user_id = ANY(p_loyalty_user_ids);
END;
$$;