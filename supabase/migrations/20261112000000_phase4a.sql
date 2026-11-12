-- Phase 4a: accounts, sync and data controls.
-- Every table is private to its owner (row-level security). user_id defaults to the signed-in
-- user, so the app never sends it. Deleting the auth user deletes everything (on delete cascade).

-- Snapshots of the phone's stores: 'brain' (topics, ratings…), 'muscle' (movement checks,
-- totals), 'blocker' (limits per app / Reels scope).
create table public.user_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key in ('brain', 'muscle', 'blocker')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- One row per toll or practice result. id is made on the phone so a retried upload can't
-- create a duplicate.
create table public.toll_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ts timestamptz not null,
  kind text not null check (kind in ('brain', 'muscle', 'bank')),
  mode text not null check (mode in ('toll', 'practice')),
  scope text,
  passed boolean not null,
  minutes integer not null default 0,
  detail jsonb not null default '{}'::jsonb
);
create index toll_events_user_ts on public.toll_events (user_id, ts desc);

-- Every Brain answer (mirrors the phone's brain.db). Feeds the difficulty model in Phase 4b.
create table public.answers (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ts timestamptz not null,
  mode text not null check (mode in ('toll', 'practice', 'calibration')),
  question_id text not null,
  area text not null,
  subskill text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  correct boolean not null,
  ms integer not null,
  fast boolean not null
);
create index answers_user_ts on public.answers (user_id, ts desc);
create index answers_question on public.answers (question_id);

alter table public.user_state enable row level security;
alter table public.toll_events enable row level security;
alter table public.answers enable row level security;

create policy "own state" on public.user_state for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own events" on public.toll_events for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own answers" on public.answers for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- "Delete my data": removes the signed-in user; every row above goes with it.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- New phone / reinstall: the phone starts on a fresh anonymous account, then signs in to an
-- existing Google-backed account. Before switching, the anonymous session issues a one-time
-- token; after switching, the Google session claims it, which moves the anonymous account's
-- events and answers across and deletes the anonymous user. Only the anonymous session can
-- issue its own token, so nobody can claim someone else's data.
create table public.transfer_tokens (
  token uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);
alter table public.transfer_tokens enable row level security;
-- No policies: only the functions below (security definer) touch this table.

create function public.issue_transfer_token()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'only anonymous accounts can be transferred';
  end if;
  delete from public.transfer_tokens where from_user = auth.uid();
  insert into public.transfer_tokens (from_user) values (auth.uid()) returning token into t;
  return t;
end;
$$;

create function public.claim_transfer(transfer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  src uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.transfer_tokens
    where token = transfer and expires_at > now()
    returning from_user into src;
  if src is null then
    raise exception 'transfer token is invalid or expired';
  end if;
  if src = auth.uid() then
    return;
  end if;
  update public.toll_events set user_id = auth.uid() where user_id = src;
  update public.answers set user_id = auth.uid() where user_id = src;
  -- The anonymous account's snapshots are replaced by the restored backup; drop the user.
  delete from auth.users where id = src;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.issue_transfer_token() from public, anon;
revoke all on function public.claim_transfer(uuid) from public, anon;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.issue_transfer_token() to authenticated;
grant execute on function public.claim_transfer(uuid) to authenticated;
