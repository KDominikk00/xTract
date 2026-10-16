-- Run this in Supabase SQL editor before using server-enforced AI quota + billing.

create extension if not exists pgcrypto;

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_key text not null,
  chat_used integer not null default 0,
  suggestion_used integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, window_key)
);

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  status text not null,
  price_id text,
  tier text not null default 'free' check (tier in ('free', 'plus', 'pro')),
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_usage_user_idx on public.ai_usage(user_id);
create index if not exists user_subscriptions_user_idx on public.user_subscriptions(user_id);
create index if not exists user_subscriptions_customer_idx on public.user_subscriptions(stripe_customer_id);

alter table public.ai_usage enable row level security;
alter table public.billing_customers enable row level security;
alter table public.user_subscriptions enable row level security;

drop policy if exists "Users can read own ai usage" on public.ai_usage;
create policy "Users can read own ai usage"
  on public.ai_usage
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own billing customer" on public.billing_customers;
create policy "Users can read own billing customer"
  on public.billing_customers
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read own subscriptions" on public.user_subscriptions;
create policy "Users can read own subscriptions"
  on public.user_subscriptions
  for select
  using (auth.uid() = user_id);

create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_window_key text,
  p_usage_kind text,
  p_chat_limit integer,
  p_suggestion_limit integer
)
returns table(
  allowed boolean,
  chat_remaining integer,
  suggestion_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_used integer;
  v_suggestion_used integer;
begin
  if p_usage_kind not in ('chat', 'suggestion') then
    raise exception 'Invalid usage kind: %', p_usage_kind;
  end if;

  insert into public.ai_usage (user_id, window_key, chat_used, suggestion_used, updated_at, created_at)
  values (p_user_id, p_window_key, 0, 0, now(), now())
  on conflict (user_id, window_key) do nothing;

  if p_usage_kind = 'chat' then
    update public.ai_usage
      set chat_used = chat_used + 1,
          updated_at = now()
      where user_id = p_user_id
        and window_key = p_window_key
        and chat_used < p_chat_limit
      returning chat_used, suggestion_used into v_chat_used, v_suggestion_used;
  else
    update public.ai_usage
      set suggestion_used = suggestion_used + 1,
          updated_at = now()
      where user_id = p_user_id
        and window_key = p_window_key
        and suggestion_used < p_suggestion_limit
      returning chat_used, suggestion_used into v_chat_used, v_suggestion_used;
  end if;

  if v_chat_used is null then
    select chat_used, suggestion_used
      into v_chat_used, v_suggestion_used
      from public.ai_usage
      where user_id = p_user_id and window_key = p_window_key;

    return query
      select
        false,
        greatest(p_chat_limit - coalesce(v_chat_used, 0), 0),
        greatest(p_suggestion_limit - coalesce(v_suggestion_used, 0), 0);
    return;
  end if;

  return query
    select
      true,
      greatest(p_chat_limit - v_chat_used, 0),
      greatest(p_suggestion_limit - v_suggestion_used, 0);
end;
$$;

revoke all on function public.consume_ai_quota(uuid, text, text, integer, integer) from public;
grant execute on function public.consume_ai_quota(uuid, text, text, integer, integer) to service_role;
