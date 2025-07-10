/*
  # Add Print API Configuration to Restaurants Table

  1. New Columns
    - `print_api_url` - URL for the print middleware server
    - `print_api_key` - Authentication key for the print middleware API

  2. Changes
    - Add new columns to existing restaurants table
    - Maintain existing RLS policies
    - No changes to existing data
*/

-- Add print_api_url and print_api_key columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'print_api_url'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN print_api_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'restaurants' AND column_name = 'print_api_key'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN print_api_key text;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN restaurants.print_api_url IS 'URL for the print middleware server';
COMMENT ON COLUMN restaurants.print_api_key IS 'Authentication key for the print middleware API';