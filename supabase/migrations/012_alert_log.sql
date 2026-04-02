-- 012_alert_log
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
