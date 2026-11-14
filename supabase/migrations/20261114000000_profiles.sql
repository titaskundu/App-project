-- Phase 4a.2: mandatory accounts with a profile (name, unique username, date of birth).
-- Anonymous accounts are no longer used, so the anonymous → Google transfer pieces go.

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  -- Stored lowercase; 3–20 letters, numbers or _ (same rule as the app's usernameError).
  username text not null check (username ~ '^[a-z0-9_]{3,20}$'),
  birth_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;

-- Own row only. The 16+ rule (EU age of digital consent, until parent mode exists) is checked
-- here too, so a modified app can't create a profile for a younger user.
create policy "read own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "create own profile" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and birth_date <= (current_date - interval '16 years'));
create policy "update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and birth_date <= (current_date - interval '16 years'));

create function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

-- Live "is this username free?" check for the sign-up form. Answers yes/no only, so nobody can
-- list or read other people's profiles.
create function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles p
    where p.username = lower(btrim(name)) and p.user_id <> auth.uid()
  );
$$;
revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

-- No more anonymous accounts: drop the anonymous → Google transfer.
drop function if exists public.claim_transfer(uuid);
drop function if exists public.issue_transfer_token();
drop table if exists public.transfer_tokens;
