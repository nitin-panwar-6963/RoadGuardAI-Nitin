-- RoadGuard AI — restrict Supabase Auth sign-ups/sign-ins to @miet.ac.in
-- Applies to BOTH Google OAuth sign-ins and email/password sign-ups, since
-- both create a row in auth.users and this trigger fires on that insert.
--
-- WHY THIS FILE EXISTS:
-- next.config.ts uses `output: "export"` (a static export), so there is no
-- Next.js server or middleware at runtime to gate the dashboard route — the
-- app is plain static HTML/JS served by nginx. That means client-side checks
-- (see lib/supabase/AuthProvider.tsx) are only a UX layer, not a real
-- security boundary: a modified/self-hosted client could skip them.
--
-- The trusted layer available here is Supabase itself. Run this in the
-- Supabase SQL editor for your project (Database > SQL Editor) to reject
-- non-@miet.ac.in sign-ins at the database level, before a session is ever
-- issued.
--
-- This does not touch the existing RoadGuard application database/schema —
-- it only adds a trigger on Supabase's own `auth.users` table, which is
-- part of the new authentication layer, not the existing app data.

create or replace function public.enforce_miet_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or right(lower(new.email), length('@miet.ac.in')) <> '@miet.ac.in' then
    raise exception 'Only @miet.ac.in accounts may access RoadGuard AI.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_miet_email_domain_trigger on auth.users;

create trigger enforce_miet_email_domain_trigger
  before insert on auth.users
  for each row
  execute function public.enforce_miet_email_domain();

-- NOTES:
-- 1. This blocks account creation for disallowed domains, which covers every
--    user's first Google sign-in. Existing rows are unaffected retroactively —
--    if any non-@miet.ac.in account was ever created before this trigger
--    existed, remove it manually from Supabase Auth > Users.
-- 2. If you'd rather do this without SQL, Supabase also supports blocking
--    domains via an Auth Hook (Beta) configured in Dashboard > Authentication
--    > Hooks — functionally equivalent, just a different place to configure it.
-- 3. Keep the client-side check in AuthProvider.tsx too — it gives instant
--    feedback and a clean sign-out instead of a raw Postgres error reaching the UI.
