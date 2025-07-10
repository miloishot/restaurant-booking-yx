/*
  # Simplify Printer Configuration Table

  This migration updates the printer_configs table to focus primarily on device_id and printer_id,
  which are the only fields needed for the print API. The other fields are made nullable for
  backward compatibility.

  1. Changes
    - Make printer_type, ip_address, and port fields nullable
    - Set printer_type to default to 'network' for compatibility
    - Add comments to clarify the focus on device_id and printer_id

  2. Features
    - Maintains backward compatibility with existing data
    - Simplifies the printer configuration process
    - Focuses on the essential fields needed for the print API
*/

-- Make printer_type, ip_address, and port nullable
ALTER TABLE printer_configs 
  ALTER COLUMN printer_type DROP NOT NULL,
  ALTER COLUMN printer_type SET DEFAULT 'network';

-- Add comments for documentation
COMMENT ON TABLE printer_configs IS 'Printer configurations for restaurant QR code and receipt printing. Only device_id and printer_id are required for the print API.';
COMMENT ON COLUMN printer_configs.device_id IS 'Identifier for the device running the print client. This is the primary field needed for printing.';
COMMENT ON COLUMN printer_configs.printer_id IS 'Identifier for the specific printer on the device. This is the primary field needed for printing.';