ALTER TABLE accounts ADD COLUMN IF NOT EXISTS custom_name text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;
