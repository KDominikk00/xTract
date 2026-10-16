-- Run this in Supabase SQL editor to enable persistent followed stocks.

create table if not exists public.followed_stocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create index if not exists followed_stocks_user_idx on public.followed_stocks(user_id);

alter table public.followed_stocks enable row level security;

drop policy if exists "Users can read own followed stocks" on public.followed_stocks;
create policy "Users can read own followed stocks"
  on public.followed_stocks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own followed stocks" on public.followed_stocks;
create policy "Users can insert own followed stocks"
  on public.followed_stocks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own followed stocks" on public.followed_stocks;
create policy "Users can delete own followed stocks"
  on public.followed_stocks
  for delete
  using (auth.uid() = user_id);
