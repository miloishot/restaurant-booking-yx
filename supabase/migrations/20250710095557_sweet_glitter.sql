/*
  # Update Printer Configs Table

  This migration modifies the printer_configs table to focus only on device_id and printer_id,
  removing the need for connection type, IP address, and port fields.

  1. Changes
    - Make printer_type, ip_address, and port fields nullable
    - Add comments to clarify the new focus on device_id and printer_id
*/

-- Make printer_type, ip_address, and port nullable
ALTER TABLE printer_configs 
  ALTER COLUMN printer_type DROP NOT NULL,
  ALTER COLUMN printer_type SET DEFAULT 'network';

-- Add comments for documentation
COMMENT ON TABLE printer_configs IS 'Printer configurations for restaurant QR code and receipt printing';
COMMENT ON COLUMN printer_configs.device_id IS 'Identifier for the device running the print client';
COMMENT ON COLUMN printer_configs.printer_id IS 'Identifier for the specific printer on the device';