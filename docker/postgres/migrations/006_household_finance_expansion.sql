-- Create assets_liabilities table
CREATE TABLE IF NOT EXISTS assets_liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  value NUMERIC(12, 2) NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create net_worth_snapshots table
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_assets NUMERIC(14, 2) NOT NULL,
  total_liabilities NUMERIC(14, 2) NOT NULL,
  net_worth NUMERIC(14, 2) NOT NULL
);

-- Create recurring_bills table
CREATE TABLE IF NOT EXISTS recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  due_day INTEGER NOT NULL,
  portal_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_paid_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create savings_goals table
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  target_date DATE,
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
