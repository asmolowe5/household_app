-- 002_plaid_items
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
