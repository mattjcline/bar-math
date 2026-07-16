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

-- Editing a bar's kitchen tip-out % / webhook settings affects every
-- bartender's payout at that bar, so — unlike the read-everything
-- model above — this write is gated to signed-in admins/managers only,
-- same role check as "void reports".
create policy "update bars" on bars
  for update to authenticated
  using (
    exists (
      select 1 from users u
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from users u
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'manager')
    )
  );

create policy "read users" on users
  for select to anon, authenticated using (true);

-- Anyone (including the unauthenticated calculator) can auto-create a
-- bartender row on first save, same as before this policy was split --
-- but NOT an admin/manager role. That distinction didn't matter while
-- role was just a label, but it becomes a real privilege-escalation
-- hole once "claim invited user row" below lets a signed-in user link
-- themselves to any unclaimed row matching their email: without this
-- check, an attacker could insert their own admin-role row and then
-- self-claim it.
create policy "create bartender" on users
  for insert to anon, authenticated
  with check (role = 'bartender');

-- Inviting an admin/manager is itself an admin-panel action, gated the
-- same way as the other admin/manager writes below.
create policy "invite admin or manager" on users
  for insert to authenticated
  with check (
    role in ('admin', 'manager')
    and exists (
      select 1 from users u
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'manager')
    )
  );

-- The "self-link-on-first-login" half of onboarding: lets a signed-in
-- user claim their own invited row without an existing admin having to
-- do it for them. Scoped tightly on purpose (unlike the coarser
-- role-only checks elsewhere in this file) -- only rows with no
-- auth_user_id yet, only by exact (case-insensitive) email match
-- against their own verified JWT, and the check clause only allows
-- auth_user_id to be set to their own id.
create policy "claim invited user row" on users
  for update to authenticated
  using (
    auth_user_id is null
    and email is not null
    and lower(email) = lower(auth.jwt() ->> 'email')
  )
  with check (auth_user_id = auth.uid());

-- Editing a bartender's name/active status is gated to admins/managers,
-- same role check used elsewhere. Note this checks role only, not which
-- row is being targeted — same trust model as "update bars" and "void
-- reports": once authenticated as admin/manager, you're a fully trusted
-- operator of this table, not scoped to a subset of rows.
create policy "update users" on users
  for update to authenticated
  using (
    exists (
      select 1 from users u
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from users u
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'manager')
    )
  );

create policy "link user to bar" on user_bars
  for insert to anon, authenticated with check (true);

-- Unlinking (unlike linking) is an admin-panel-only action, so it's
-- gated the same way as the write policies above rather than left
-- wide open.
create policy "unlink user from bar" on user_bars
  for delete to authenticated
  using (
    exists (
      select 1 from users u
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'manager')
    )
  );

create policy "read user_bars" on user_bars
  for select to anon, authenticated using (true);

create policy "read reports" on reports
  for select to anon, authenticated using (true);

create policy "create reports" on reports
  for insert to anon, authenticated with check (true);

-- General updates (e.g. the calculator flipping is_current when a new
-- version is saved) stay wide open like everything else here, EXCEPT
-- is_void: this check forces the resulting row's is_void to match what
-- it already was, so this policy alone can never be used to void a
-- report. Voiding only succeeds via the "void reports" policy below.
create policy "update reports" on reports
  for update to anon, authenticated
  using (true)
  with check (is_void = (select r.is_void from reports r where r.id = reports.id));

-- Voiding a report (setting is_void = true) is the one write in this
-- app that's actually gated by RLS rather than by UI/trust — restricted
-- to signed-in admins/managers, matching the admin panel's own gate.
create policy "void reports" on reports
  for update to authenticated
  using (
    exists (
      select 1 from users u
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'manager')
    )
  )
  with check (
    exists (
      select 1 from users u
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'manager')
    )
  );
