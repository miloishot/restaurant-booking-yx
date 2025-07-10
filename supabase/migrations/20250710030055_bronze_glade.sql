/*
  # Update Menu Items with Real Food Images

  This migration updates the existing menu items with real food images from Pexels.
  
  1. Changes
    - Add high-quality food images to all menu items
    - Use free stock photos from Pexels
    - Maintain existing menu item data
  
  2. Security
    - No changes to security policies
    - Only updates image_url field
*/

-- Update Appetizers
UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/8969237/pexels-photo-8969237.jpeg'
WHERE name = 'Crispy Calamari Rings';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/6605214/pexels-photo-6605214.jpeg'
WHERE name = 'Truffle Mushroom Bruschetta';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/5718071/pexels-photo-5718071.jpeg'
WHERE name = 'Buffalo Chicken Wings';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/1351238/pexels-photo-1351238.jpeg'
WHERE name = 'Avocado Toast';

-- Update Main Courses
UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/3763847/pexels-photo-3763847.jpeg'
WHERE name = 'Grilled Atlantic Salmon';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/1251208/pexels-photo-1251208.jpeg'
WHERE name = 'Wagyu Beef Ribeye';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/6210747/pexels-photo-6210747.jpeg'
WHERE name = 'Chicken Parmigiana';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/1640773/pexels-photo-1640773.jpeg'
WHERE name = 'Vegetarian Buddha Bowl';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/6270541/pexels-photo-6270541.jpeg'
WHERE name = 'Seafood Linguine';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/410648/pexels-photo-410648.jpeg'
WHERE name = 'BBQ Pork Ribs';

-- Update Desserts
UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg'
WHERE name = 'Chocolate Lava Cake';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/6880219/pexels-photo-6880219.jpeg'
WHERE name = 'Tiramisu';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg'
WHERE name = 'Mango Sticky Rice';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/14705134/pexels-photo-14705134.jpeg'
WHERE name = 'New York Cheesecake';

-- Update Beverages
UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/158053/fresh-orange-juice-squeezed-refreshing-citrus-158053.jpeg'
WHERE name = 'Fresh Orange Juice';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/792613/pexels-photo-792613.jpeg'
WHERE name = 'Iced Lemon Tea';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg'
WHERE name = 'Cappuccino';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/1089930/pexels-photo-1089930.jpeg'
WHERE name = 'Craft Beer';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/1123260/pexels-photo-1123260.jpeg'
WHERE name = 'House Wine';

UPDATE menu_items 
SET image_url = 'https://images.pexels.com/photos/1232152/pexels-photo-1232152.jpeg'
WHERE name = 'Coconut Water';