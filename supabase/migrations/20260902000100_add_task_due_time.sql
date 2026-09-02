alter table public.tasks
  add column due_time time;

comment on column public.tasks.due_time is
  'Optional local wall-clock due time paired with due_date.';
