-- 008_budget_periods
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
