-- 1. Alter properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tenant_name text;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS lease_start date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS lease_end date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS security_deposit numeric(10, 2) DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_mortgage numeric(10, 2) DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_insurance numeric(10, 2) DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_taxes numeric(10, 2) DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS monthly_hoa numeric(10, 2) DEFAULT 0;

-- 2. Alter categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tax_category text;

-- 3. Create transaction_splits table
CREATE TABLE IF NOT EXISTS transaction_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  portal_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. Create indexes on splits
CREATE INDEX IF NOT EXISTS idx_splits_parent ON transaction_splits(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_splits_property ON transaction_splits(property_id);
