-- Migration: create sharing_invites table and RLS policies
-- Note: Do not execute automatically. To be reviewed and applied manually via Supabase Dashboard SQL Editor.

create table if not exists public.sharing_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_label text not null check (char_length(trim(recipient_label)) > 0),
  recipient_email text,
  privacy_level text not null default 'specific' check (privacy_level in ('specific', 'family', 'community')),
  share_steps boolean not null default false,
  share_sleep boolean not null default false,
  share_nutrition boolean not null default false,
  share_heart boolean not null default false,
  share_cycle boolean not null default false,
  notify_on_view boolean not null default false,
  weekly_digest boolean not null default false,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_sharing_invites_owner_id on public.sharing_invites(owner_id);
create index if not exists idx_sharing_invites_status on public.sharing_invites(status);

-- Enable Row Level Security
alter table public.sharing_invites enable row level security;

-- Policies: only owner can select, insert, update, delete their own sharing invites
drop policy if exists "Users can view own sharing invites" on public.sharing_invites;
create policy "Users can view own sharing invites"
  on public.sharing_invites
  for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "Users can insert own sharing invites" on public.sharing_invites;
create policy "Users can insert own sharing invites"
  on public.sharing_invites
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "Users can update own sharing invites" on public.sharing_invites;
create policy "Users can update own sharing invites"
  on public.sharing_invites
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own sharing invites" on public.sharing_invites;
create policy "Users can delete own sharing invites"
  on public.sharing_invites
  for delete
  to authenticated
  using (auth.uid() = owner_id);
