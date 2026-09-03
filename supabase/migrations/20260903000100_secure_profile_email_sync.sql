-- Profile email is identity data. Keep auth.users as its only source of truth.
create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
  picture_url text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'FlowDesk user'
  );
  picture_url := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );

  insert into public.profiles (id, full_name, avatar_url, email)
  values (new.id, display_name, picture_url, lower(new.email))
  on conflict (id) do update
  set email = lower(new.email),
      full_name = case when trim(public.profiles.full_name) = '' then excluded.full_name else public.profiles.full_name end,
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
      updated_at = now();
  return new;
end;
$$;
revoke all on function public.sync_profile_from_auth_user() from public, anon, authenticated;

-- Clear copied values first so a stale/spoofed address cannot block its real owner.
update public.profiles set email = null where email is not null;
insert into public.profiles (id, full_name, avatar_url, email)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''), nullif(split_part(u.email, '@', 1), ''), 'FlowDesk user'),
  coalesce(nullif(u.raw_user_meta_data ->> 'avatar_url', ''), nullif(u.raw_user_meta_data ->> 'picture', '')),
  lower(u.email)
from auth.users u
where u.email is not null
on conflict (id) do update
set email = excluded.email,
    updated_at = now();

drop trigger if exists sync_profile_from_auth_user on auth.users;
create trigger sync_profile_from_auth_user
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_profile_from_auth_user();

-- Preserve normal profile/settings writes while making email server-managed.
revoke insert, update on public.profiles from public, anon, authenticated;
grant update (full_name, avatar_url, default_reminder_minutes)
  on public.profiles to authenticated;
