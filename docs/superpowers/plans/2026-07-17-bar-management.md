# Bar management (add / rename / remove) — GitHub issue #2

> Status: planned, not yet implemented. Reviewed 2026-07-17; two corrections
> from that review are already folded in below (the calculator-dropdown
> inactive-bar fix, tracked as issue #4, and the explicit `alter table`
> migration SQL for the existing Supabase projects).

## Context

Bar Math currently has no way to add, rename, or remove a bar. `BarSettings.tsx`
only edits kitchen-tip/webhook config for bars that already exist in the
`bars` table — the four rows are effectively fixed at schema-creation time.
This plan closes issue #2 by extending the existing Bar Settings admin tab
(per user decision) rather than adding a new tab.

Two related fragile spots surfaced during exploration and are being fixed as
part of this work, per user decision:

- **Removal safety**: `reports.bar_id` and `user_bars.bar_id` both reference
  `bars(id)` with no `ON DELETE` clause (implicit `NO ACTION`), so a hard
  `DELETE FROM bars` errors out the moment any report or staff link exists.
  Rather than a real delete, "remove a bar" will be a soft-delete via a new
  `bars.is_active` column, mirroring the existing `users.is_active` pattern
  (see `Staff.tsx`'s bartender active/inactive toggle) — fully reversible,
  never orphans `reports`/`user_bars`.
- **Hardcoded default bar**: `App.tsx` line 98 currently does
  `bars.find(b => b.name === "Louie's")` to preselect a bar on load. Renaming
  or removing that bar silently breaks this. The calculator has no
  per-person login (only the shared site password — no bartender identity),
  so there's no server-side concept of "which user" to key a default off
  of. Instead this plan makes the default **per-device**: the last bar
  picked in that browser is remembered in `localStorage` and preselected
  next time, replacing the hardcoded name match. This needs no schema
  change at all.

Decisions locked in with the user:
- Remove = soft-delete (`is_active`), not a hard delete.
- UI lives in the existing **Bar Settings** tab (name becomes editable,
  "Remove"/"Reactivate" toggle added, plus a small "Add a new bar" form).
- Inactive bars still appear in **Reports**' bar filter (history stays
  browsable); they're hidden from the **calculator's** bar-select dropdown
  and from **Staff**'s "+ Add bar" link dropdown for bartenders.
- Fix the hardcoded `"Louie's"` default via a per-device `localStorage`
  "last selected bar" — not a global admin-set default — since each
  device/location tends to consistently close the same bar and this needs
  no backend changes.

## Schema changes (`src/schema.sql`)

Add to the `bars` table definition in `src/schema.sql`:

```sql
create table bars (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  webhook_url              text,
  webhook_delta_threshold  numeric default 20,
  kitchen_tip_percentage   numeric default 12,
  kitchen_tip_method       text not null default 'percentage_of_tips',
  is_active                boolean not null default true
);
```

**Migration for the existing projects**: the block above is the from-scratch
definition for `src/schema.sql` only — do **not** paste it into the Supabase
SQL editor, where `bars` already exists (it would error on `create table`).
What actually gets hand-run against **both** the prod project and the dev
project (`.env.development.local`'s project), per the repo's usual
manual-migration convention, is just:

```sql
alter table bars add column is_active boolean not null default true;
```

No backfill/data migration is required: the default is `true`, so no
existing bar becomes invisible. (No index on `is_active` — the table has
four rows.)

## RLS policy changes (`supabase/policies.sql`)

Only one new policy is needed — soft-delete and rename both go through the
existing `update bars` policy (already a blanket admin/manager check, not
column-scoped), so only **insert** (adding a new bar) needs a new policy:

```sql
-- Adding a new bar is an admin-panel action, gated the same way as the
-- other admin/manager writes (e.g. "insert admin or manager", "update bars").
create policy "insert bars" on bars
  for insert to authenticated
  with check (
    exists (
      select 1 from users u
      where u.auth_user_id = auth.uid()
        and u.role in ('admin', 'manager')
    )
  );
```

Also needs to be run by hand against both Supabase projects.

## Type changes (`src/utils.ts`)

Extend the shared `Bar` type (line 5) used by `App.tsx`:

```ts
export type Bar = {
  id: string;
  name: string;
  kitchen_tip_percentage: number | null;
  kitchen_tip_method: KitchenTipMethod;
  is_active: boolean;
};
```

## `BarSettings.tsx` — the core of this feature

Follow `Staff.tsx`'s established pattern closely (it already solves
name-editing + active-toggle + per-row save in the same admin-tab style):

- **`Bar` type**: add `is_active: boolean`.
- **`Draft` type**: add `name: string; isActive: boolean` (mirrors
  `Staff.tsx`'s `Draft = { name, isActive }`).
- **`toDraft`**: seed `name: bar.name, isActive: bar.is_active`.
- **Fetch** (currently lines 38-53): select `is_active` too; order
  `is_active desc, name` so active bars sort first, matching `Staff.tsx`'s
  existing `showInactive` filter idea — but per the user's decision this tab
  shows *all* bars (active + inactive) at all times since it's the only
  place to reactivate one, so no `showInactive` toggle is needed here
  (unlike Staff.tsx).
- **Name field**: replace the static `<div className="section-title">{bar.name}</div>`
  (line 116) with an editable text `<input>` bound to `draft.name`, same
  `.field` wrapper pattern used for the other inputs in this file.
- **Remove/Reactivate toggle**: add a `btn-toggle-active` button identical in
  behavior to `Staff.tsx` (lines 190-195) — `onClick={() => updateDraft(bar.id, { isActive: !draft.isActive })}`,
  label toggles `"Active" / "Inactive"`. This only flips local draft state;
  it's persisted by the row's existing "Save" button, not a separate
  mutation — no new confirmation dialog needed since it's the same
  reversible pattern `Staff.tsx` already uses for bartenders.
- **`handleSave`** (currently lines 61-98): add validation for the trimmed
  name (non-blank, and a case-insensitive duplicate check against other
  bars' names — client-side only, no new DB constraint, matching how this
  function already validates percentage/threshold ranges client-side).
  Include `name: trimmed, is_active: draft.isActive` in the update payload.
- **Add-a-new-bar form**: a new section below the existing per-bar list,
  divided by `<hr className="divider" />` + `<div className="section-title">`,
  modeled on `AdminUsers.tsx`'s "Invite Admin or Manager" form (controlled
  input, trims + validates non-blank client-side, `btn-save` submit button
  disabled while in flight with a `"Adding…"` label, success/error via the
  same `save-status success` / `field-hint error` classes). Only a Name
  field — kitchen-tip %, method, and webhook fields are left at their schema
  defaults (`12`, `'percentage_of_tips'`, null) and edited afterward through
  the bar's own row, exactly like every other bar today. Same case-insensitive
  duplicate-name check as rename. On success, insert the returned row into
  local `bars` state and seed its `drafts` entry, then clear the form input.

## `App.tsx` changes

- **Fetch** (line 82): add `is_active` to the `.select(...)` columns. Keep
  fetching *all* bars (not `.eq("is_active", true)`) — the full list is
  still needed so that editing an existing report tied to a
  since-deactivated bar (`?editReport=<id>`) can still resolve `selectedBar`
  for the kitchen-tip calculation (line 167: `bars.find(b => b.id === selectedBarId)`).
- **Default-bar selection** (lines 98-99): replace the hardcoded
  `bars.find(b => b.name === "Louie's")` with a per-device "last selected
  bar" read from `localStorage`:
  ```ts
  const LAST_BAR_KEY = "barmath:lastBarId";
  // ...
  const savedBarId = localStorage.getItem(LAST_BAR_KEY);
  const defaultBar = (barsRes.data ?? []).find((b) => b.id === savedBarId && b.is_active);
  if (defaultBar && !editReportId) setSelectedBarId(defaultBar.id);
  ```
  Falls back to no preselection if nothing's saved yet, or the saved bar was
  since deactivated — same graceful no-op as today.
- **Bar dropdown `onChange`** (line 366, currently
  `onChange={(e) => setSelectedBarId(e.target.value)}`): also persist the
  choice — `localStorage.setItem(LAST_BAR_KEY, e.target.value)` — so the
  next visit on this device remembers it. Deliberately *only* written here,
  not from the `editReportId` effect that also calls `setSelectedBarId`
  (around line 103+) — opening an old report to edit shouldn't overwrite the
  device's normal remembered bar.
- **Bar dropdown options** (lines 363-377): filter to
  `bars.filter(b => b.is_active || b.id === selectedBarId)` — active bars,
  **plus the currently selected bar even if inactive**. The extra clause is
  load-bearing, not belt-and-suspenders (issue #4): when editing a report
  (`?editReport=<id>`) whose bar has since been deactivated,
  `selectedBarId` is that inactive bar's id, and a controlled `<select>`
  whose value matches no `<option>` renders blank — the manager would see
  an empty (disabled) bar selector on the report they're editing. Keeping
  the selected bar in the options fixes the display; an active-only filter
  alone would not. A removed bar still can't be *newly* selected for a
  fresh shift, since it only appears as an option while it's already the
  selection.

## `Staff.tsx` changes

- **`Bar` type** (line 11): add `is_active: boolean`.
- **Fetch** (lines 31-35): select `is_active` too.
- **`availableBars`** (line 175, `bars.filter(b => !linkedBarIds.includes(b.id))`):
  also filter `&& b.is_active`, so the "+ Add bar" dropdown can't newly link
  a bartender to a removed bar. Existing links to a bar that's since been
  deactivated are left untouched (still shown as a chip via `barName(barId)`)
  — deactivating a bar shouldn't silently sever historical staff↔bar
  associations, same spirit as deactivating a bartender not deleting their
  `user_bars` rows.
- The top-of-tab bar filter dropdown (lines 144-151) is left as-is (all
  bars) — filtering staff by a since-removed bar is still a reasonable thing
  to want to do.

## `Reports.tsx` changes

No filtering changes needed — the bar filter dropdown already shows all
bars and this is deliberately kept per the user's decision (inactive bars
stay browsable for history). Optional small polish: select `is_active` too
and append `" (inactive)"` to a bar's option label when `!b.is_active`, so
admins aren't confused seeing a removed bar's name unlabeled in the filter.

## Verification

- `npm start` (hits the dev Supabase project) after running the schema +
  policy SQL by hand against the dev project.
- In Bar Settings: add a new bar, confirm it appears immediately and is
  editable; rename an existing bar and confirm the new name shows up in the
  calculator's dropdown and Reports' filter; toggle a bar inactive and
  confirm it disappears from the calculator dropdown and Staff's "+ Add bar"
  dropdown but still appears in Reports' filter and Bar Settings itself
  (with a "Reactivate" affordance); toggle it back active.
- In the calculator (no `?admin`), select a bar, reload the page, and
  confirm that same bar is preselected (verifies the `localStorage`
  read/write round-trip). Switch to a different bar, reload again, confirm
  the new choice sticks. Deactivate the currently-remembered bar from Bar
  Settings and reload the calculator — confirm nothing is preselected
  (graceful fallback) rather than an error.
- Edit a report (`?editReport=<id>`) for a bar that's been deactivated —
  confirm the disabled bar dropdown still displays that bar's name, not a
  blank selector (issue #4), and the kitchen-tip math still resolves.
- Attempt a duplicate bar name (case-insensitive) both when adding and when
  renaming — confirm a friendly client-side error instead of a raw Postgres
  error.
- Check mobile: the new "Add a new bar" name input and the rename input
  must be ≥16px font-size (CLAUDE.md's iOS Safari zoom rule) and the tab
  must not horizontally overflow at 375px width with a long bar name.
- `npm test -- --watchAll=false` if any existing tests touch `BarSettings.tsx`,
  `App.tsx`, or `Staff.tsx`.
