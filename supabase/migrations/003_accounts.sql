-- 003_accounts
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
