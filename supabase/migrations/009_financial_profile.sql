-- 009_financial_profile
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
