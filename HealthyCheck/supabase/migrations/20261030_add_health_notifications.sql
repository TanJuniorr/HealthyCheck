-- Durable in-app notification inbox for invitations to share health information.
-- Apply this migration in the Supabase SQL editor before testing recipient notifications.

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  reference_id uuid references public.sharing_invites(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint app_notifications_reference_unique unique (recipient_user_id, kind, reference_id)
);

create index if not exists app_notifications_recipient_created_idx
  on public.app_notifications (recipient_user_id, created_at desc);

alter table public.app_notifications enable row level security;

drop policy if exists "Users can view own app notifications" on public.app_notifications;
create policy "Users can view own app notifications"
  on public.app_notifications for select to authenticated
  using (auth.uid() = recipient_user_id);

drop policy if exists "Users can mark own app notifications read" on public.app_notifications;
create policy "Users can mark own app notifications read"
  on public.app_notifications for update to authenticated
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

revoke insert, delete, update on public.app_notifications from anon, authenticated;
grant select on public.app_notifications to authenticated;
grant update (read_at) on public.app_notifications to authenticated;

create or replace function public.create_sharing_received_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_recipient_id uuid;
  v_sharer_email text;
begin
  if new.status <> 'active' or new.recipient_email is null then
    return new;
  end if;

  select u.id into v_recipient_id
  from auth.users as u
  where lower(u.email) = lower(new.recipient_email)
  limit 1;

  if v_recipient_id is null or v_recipient_id = new.owner_id then
    return new;
  end if;

  select u.email into v_sharer_email
  from auth.users as u
  where u.id = new.owner_id;

  insert into public.app_notifications (recipient_user_id, kind, payload, reference_id)
  values (
    v_recipient_id,
    'sharing_received',
    jsonb_build_object(
      'sharerEmail', coalesce(v_sharer_email, ''),
      'shareSteps', new.share_steps,
      'shareSleep', new.share_sleep,
      'shareNutrition', new.share_nutrition
    ),
    new.id
  )
  on conflict (recipient_user_id, kind, reference_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_sharing_received_notification() from public, anon, authenticated;

drop trigger if exists sharing_invite_received_notification on public.sharing_invites;
create trigger sharing_invite_received_notification
  after insert on public.sharing_invites
  for each row execute function public.create_sharing_received_notification();

create or replace function public.notify_pending_shares_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_invite public.sharing_invites%rowtype;
  v_sharer_email text;
begin
  if new.email is null then
    return new;
  end if;

  for v_invite in
    select * from public.sharing_invites
    where status = 'active'
      and recipient_email is not null
      and lower(recipient_email) = lower(new.email)
      and owner_id <> new.id
  loop
    select u.email into v_sharer_email from auth.users as u where u.id = v_invite.owner_id;
    insert into public.app_notifications (recipient_user_id, kind, payload, reference_id)
    values (
      new.id,
      'sharing_received',
      jsonb_build_object(
        'sharerEmail', coalesce(v_sharer_email, ''),
        'shareSteps', v_invite.share_steps,
        'shareSleep', v_invite.share_sleep,
        'shareNutrition', v_invite.share_nutrition
      ),
      v_invite.id
    )
    on conflict (recipient_user_id, kind, reference_id) do nothing;
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_pending_shares_for_new_user() from public, anon, authenticated;
drop trigger if exists auth_user_pending_share_notifications on auth.users;
create trigger auth_user_pending_share_notifications
  after insert on auth.users
  for each row execute function public.notify_pending_shares_for_new_user();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'app_notifications'
     ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end;
$$;

notify pgrst, 'reload schema';
