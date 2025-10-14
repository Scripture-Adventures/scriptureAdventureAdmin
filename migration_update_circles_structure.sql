-- Migration to update circles structure in current_cohort table
-- This script migrates existing circle data to the new structure with WhatsApp contact URLs

-- First, let's create a backup of existing data
CREATE TABLE IF NOT EXISTS current_cohort_backup AS 
SELECT * FROM current_cohort;

-- Update existing circles data to new structure
-- Convert existing array of links to array of objects with WhatsApp contact URLs
UPDATE current_cohort 
SET circles = CASE 
  WHEN circles IS NOT NULL AND jsonb_typeof(circles) = 'array' THEN
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'circle_rep_whatsapp_contact', '', -- Empty WhatsApp contact URL for existing circles
          'circle_whatsapp_link', circle_value
        )
      )
      FROM jsonb_array_elements_text(circles) AS circle_value
      WHERE circle_value IS NOT NULL AND circle_value != ''
    )
  ELSE NULL
END
WHERE circles IS NOT NULL;

-- Add comment to document the new structure
COMMENT ON COLUMN current_cohort.circles IS 'JSONB array of circle objects with structure: [{"circle_rep_whatsapp_contact": "https://wa.me/phone_number", "circle_whatsapp_link": "whatsapp_group_link"}]';

-- Example of the new structure:
-- [
--   {
--     "circle_rep_whatsapp_contact": "https://wa.me/23203240304",
--     "circle_whatsapp_link": "https://chat.whatsapp.com/C3kijPRi2gtCV17o8t061u"
--   },
--   {
--     "circle_rep_whatsapp_contact": "https://wa.me/23203240305", 
--     "circle_whatsapp_link": "https://chat.whatsapp.com/DJxwy68mEMp9YsMW3ykUKe"
--   }
-- ]
