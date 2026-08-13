create or replace function public.task_project_belongs_to_owner(
  task_owner_id uuid,
  task_project_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    task_project_id is null
    or exists (
      select 1
      from public.projects
      where projects.id = task_project_id
        and projects.owner_id = task_owner_id
    );
$$;

drop policy if exists "Users can create their own tasks"
on public.tasks;

create policy "Users can create their own tasks"
on public.tasks
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and public.task_project_belongs_to_owner(owner_id, project_id)
);

drop policy if exists "Users can update their own tasks"
on public.tasks;

create policy "Users can update their own tasks"
on public.tasks
for update
to authenticated
using (
  (select auth.uid()) = owner_id
)
with check (
  (select auth.uid()) = owner_id
  and public.task_project_belongs_to_owner(owner_id, project_id)
);