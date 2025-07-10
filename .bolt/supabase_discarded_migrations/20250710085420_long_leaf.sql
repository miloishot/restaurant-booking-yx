/*
  # Add device_id and printer_id columns to printer_configs table

  1. New Columns
    - `device_id` - Identifier for the device running the print client
    - `printer_id` - Identifier for the specific printer on the device

  2. Changes
    - Add new columns to existing printer_configs table
    - Ensure policy exists but don't try to recreate it
*/

-- Add device_id and printer_id columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printer_configs' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE printer_configs ADD COLUMN device_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printer_configs' AND column_name = 'printer_id'
  ) THEN
    ALTER TABLE printer_configs ADD COLUMN printer_id text;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN printer_configs.device_id IS 'Identifier for the device running the print client';
COMMENT ON COLUMN printer_configs.printer_id IS 'Identifier for the specific printer on the device';

-- Ensure RLS policy exists (but don't try to recreate it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polname = 'Restaurant staff can manage printer configs'
  ) THEN
    CREATE POLICY "Restaurant staff can manage printer configs"
      ON printer_configs
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
  END IF;
END $$;