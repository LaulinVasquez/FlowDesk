alter table public.tasks
  add column due_at timestamptz,
  add column reminder_minutes integer check (reminder_minutes in (15, 60, 1440));
create index tasks_push_reminder_idx on public.tasks(completed, due_at) where due_at is not null;
alter table public.profiles
  add column default_reminder_minutes integer not null default 60
  check (default_reminder_minutes in (15, 60, 1440));
comment on column public.tasks.reminder_minutes is 'Null inherits profiles.default_reminder_minutes.';
