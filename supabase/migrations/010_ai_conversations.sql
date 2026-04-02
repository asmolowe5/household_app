-- 010_ai_conversations
create table public.ai_conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  channel text default 'portal' check (channel in ('sms', 'portal')),
  messages jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ai_conversations enable row level security;

create policy "Users can manage own conversations"
  on public.ai_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
