create table public.tasks (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null
    references auth.users(id)
    on delete cascade,

  project_id uuid
    references public.projects(id)
    on delete set null,

  title text not null
    check (char_length(trim(title)) > 0),

  description text,

  completed boolean not null default false,

  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),

  due_date date,

  tags text[] not null default '{}',

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Common FlowDesk queries
create index tasks_owner_id_idx
  on public.tasks(owner_id);

create index tasks_project_id_idx
  on public.tasks(project_id);

create index tasks_due_date_idx
  on public.tasks(due_date);

create index tasks_owner_completed_idx
  on public.tasks(owner_id, completed);


-- Enable Row-Level Security
alter table public.tasks enable row level security;


-- SELECT
create policy "Users can view their own tasks"
on public.tasks
for select
to authenticated
using ((select auth.uid()) = owner_id);


-- INSERT
create policy "Users can create their own tasks"
on public.tasks
for insert
to authenticated
with check ((select auth.uid()) = owner_id);


-- UPDATE
create policy "Users can update their own tasks"
on public.tasks
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);


-- DELETE
create policy "Users can delete their own tasks"
on public.tasks
for delete
to authenticated
using ((select auth.uid()) = owner_id);


-- Automatically maintain updated_at
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();