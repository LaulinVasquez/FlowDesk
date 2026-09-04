-- Lightweight participant comments for collaborative tasks.

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null
    constraint task_comments_task_id_fkey
    references public.tasks(id)
    on delete cascade,
  author_user_id uuid
    constraint task_comments_author_user_id_fkey
    references public.profiles(id)
    on delete set null,
  body text not null
    constraint task_comments_body_check
    check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index task_comments_task_created_idx
  on public.task_comments(task_id, created_at);

alter table public.task_comments enable row level security;

revoke all on table public.task_comments from public, anon, authenticated;
grant select on table public.task_comments to authenticated;

create policy "Task participants can read comments"
on public.task_comments
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks as task
    where task.id = task_comments.task_id
      and (select auth.uid()) in (task.owner_id, task.assigned_user_id)
  )
);

-- The actor is always derived from auth.uid(); clients cannot forge comment
-- authors or comment on work in which they do not participate.
create or replace function public.add_task_comment(
  task_id uuid,
  comment_body text
)
returns public.task_comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_body text := nullif(trim(comment_body), '');
  current_task public.tasks;
  result public.task_comments;
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to comment';
  end if;

  if clean_body is null then
    raise exception using
      errcode = '22023',
      message = 'A comment is required';
  end if;

  if char_length(clean_body) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'Comments must be 2000 characters or fewer';
  end if;

  select task.*
  into current_task
  from public.tasks as task
  where task.id = add_task_comment.task_id;

  if current_task.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Task not found';
  end if;

  if actor_id <> current_task.owner_id
     and (current_task.assigned_user_id is null or actor_id <> current_task.assigned_user_id) then
    raise exception using
      errcode = '42501',
      message = 'Only the task owner or assignee can comment';
  end if;

  insert into public.task_comments (task_id, author_user_id, body)
  values (current_task.id, actor_id, clean_body)
  returning * into result;

  return result;
end;
$$;

revoke all on function public.add_task_comment(uuid, text)
  from public, anon;
grant execute on function public.add_task_comment(uuid, text)
  to authenticated;

-- Current participants may resolve trusted names/avatars for historical
-- comment authors, including a previous assignee after reassignment.
create policy "Task participants can read comment author profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.task_comments as comment
    join public.tasks as task on task.id = comment.task_id
    where (select auth.uid()) in (task.owner_id, task.assigned_user_id)
      and profiles.id = comment.author_user_id
  )
);

comment on table public.task_comments is
  'Lightweight comments visible only to the current task owner and assignee.';
comment on function public.add_task_comment(uuid, text) is
  'Adds a task comment using the authenticated user as its trusted author.';

do $$
declare
  publication_is_all_tables boolean;
begin
  select publication.puballtables
  into publication_is_all_tables
  from pg_catalog.pg_publication as publication
  where publication.pubname = 'supabase_realtime';

  if found and not publication_is_all_tables and not exists (
    select 1
    from pg_catalog.pg_publication_tables as published
    where published.pubname = 'supabase_realtime'
      and published.schemaname = 'public'
      and published.tablename = 'task_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.task_comments';
  end if;
end;
$$;
