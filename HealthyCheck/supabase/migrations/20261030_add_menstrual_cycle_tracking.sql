-- Menstrual cycle settings and dated daily logs.
-- Apply this migration in the Supabase SQL editor before using Cycle Tracking.

create table if not exists public.menstrual_cycle_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_period_start date,
  cycle_length smallint not null default 28 check (cycle_length between 21 and 45),
  period_length smallint not null default 5 check (period_length between 1 and 10),
  reminder_enabled boolean not null default true,
  reminder_days_before smallint not null default 2 check (reminder_days_before between 1 and 7),
  updated_at timestamptz not null default now()
);

create table if not exists public.menstrual_cycle_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  flow_status text not null default 'none' check (flow_status in ('none', 'spotting', 'light', 'medium', 'heavy')),
  mood text check (mood in ('happy', 'okay', 'low', 'tired', 'stressed')),
  symptoms text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menstrual_cycle_logs_user_date_unique unique (user_id, log_date),
  constraint menstrual_cycle_logs_symptoms_check check (
    symptoms <@ array['cramps', 'headache', 'bloating', 'fatigue', 'moodSwings', 'backPain']::text[]
  )
);

create index if not exists menstrual_cycle_logs_user_date_idx
  on public.menstrual_cycle_logs (user_id, log_date desc);

alter table public.menstrual_cycle_settings enable row level security;
alter table public.menstrual_cycle_logs enable row level security;

drop policy if exists "Users manage own menstrual cycle settings" on public.menstrual_cycle_settings;
create policy "Users manage own menstrual cycle settings"
  on public.menstrual_cycle_settings for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own menstrual cycle logs" on public.menstrual_cycle_logs;
create policy "Users manage own menstrual cycle logs"
  on public.menstrual_cycle_logs for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.menstrual_cycle_settings to authenticated;
grant select, insert, update, delete on public.menstrual_cycle_logs to authenticated;

notify pgrst, 'reload schema';
