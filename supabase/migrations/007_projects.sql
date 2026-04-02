-- 007_projects
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
