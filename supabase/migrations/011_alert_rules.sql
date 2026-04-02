-- 011_alert_rules
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
