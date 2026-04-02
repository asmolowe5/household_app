-- 006_category_rules
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
