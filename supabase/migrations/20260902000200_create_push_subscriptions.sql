create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy "Users can read own push subscriptions" on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own push subscriptions" on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own push subscriptions" on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own push subscriptions" on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);
create trigger set_push_subscriptions_updated_at before update on public.push_subscriptions for each row execute function public.set_updated_at();
