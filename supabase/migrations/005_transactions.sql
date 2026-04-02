-- 005_transactions
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
