-- 004_categories
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
