#!/bin/sh
set -eu

: "${ALEX_PIN:?ALEX_PIN is required to seed the portal database}"
: "${EMINE_PIN:?EMINE_PIN is required to seed the portal database}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_address text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text,
  plaid_item_id text,
  institution_name text NOT NULL,
  institution_id text,
  module_context text DEFAULT 'household',
  cursor text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_item_id uuid NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  plaid_account_id text NOT NULL UNIQUE,
  name text NOT NULL,
  official_name text,
  type text NOT NULL,
  subtype text,
  current_balance numeric(12, 2),
  available_balance numeric(12, 2),
  iso_currency_code text DEFAULT 'USD',
  last_balance_update timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  monthly_budget numeric(10, 2) DEFAULT 0,
  type text NOT NULL DEFAULT 'discretionary',
  is_active boolean DEFAULT true,
  is_temporary boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  icon text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL UNIQUE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  source text DEFAULT 'user',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plaid_transaction_id text UNIQUE,
  date date NOT NULL,
  amount numeric(10, 2) NOT NULL,
  merchant_name text,
  plaid_category text[],
  portal_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  transaction_type text DEFAULT 'expense',
  is_reviewed boolean DEFAULT false,
  is_anomaly boolean DEFAULT false,
  project_id uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(portal_category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);

INSERT INTO users (name, pin_hash, role)
SELECT 'Alex', crypt('${ALEX_PIN}', gen_salt('bf')), 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Alex');

INSERT INTO users (name, pin_hash, role)
SELECT 'Emine', crypt('${EMINE_PIN}', gen_salt('bf')), 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Emine');

INSERT INTO categories (name, type, sort_order, icon)
SELECT *
FROM (VALUES
  ('Dining/Delivery', 'discretionary', 1, 'utensils-crossed'),
  ('Groceries', 'discretionary', 2, 'shopping-cart'),
  ('Shopping', 'discretionary', 3, 'shopping-bag'),
  ('Transportation', 'discretionary', 4, 'car'),
  ('Entertainment', 'discretionary', 5, 'film'),
  ('Home', 'discretionary', 6, 'home'),
  ('Personal', 'discretionary', 7, 'user'),
  ('Rent/Mortgage', 'fixed', 10, 'building'),
  ('Utilities', 'fixed', 11, 'zap'),
  ('Insurance', 'fixed', 12, 'shield'),
  ('Subscriptions', 'fixed', 13, 'repeat')
) AS seed(name, type, sort_order, icon)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.name = seed.name
);
SQL
