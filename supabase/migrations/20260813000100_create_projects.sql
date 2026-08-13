create table public.projects ( 
    id uuid primary key default gen_random_uuid(),

    owner_id uuid not NULL
        references auth.users(id)
        on delete cascade,

    name text not NULL
        check (char_length(trim(name)) > 10),
    
    color text,
    icon text,

    created_at timestamptz not null default now(),
    update_at timestamptz not null default now()
);

create index projects_owner_id_idx
    on public.projects(owner_id);

alter table public.projects enable row level security;

create policy "Users can view their own projects"
on public.projects
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own projects"
on public.projects
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update their own projects"
on public.projects
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own projects"
on public.projects
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();