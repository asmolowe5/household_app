-- =============================================================================
-- ALL MIGRATIONS — Smolowe Household Portal
-- Run this entire file in the Supabase SQL editor to set up the full schema.
-- =============================================================================


-- =============================================================================
-- 001_profiles
-- =============================================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text not null,
  phone text,
  theme_preference text default 'dark' check (theme_preference in ('dark', 'light')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- =============================================================================
-- 002_plaid_items
-- =============================================================================
create table public.plaid_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  access_token_vault_id uuid,
  institution_name text not null,
  institution_id text,
  module_context text default 'household' check (module_context in ('household', 'llc')),
  cursor text,
  last_synced_at timestamptz,
  created_at timestamptz default now()
);

alter table public.plaid_items enable row level security;

create policy "Users can view own plaid items"
  on public.plaid_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own plaid items"
  on public.plaid_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plaid items"
  on public.plaid_items for update
  using (auth.uid() = user_id);


-- =============================================================================
-- 003_accounts
-- =============================================================================
create table public.accounts (
  id uuid default gen_random_uuid() primary key,
  plaid_item_id uuid references public.plaid_items(id) on delete cascade not null,
  plaid_account_id text not null unique,
  name text not null,
  official_name text,
  type text not null,
  subtype text,
  current_balance numeric(12,2),
  available_balance numeric(12,2),
  iso_currency_code text default 'USD',
  last_balance_update timestamptz,
  created_at timestamptz default now()
);

alter table public.accounts enable row level security;

create policy "Users can view own accounts"
  on public.accounts for select
  using (
    exists (
      select 1 from public.plaid_items
      where plaid_items.id = accounts.plaid_item_id
      and plaid_items.user_id = auth.uid()
    )
  );


-- =============================================================================
-- 004_categories
-- =============================================================================
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  monthly_budget numeric(10,2) default 0,
  type text not null default 'discretionary' check (type in ('fixed', 'discretionary')),
  is_active boolean default true,
  is_temporary boolean default false,
  sort_order integer default 0,
  icon text,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;

create policy "Authenticated users can view categories"
  on public.categories for select
  to authenticated
  using (true);

create policy "Authenticated users can manage categories"
  on public.categories for all
  to authenticated
  using (true)
  with check (true);

-- Seed starter categories
insert into public.categories (name, type, sort_order, icon) values
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
  ('Subscriptions', 'fixed', 13, 'repeat');


-- =============================================================================
-- 005_transactions
-- =============================================================================
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts(id) on delete cascade not null,
  plaid_transaction_id text unique,
  date date not null,
  amount numeric(10,2) not null,
  merchant_name text,
  plaid_category text[],
  portal_category_id uuid references public.categories(id) on delete set null,
  transaction_type text default 'expense' check (transaction_type in ('expense', 'income', 'savings_transfer', 'internal_transfer')),
  is_reviewed boolean default false,
  is_anomaly boolean default false,
  project_id uuid,
  notes text,
  created_at timestamptz default now()
);

create index idx_transactions_date on public.transactions(date desc);
create index idx_transactions_account on public.transactions(account_id);
create index idx_transactions_category on public.transactions(portal_category_id);
create index idx_transactions_type on public.transactions(transaction_type);

alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select
  using (
    exists (
      select 1 from public.accounts a
      join public.plaid_items pi on pi.id = a.plaid_item_id
      where a.id = transactions.account_id
      and pi.user_id = auth.uid()
    )
  );


-- =============================================================================
-- 006_category_rules
-- =============================================================================
create table public.category_rules (
  id uuid default gen_random_uuid() primary key,
  pattern text not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  source text default 'user' check (source in ('user', 'ai')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.category_rules enable row level security;

create policy "Authenticated users can manage category rules"
  on public.category_rules for all
  to authenticated
  using (true)
  with check (true);


-- =============================================================================
-- 007_projects
-- =============================================================================
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  estimated_budget numeric(10,2),
  is_active boolean default true,
  created_at timestamptz default now(),
  closed_at timestamptz,
  notes text
);

alter table public.projects enable row level security;

create policy "Authenticated users can manage projects"
  on public.projects for all
  to authenticated
  using (true)
  with check (true);

alter table public.transactions
  add constraint fk_transactions_project
  foreign key (project_id) references public.projects(id) on delete set null;


-- =============================================================================
-- 008_budget_periods
-- =============================================================================
create table public.budget_periods (
  id uuid default gen_random_uuid() primary key,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz default now()
);

alter table public.budget_periods enable row level security;

create policy "Authenticated users can manage budget periods"
  on public.budget_periods for all
  to authenticated
  using (true) with check (true);


-- =============================================================================
-- 009_financial_profile
-- =============================================================================
create table public.financial_profile (
  id uuid default gen_random_uuid() primary key,
  content text not null default '',
  version integer default 1,
  updated_at timestamptz default now(),
  updated_by text default 'system' check (updated_by in ('user', 'ai', 'system'))
);

alter table public.financial_profile enable row level security;

create policy "Authenticated users can view financial profile"
  on public.financial_profile for select
  to authenticated using (true);

create policy "Authenticated users can update financial profile"
  on public.financial_profile for all
  to authenticated using (true) with check (true);

insert into public.financial_profile (content, updated_by) values (
'# Smolowe Financial Profile

## Spending Identity
New profile — spending patterns will be analyzed after the first month of data.

## Patterns & Triggers
No data yet.

## Active Projects
None.

## Goals & Aspirations
To be defined during initial budget setup.

## Progress Narrative
Just getting started.
', 'system');


-- =============================================================================
-- 010_ai_conversations
-- =============================================================================
create table public.ai_conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  channel text default 'portal' check (channel in ('sms', 'portal')),
  messages jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ai_conversations enable row level security;

create policy "Users can manage own conversations"
  on public.ai_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- =============================================================================
-- 011_alert_rules
-- =============================================================================
create table public.alert_rules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  trigger_type text not null check (trigger_type in ('merchant', 'category', 'amount', 'pace', 'savings_withdrawal')),
  trigger_params jsonb not null default '{}'::jsonb,
  message_template text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.alert_rules enable row level security;

create policy "Users can manage own alert rules"
  on public.alert_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- =============================================================================
-- 012_alert_log
-- =============================================================================
-- Note: alert_rule_id is text (not uuid) because pace-based alerts use synthetic IDs
-- like "pace-{category_id}" that are not real foreign keys.
create table public.alert_log (
  id uuid default gen_random_uuid() primary key,
  alert_rule_id text,
  user_id uuid references public.profiles(id) on delete cascade not null,
  message_sent text not null,
  sent_at timestamptz default now(),
  channel text default 'sms' check (channel in ('sms', 'portal'))
);

create index idx_alert_log_user_date on public.alert_log(user_id, sent_at desc);

alter table public.alert_log enable row level security;

create policy "Users can view own alert log"
  on public.alert_log for select
  using (auth.uid() = user_id);
