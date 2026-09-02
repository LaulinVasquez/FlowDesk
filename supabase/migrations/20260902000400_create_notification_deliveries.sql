create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_at timestamptz not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (task_id, reminder_at, subscription_id)
);
create index notification_deliveries_user_id_idx on public.notification_deliveries(user_id);
alter table public.notification_deliveries enable row level security;
create policy "Users can read own notification deliveries" on public.notification_deliveries for select to authenticated using ((select auth.uid()) = user_id);
