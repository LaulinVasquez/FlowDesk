-- Collaborative board workflow, review notes, and participant-visible activity.
-- Existing task rows and existing assignments are preserved. Only new or changed
-- assignments must belong to an accepted connection.

alter table public.tasks
  add column review_note text;

alter table public.tasks
  add constraint tasks_review_note_length_check
  check (review_note is null or char_length(review_note) <= 2000);

comment on column public.tasks.review_note is
  'The latest owner request-changes note for a collaborative task.';

create table public.task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null
    constraint task_activity_task_id_fkey
    references public.tasks(id)
    on delete cascade,
  actor_user_id uuid
    constraint task_activity_actor_user_id_fkey
    references public.profiles(id)
    on delete set null,
  event_type text not null
    constraint task_activity_event_type_check
    check (event_type in (
      'task_assigned',
      'work_started',
      'submitted_for_review',
      'changes_requested',
      'approved',
      'reassigned',
      'unassigned'
    )),
  from_stage text
    constraint task_activity_from_stage_check
    check (from_stage is null or from_stage in ('assigned', 'working', 'reviewed', 'approved')),
  to_stage text
    constraint task_activity_to_stage_check
    check (to_stage is null or to_stage in ('assigned', 'working', 'reviewed', 'approved')),
  from_assignee_id uuid
    constraint task_activity_from_assignee_id_fkey
    references public.profiles(id)
    on delete set null,
  to_assignee_id uuid
    constraint task_activity_to_assignee_id_fkey
    references public.profiles(id)
    on delete set null,
  note text
    constraint task_activity_note_length_check
    check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index task_activity_task_created_idx
  on public.task_activity(task_id, created_at desc);

create index task_activity_actor_idx
  on public.task_activity(actor_user_id)
  where actor_user_id is not null;

alter table public.task_activity enable row level security;

revoke all on table public.task_activity from public, anon, authenticated;
grant select on table public.task_activity to authenticated;

create policy "Task participants can read activity"
on public.task_activity
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks as task
    where task.id = task_activity.task_id
      and (select auth.uid()) in (task.owner_id, task.assigned_user_id)
  )
);

-- A disconnected assignee remains a participant in their existing task and must
-- still be able to resolve the other participant's trusted profile identity.
create policy "Task participants can read participant profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks as task
    where (select auth.uid()) in (task.owner_id, task.assigned_user_id)
      and profiles.id in (task.owner_id, task.assigned_user_id)
  )
);

-- Validate only a newly created or actually changed assignment. This is
-- intentionally not revalidated during unrelated edits so removing a People
-- connection does not invalidate work that was already assigned.
create or replace function public.validate_task_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.assigned_user_id is not distinct from old.assigned_user_id then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to assign a task';
  end if;

  if (select auth.uid()) <> new.owner_id then
    raise exception using
      errcode = '42501',
      message = 'Only the task owner can assign or reassign this task';
  end if;

  if new.assigned_user_id is not null then
    if new.assigned_user_id = new.owner_id then
      raise exception using
        errcode = '22023',
        message = 'A collaborative task must be assigned to another user';
    end if;

    if not exists (
      select 1
      from public.user_connections as connection
      where connection.status = 'accepted'
        and (
          (connection.requester_id = new.owner_id
            and connection.addressee_id = new.assigned_user_id)
          or
          (connection.addressee_id = new.owner_id
            and connection.requester_id = new.assigned_user_id)
        )
    ) then
      raise exception using
        errcode = '42501',
        message = 'Tasks may only be assigned to accepted connections';
    end if;
  end if;

  -- Every new assignment, reassignment, and unassignment begins a fresh
  -- lifecycle. Unassigning approved work therefore restores it to an active,
  -- unassigned task rather than leaving contradictory completion state behind.
  new.stage := 'assigned';
  new.review_note := null;
  new.completed := false;
  new.completed_at := null;

  return new;
end;
$$;

revoke all on function public.validate_task_assignment()
  from public, anon, authenticated;

drop trigger if exists validate_tasks_assignment on public.tasks;
create trigger validate_tasks_assignment
before insert or update of assigned_user_id on public.tasks
for each row execute function public.validate_task_assignment();

-- Enforce collaboration state changes even if a client attempts a direct task
-- update. The RPCs below remain the supported client API, but authorization does
-- not depend on clients behaving correctly.
create or replace function public.enforce_task_workflow_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  -- The assignment trigger owns all lifecycle resets when the assignee changes.
  if new.assigned_user_id is distinct from old.assigned_user_id then
    return new;
  end if;

  if new.stage is distinct from old.stage then
    if actor_id is null then
      raise exception using
        errcode = '42501',
        message = 'Authentication is required to change task workflow';
    end if;

    if old.assigned_user_id is null then
      raise exception using
        errcode = '22023',
        message = 'An unassigned task cannot move through the collaboration workflow';
    end if;

    if old.stage = 'assigned' and new.stage = 'working' then
      if actor_id <> old.assigned_user_id then
        raise exception using
          errcode = '42501',
          message = 'Only the assignee can start work';
      end if;
    elsif old.stage = 'working' and new.stage = 'reviewed' then
      if actor_id <> old.assigned_user_id then
        raise exception using
          errcode = '42501',
          message = 'Only the assignee can submit work for review';
      end if;
    elsif old.stage = 'reviewed' and new.stage = 'approved' then
      if actor_id <> old.owner_id then
        raise exception using
          errcode = '42501',
          message = 'Only the task owner can approve reviewed work';
      end if;
      new.completed := true;
      new.completed_at := now();
    elsif old.stage = 'reviewed' and new.stage = 'working' then
      if actor_id <> old.owner_id then
        raise exception using
          errcode = '42501',
          message = 'Only the task owner can request changes';
      end if;
      new.review_note := nullif(trim(new.review_note), '');
      if new.review_note is null then
        raise exception using
          errcode = '22023',
          message = 'A review note is required when requesting changes';
      end if;
    else
      raise exception using
        errcode = '22023',
        message = format('Invalid workflow transition from %s to %s', old.stage, new.stage);
    end if;

    if new.stage <> 'approved' then
      new.completed := false;
      new.completed_at := null;
    end if;
  elsif new.review_note is distinct from old.review_note then
    raise exception using
      errcode = '42501',
      message = 'Review notes may only be changed when the owner requests changes';
  elsif old.assigned_user_id is not null
        and (
          new.completed is distinct from old.completed
          or new.completed_at is distinct from old.completed_at
        ) then
    raise exception using
      errcode = '42501',
      message = 'Collaborative task completion is controlled by owner approval';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_task_workflow_change()
  from public, anon, authenticated;

drop trigger if exists enforce_task_workflow_change on public.tasks;
create trigger enforce_task_workflow_change
before update of assigned_user_id, stage, review_note, completed, completed_at
on public.tasks
for each row execute function public.enforce_task_workflow_change();

-- Stage activity is recorded in a trigger so every database-authorized path is
-- audited. actor_user_id always comes from auth.uid(), never from client input.
create or replace function public.log_task_stage_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_event text;
begin
  if new.stage is not distinct from old.stage then
    return null;
  end if;

  activity_event := case
    when old.stage = 'assigned' and new.stage = 'working'
      then 'work_started'
    when old.stage = 'working' and new.stage = 'reviewed'
      then 'submitted_for_review'
    when old.stage = 'reviewed' and new.stage = 'working'
      then 'changes_requested'
    when old.stage = 'reviewed' and new.stage = 'approved'
      then 'approved'
    else null
  end;

  if activity_event is not null then
    insert into public.task_activity (
      task_id,
      actor_user_id,
      event_type,
      from_stage,
      to_stage,
      note
    ) values (
      new.id,
      (select auth.uid()),
      activity_event,
      old.stage,
      new.stage,
      case when activity_event = 'changes_requested' then new.review_note else null end
    );
  end if;

  return null;
end;
$$;

revoke all on function public.log_task_stage_activity()
  from public, anon, authenticated;

drop trigger if exists log_task_stage_activity on public.tasks;
create trigger log_task_stage_activity
after update of stage on public.tasks
for each row execute function public.log_task_stage_activity();

-- Assignment activity is likewise derived from OLD/NEW rows, preventing a
-- caller from forging the actor, former assignee, or new assignee.
create or replace function public.log_task_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_event text;
  previous_assignee uuid;
begin
  if tg_op = 'INSERT' then
    if new.assigned_user_id is null then
      return null;
    end if;
    activity_event := 'task_assigned';
    previous_assignee := null;
  else
    if new.assigned_user_id is not distinct from old.assigned_user_id then
      return null;
    end if;
    previous_assignee := old.assigned_user_id;
    activity_event := case
      when old.assigned_user_id is null then 'task_assigned'
      when new.assigned_user_id is null then 'unassigned'
      else 'reassigned'
    end;
  end if;

  insert into public.task_activity (
    task_id,
    actor_user_id,
    event_type,
    from_stage,
    to_stage,
    from_assignee_id,
    to_assignee_id
  ) values (
    new.id,
    (select auth.uid()),
    activity_event,
    case when tg_op = 'UPDATE' then old.stage else null end,
    new.stage,
    previous_assignee,
    new.assigned_user_id
  );

  return null;
end;
$$;

revoke all on function public.log_task_assignment_activity()
  from public, anon, authenticated;

drop trigger if exists log_task_initial_assignment on public.tasks;
create trigger log_task_initial_assignment
after insert on public.tasks
for each row execute function public.log_task_assignment_activity();

drop trigger if exists log_task_reassignment on public.tasks;
create trigger log_task_reassignment
after update of assigned_user_id on public.tasks
for each row execute function public.log_task_assignment_activity();

-- Supported forward transitions. Requesting changes intentionally has its own
-- RPC because a non-empty review note is part of that operation.
create or replace function public.update_assigned_task_stage(
  task_id uuid,
  next_stage text
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_task public.tasks;
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to change task workflow';
  end if;

  select task.*
  into current_task
  from public.tasks as task
  where task.id = update_assigned_task_stage.task_id
  for update;

  if current_task.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Task not found';
  end if;

  if current_task.assigned_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'An unassigned task cannot move through the collaboration workflow';
  end if;

  if current_task.stage = 'assigned' and next_stage = 'working' then
    if actor_id <> current_task.assigned_user_id then
      raise exception using
        errcode = '42501',
        message = 'Only the assignee can start work';
    end if;
  elsif current_task.stage = 'working' and next_stage = 'reviewed' then
    if actor_id <> current_task.assigned_user_id then
      raise exception using
        errcode = '42501',
        message = 'Only the assignee can submit work for review';
    end if;
  elsif current_task.stage = 'reviewed' and next_stage = 'approved' then
    if actor_id <> current_task.owner_id then
      raise exception using
        errcode = '42501',
        message = 'Only the task owner can approve reviewed work';
    end if;
  else
    raise exception using
      errcode = '22023',
      message = format(
        'Invalid workflow transition from %s to %s',
        current_task.stage,
        next_stage
      );
  end if;

  update public.tasks
  set stage = next_stage
  where id = current_task.id
  returning * into current_task;

  return current_task;
end;
$$;

revoke all on function public.update_assigned_task_stage(uuid, text)
  from public, anon;
grant execute on function public.update_assigned_task_stage(uuid, text)
  to authenticated;

create or replace function public.request_task_changes(
  task_id uuid,
  review_note text
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_task public.tasks;
  actor_id uuid := (select auth.uid());
  clean_note text := nullif(trim($2), '');
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to request changes';
  end if;

  if clean_note is null then
    raise exception using
      errcode = '22023',
      message = 'A review note is required when requesting changes';
  end if;

  if char_length(clean_note) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'Review notes must be 2000 characters or fewer';
  end if;

  select task.*
  into current_task
  from public.tasks as task
  where task.id = request_task_changes.task_id
  for update;

  if current_task.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Task not found';
  end if;

  if actor_id <> current_task.owner_id then
    raise exception using
      errcode = '42501',
      message = 'Only the task owner can request changes';
  end if;

  if current_task.assigned_user_id is null or current_task.stage <> 'reviewed' then
    raise exception using
      errcode = '22023',
      message = 'Changes can only be requested for reviewed collaborative work';
  end if;

  update public.tasks
  set stage = 'working',
      review_note = clean_note
  where id = current_task.id
  returning * into current_task;

  return current_task;
end;
$$;

revoke all on function public.request_task_changes(uuid, text)
  from public, anon;
grant execute on function public.request_task_changes(uuid, text)
  to authenticated;

create or replace function public.reassign_task(
  task_id uuid,
  new_assignee_id uuid
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_task public.tasks;
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to change an assignment';
  end if;

  select task.*
  into current_task
  from public.tasks as task
  where task.id = reassign_task.task_id
  for update;

  if current_task.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Task not found';
  end if;

  if actor_id <> current_task.owner_id then
    raise exception using
      errcode = '42501',
      message = 'Only the task owner can assign or reassign this task';
  end if;

  if new_assignee_id is not null then
    if new_assignee_id = current_task.owner_id then
      raise exception using
        errcode = '22023',
        message = 'A collaborative task must be assigned to another user';
    end if;

    if not exists (
      select 1
      from public.user_connections as connection
      where connection.status = 'accepted'
        and (
          (connection.requester_id = current_task.owner_id
            and connection.addressee_id = new_assignee_id)
          or
          (connection.addressee_id = current_task.owner_id
            and connection.requester_id = new_assignee_id)
        )
    ) then
      raise exception using
        errcode = '42501',
        message = 'Tasks may only be assigned to accepted connections';
    end if;
  end if;

  if current_task.assigned_user_id is not distinct from new_assignee_id then
    return current_task;
  end if;

  update public.tasks
  set assigned_user_id = new_assignee_id
  where id = current_task.id
  returning * into current_task;

  return current_task;
end;
$$;

revoke all on function public.reassign_task(uuid, uuid)
  from public, anon;
grant execute on function public.reassign_task(uuid, uuid)
  to authenticated;

comment on function public.update_assigned_task_stage(uuid, text) is
  'Securely advances collaborative work: assigned to working, working to reviewed, or reviewed to approved.';
comment on function public.request_task_changes(uuid, text) is
  'Allows only the task owner to return reviewed work to working with a required note.';
comment on function public.reassign_task(uuid, uuid) is
  'Allows only the task owner to assign an accepted connection, reassign, or unassign with NULL.';

-- Make collaborative changes available to scoped Supabase Realtime clients.
-- Skip this safely when the publication is absent, covers all tables, or already
-- contains the table (for example when enabled previously in the dashboard).
do $$
declare
  publication_is_all_tables boolean;
begin
  select publication.puballtables
  into publication_is_all_tables
  from pg_catalog.pg_publication as publication
  where publication.pubname = 'supabase_realtime';

  if found and not publication_is_all_tables then
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables as published
      where published.pubname = 'supabase_realtime'
        and published.schemaname = 'public'
        and published.tablename = 'tasks'
    ) then
      execute 'alter publication supabase_realtime add table public.tasks';
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_publication_tables as published
      where published.pubname = 'supabase_realtime'
        and published.schemaname = 'public'
        and published.tablename = 'task_activity'
    ) then
      execute 'alter publication supabase_realtime add table public.task_activity';
    end if;
  end if;
end;
$$;
