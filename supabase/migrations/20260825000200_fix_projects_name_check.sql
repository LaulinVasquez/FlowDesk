-- Project names only need to contain at least one non-whitespace character.
-- The original migration accidentally required more than ten characters.
alter table public.projects
  drop constraint if exists projects_name_check;

alter table public.projects
  add constraint projects_name_check
  check (char_length(trim(name)) > 0);
