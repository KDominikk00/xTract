-- Run this in Supabase SQL editor after the earlier migrations.
-- 1) refund_ai_quota: lets the API reserve quota before calling the model and give it back on failure.
-- 2) follow_stock: enforces the plan's follow limit atomically (count + insert under a per-user lock).

create or replace function public.refund_ai_quota(
  p_user_id uuid,
  p_window_key text,
  p_usage_kind text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_usage_kind not in ('chat', 'suggestion') then
    raise exception 'Invalid usage kind: %', p_usage_kind;
  end if;

  if p_usage_kind = 'chat' then
    update public.ai_usage
      set chat_used = greatest(chat_used - 1, 0), updated_at = now()
      where user_id = p_user_id and window_key = p_window_key;
  else
    update public.ai_usage
      set suggestion_used = greatest(suggestion_used - 1, 0), updated_at = now()
      where user_id = p_user_id and window_key = p_window_key;
  end if;
end;
$$;

revoke all on function public.refund_ai_quota(uuid, text, text) from public;
grant execute on function public.refund_ai_quota(uuid, text, text) to service_role;

create or replace function public.follow_stock(
  p_user_id uuid,
  p_symbol text,
  p_limit integer
)
returns table(allowed boolean, followed_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Serialize follows per user so concurrent requests cannot all pass the limit check.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) into v_count from public.followed_stocks where user_id = p_user_id;

  -- Following an already-followed symbol is idempotent and never blocked by the limit.
  if exists (
    select 1 from public.followed_stocks where user_id = p_user_id and symbol = p_symbol
  ) then
    return query select true, v_count;
    return;
  end if;

  if p_limit is not null and v_count >= p_limit then
    return query select false, v_count;
    return;
  end if;

  insert into public.followed_stocks (user_id, symbol) values (p_user_id, p_symbol);
  return query select true, v_count + 1;
end;
$$;

revoke all on function public.follow_stock(uuid, text, integer) from public;
grant execute on function public.follow_stock(uuid, text, integer) to service_role;
