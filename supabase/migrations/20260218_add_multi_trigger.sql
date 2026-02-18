-- Add trigger_types column
ALTER TABLE debuffs ADD COLUMN IF NOT EXISTS trigger_types text[] DEFAULT '{}';

-- Migrate existing data
UPDATE debuffs 
SET trigger_types = ARRAY[trigger_type] 
WHERE trigger_type IS NOT NULL AND trigger_types = '{}';

-- Make trigger_type nullable (since we will deprecate it)
ALTER TABLE debuffs ALTER COLUMN trigger_type DROP NOT NULL;

-- (Optional) We could drop trigger_type, but let's keep it for safety until code is fully deployed
-- ALTER TABLE debuffs DROP COLUMN trigger_type;
