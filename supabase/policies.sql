-- Bar Math — Row Level Security policies
-- Run this in your Supabase SQL editor after schema.sql.
--
-- The app has no per-bartender login — the calculator uses the anon/
-- publishable key for everyone. The admin panel uses real Supabase Auth
-- (magic link), which makes requests as the `authenticated` role instead
-- of `anon`. Every policy below grants the same access to both roles, so
-- signing in on the admin panel doesn't change what the calculator itself
-- can see/do for that browser session.
--
-- These policies are intentionally wide open (`using (true)` /
-- `with check (true)`) to match the "no per-bartender auth" design —
-- protection against accidental public discovery comes from the
-- client-side password gate on the calculator and real auth on the
-- admin panel, not from RLS narrowing who can read/write. Admin-only
-- WRITE policies (e.g. only admins can edit kitchen_tip_percentage or
-- void a report) get added alongside each admin-panel feature as it's
-- built, not preemptively here.

alter table bars enable row level security;
alter table users enable row level security;
alter table user_bars enable row level security;
alter table reports enable row level security;

create policy "read bars" on bars
  for select to anon, authenticated using (true);

create policy "read users" on users
  for select to anon, authenticated using (true);

create policy "create users" on users
  for insert to anon, authenticated with check (true);

create policy "link user to bar" on user_bars
  for insert to anon, authenticated with check (true);

create policy "read user_bars" on user_bars
  for select to anon, authenticated using (true);

create policy "read reports" on reports
  for select to anon, authenticated using (true);

create policy "create reports" on reports
  for insert to anon, authenticated with check (true);

create policy "update reports" on reports
  for update to anon, authenticated using (true) with check (true);
