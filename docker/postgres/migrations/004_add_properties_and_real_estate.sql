-- 1. Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  monthly_rent_target numeric(10, 2) DEFAULT 0,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 2. Add property_id column to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE SET NULL;

-- 3. Insert 'Real Estate' category if it doesn't exist
INSERT INTO categories (name, type, sort_order, icon)
SELECT 'Real Estate', 'fixed', 14, 'building'
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE name = 'Real Estate'
);
