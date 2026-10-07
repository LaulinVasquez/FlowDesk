alter table public.profiles add column email text;
update public.profiles p set email = lower(u.email) from auth.users u where u.id = p.id;
create unique index profiles_email_unique_idx on public.profiles(lower(email)) where email is not null;

create table public.user_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index user_connections_pair_unique_idx on public.user_connections(least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index user_connections_requester_idx on public.user_connections(requester_id);
create index user_connections_addressee_idx on public.user_connections(addressee_id);
alter table public.user_connections enable row level security;
create policy "Connection participants can read" on public.user_connections for select to authenticated using ((select auth.uid()) in (requester_id, addressee_id));
create policy "Users can request connections" on public.user_connections for insert to authenticated with check ((select auth.uid()) = requester_id);
create policy "Connection participants can remove" on public.user_connections for delete to authenticated using ((select auth.uid()) in (requester_id, addressee_id));
create trigger set_user_connections_updated_at before update on public.user_connections for each row execute function public.set_updated_at();

create or replace function public.find_profile_by_email(search_email text)
returns table(id uuid, full_name text, avatar_url text, email text)
language sql security definer set search_path = '' stable
as $$ select p.id, p.full_name, p.avatar_url, p.email from public.profiles p where lower(p.email) = lower(trim(search_email)) and p.id <> auth.uid() limit 1 $$;
revoke all on function public.find_profile_by_email(text) from public;
grant execute on function public.find_profile_by_email(text) to authenticated;

create policy "Connections can read participant profiles" on public.profiles for select to authenticated using (
  exists (select 1 from public.user_connections c where auth.uid() in (c.requester_id, c.addressee_id) and profiles.id in (c.requester_id, c.addressee_id))
);

create or replace function public.respond_to_connection(connection_id uuid, response text)
returns public.user_connections language plpgsql security definer set search_path = '' as $$
declare result public.user_connections;
begin
  if response not in ('accepted','rejected') then raise exception 'Invalid connection response'; end if;
  update public.user_connections set status = response where id = connection_id and addressee_id = auth.uid() and status = 'pending' returning * into result;
  if result.id is null then raise exception 'Pending connection request not found'; end if;
  return result;
end $$;
revoke all on function public.respond_to_connection(uuid,text) from public;
grant execute on function public.respond_to_connection(uuid,text) to authenticated;

alter table public.tasks
  add column assigned_user_id uuid references public.profiles(id) on delete set null,
  add column stage text not null default 'assigned' check (stage in ('assigned', 'working', 'reviewed', 'approved'));
create index tasks_assigned_user_idx on public.tasks(assigned_user_id);
create policy "Assignees can view assigned tasks" on public.tasks for select to authenticated using ((select auth.uid()) = assigned_user_id);

create or replace function public.validate_task_assignment()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.assigned_user_id is not null and new.assigned_user_id <> new.owner_id and not exists (
    select 1 from public.user_connections c where c.status = 'accepted'
      and ((c.requester_id = new.owner_id and c.addressee_id = new.assigned_user_id) or (c.addressee_id = new.owner_id and c.requester_id = new.assigned_user_id))
  ) then raise exception 'Tasks may only be assigned to accepted connections'; end if;
  return new;
end $$;
create trigger validate_tasks_assignment before insert or update of assigned_user_id on public.tasks for each row execute function public.validate_task_assignment();

create or replace function public.update_assigned_task_stage(task_id uuid, next_stage text)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare current_task public.tasks;
begin
  if next_stage not in ('assigned','working','reviewed','approved') then raise exception 'Invalid task stage'; end if;
  select * into current_task from public.tasks t where t.id = task_id;
  if current_task.id is null then raise exception 'Task not found'; end if;
  if next_stage = 'working' and not (auth.uid() = current_task.assigned_user_id and current_task.stage in ('assigned','reviewed')) then raise exception 'Only the assignee can start or resume work'; end if;
  if next_stage = 'reviewed' and not (auth.uid() = current_task.assigned_user_id and current_task.stage = 'working') then raise exception 'Only the assignee can submit work for review'; end if;
  if next_stage = 'approved' and not (auth.uid() = current_task.owner_id and current_task.stage = 'reviewed') then raise exception 'Only the task owner can approve reviewed work'; end if;
  if next_stage = 'assigned' and auth.uid() <> current_task.owner_id then raise exception 'Only the task owner can reset the workflow'; end if;
  update public.tasks set stage = next_stage where id = task_id returning * into current_task;
  return current_task;
end $$;
revoke all on function public.update_assigned_task_stage(uuid,text) from public;
grant execute on function public.update_assigned_task_stage(uuid,text) to authenticated;
