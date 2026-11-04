create table if not exists public.ai_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Cuộc trò chuyện mới',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_chat_conversations_title_length check (char_length(title) between 1 and 100),
  constraint ai_chat_conversations_messages_array check (jsonb_typeof(messages) = 'array')
);

create index if not exists ai_chat_conversations_owner_updated_idx
  on public.ai_chat_conversations (user_id, updated_at desc);

alter table public.ai_chat_conversations enable row level security;

drop policy if exists "Users can view their own AI conversations" on public.ai_chat_conversations;
create policy "Users can view their own AI conversations"
  on public.ai_chat_conversations for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own AI conversations" on public.ai_chat_conversations;
create policy "Users can create their own AI conversations"
  on public.ai_chat_conversations for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own AI conversations" on public.ai_chat_conversations;
create policy "Users can update their own AI conversations"
  on public.ai_chat_conversations for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own AI conversations" on public.ai_chat_conversations;
create policy "Users can delete their own AI conversations"
  on public.ai_chat_conversations for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.ai_chat_conversations from anon;
grant select, insert, update, delete on public.ai_chat_conversations to authenticated;
