/*
  # Add Print API Configuration to Restaurants Table
  
  1. New Columns
    - `print_api_url` - Base URL for the print middleware server
    - `print_api_key` - API key for authenticating with the print middleware
    
  2. Changes
    - Add new columns to existing restaurants table
    - Add comments for documentation
*/

-- Add print_api_url and print_api_key columns to restaurants table
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS print_api_url text,
ADD COLUMN IF NOT EXISTS print_api_key text;

-- Add comments for documentation
COMMENT ON COLUMN restaurants.print_api_url IS 'Base URL for the print middleware server';
COMMENT ON COLUMN restaurants.print_api_key IS 'API key for authenticating with the print middleware';