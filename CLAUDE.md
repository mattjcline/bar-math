# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bar Math is a single-page end-of-night calculator for bartenders/bar managers. Given credit card tips, cash tips, till counts, and staff hours, it computes total tips, hourly tip-out rate, till over/short delta, and per-bartender payouts. Bootstrapped with Create React App, deployed to GitHub Pages at `mattjcline.github.io/bar-math`.

## Commands

- `npm start` — run dev server at http://localhost:3000 (CRA hot reload)
- `npm test` — run tests via `react-scripts test` (Jest, interactive watch mode; pass `-- --watchAll=false` for a single non-watch run)
- `npm run build` — production build to `build/`
- `npm run deploy` — builds and publishes `build/` to GitHub Pages via `gh-pages`
- `npm run dev:signin -- you@example.com [port]` — mints a real admin-panel session via the Supabase admin API (using `SUPABASE_SERVICE_KEY` from `.env.local`) and opens it, skipping the magic-link email entirely. Supabase's built-in email sender rate-limits hard after a few sends, so use this for local admin-panel testing instead of repeatedly requesting real magic links. Requires `npm start` already running. Local-only — lives in `scripts/`, outside `src/`, never bundled into the shipped app.

There is no separate lint command; ESLint runs as part of `react-scripts start`/`build` via the `eslintConfig` (`react-app`, `react-app/jest`) in `package.json`.

## Architecture

Two entry points, chosen in `src/index.tsx` by a query-string check (`?admin`) — not the URL hash, since Supabase's magic-link auth redirect puts session tokens in the hash fragment and a hash-based router would collide with it:
- No `?admin` → `src/App.tsx`, the calculator. Everything is local `useState` in one component, no component tree or state management library.
- `?admin` present → `src/Admin.tsx`, the admin panel: a magic-link sign-in + authorization check, then (once signed in as `admin`/`manager`) a tab bar switching between `src/Reports.tsx`, `src/BarSettings.tsx`, and `src/Staff.tsx`. See "Admin panel" below.

The calculator (`App.tsx`) is still one file with no routing/state-management library internally — the split above is only between "calculator" and "admin," not a general move to multi-page architecture within each.

Key structure within `App.tsx`:
- `src/App.css` — a plain external stylesheet (not CSS modules, not styled-components) imported by both `App.tsx` and `Admin.tsx`. All visual design lives here, dark-themed, using shared class names (`.card`, `.result-block`, `.till-badge`, `.field`, `.btn-save`, etc.) — new admin-panel components reuse these rather than inventing parallel styles. `.header` in particular is shared by both entry points, so layout changes scoped to only one of them (e.g. the admin header's signed-in strip) need their own additional class rather than changing `.header` itself.
- Pure helper functions above the component: `customRound` (rounds up at `.9` instead of `.5`, used only for displayed bartender payouts), `fmt`/`fmtInt` (currency formatting), `getDefaultDate` (defaults the shift date to "today", but before 6am rolls back to the previous calendar day, since a bar's business day extends past midnight).
- Bartender rows are an array of `{ id, name, hours }` in state, mutated via `addBartender`/`removeBartender`/`updateBartender`; `id` is assigned from a module-level `nextId` counter (not reset on remount).
- All derived values (`totalTips`, `totalHours`, `hourlyRate`, `expectedTill`, `delta`, `hasTill`) are computed inline on every render from the raw string-valued inputs — no `useMemo`, no effects. Numeric inputs are stored as strings and parsed with `parseFloat(...) || 0` at use time.
- Till math: `expectedTill = cashSales + amBank`; `delta = till - expectedTill`. `amBank` defaults to `"400"`.
- Kitchen tip-out comes off the top before bartenders are paid: each bar has a `kitchen_tip_percentage` and a `kitchen_tip_method` (Supabase `bars` table, editable per-bar in the admin panel's Bar Settings tab — not editable from this calculator). Method is `'percentage_of_tips'` (default; e.g. 12% at most bars) or `'percentage_of_gross_kitchen_sales'` (e.g. Tempest, 10%) — the percentage is always applied against whichever base the method selects, via `computeKitchenTipAmount` in `utils.ts`: `kitchenTipAmount = (method === "percentage_of_gross_kitchen_sales" ? grossKitchenSales : totalTips) * kitchenTipPct / 100`; `tipPool = totalTips - kitchenTipAmount`; `hourlyRate = tipPool / totalHours` (not `totalTips / totalHours`). Gross-kitchen-sales bars get an extra required "Gross Kitchen Sales" input on the calculator, since nothing else the calculator collects gives that number. The method and percentage actually used are snapshotted onto the saved report (`reports.kitchen_tip_method`, `reports.kitchen_tip_percentage`) so history stays accurate if a bar's settings change later; `reports.kitchen_tip_amount` is a generated column derived from them (and from `reports.gross_kitchen_sales` when applicable).

When editing, keep new state/derived-value patterns consistent with this style (plain `useState` + inline derivation) rather than introducing new abstractions — the app is intentionally small and flat.

## Admin panel

Three tabs in `Admin.tsx`, each its own flat component following the same plain-`useState` style as the calculator — no shared state/context between tabs, each fetches its own data on mount:

- **Reports** (`Reports.tsx`) — lists saved shifts grouped by bar + date, filterable by bar. Each report can have multiple versions (re-saving a shift from the calculator bumps `version` rather than overwriting); clicking a version in a report's "Version History" views that specific version's full detail instead of always the latest, with a banner making it unmistakable when you're looking at a superseded version. Voiding a report (`is_void = true`) is one-way — there's no un-void UI (see "Known gaps" below).
- **Bar Settings** (`BarSettings.tsx`) — per-bar edit form for `kitchen_tip_percentage` and the (currently unused — see "Known gaps") `webhook_url`/`webhook_delta_threshold`. Edits existing bars only; no add/rename/remove.
- **Staff** (`Staff.tsx`) — lists bartenders (`role = 'bartender'` only; admin/manager accounts are out of scope here), with editable name/active-status and `user_bars` link management (chip-based add/remove). Deactivating someone (`is_active = false`) just hides them from the calculator's staff autocomplete in `App.tsx` — it's not a delete.

All three are read-heavy, low-traffic admin screens for a single small business, so none of them paginate, cache, or debounce — they refetch in full on mount/filter-change, which is fine at this scale.

## Auth

Two separate, deliberately different auth models:
- **Calculator**: a single shared password (`REACT_APP_SITE_PASSWORD`), checked client-side, unlock flag in `localStorage`. Not real security (the password is inlined in the shipped JS bundle) — it only exists to keep casual visitors from stumbling onto it. No per-person identity.
- **Admin** (`Admin.tsx`): real Supabase Auth via magic link (passwordless email). `public.users.auth_user_id` links a Supabase Auth account to a row in the app's own `users` table; access is authorized only if that row's `role` is `'admin'` or `'manager'`. Regular auto-created bartenders never get an `auth_user_id` and can't sign in anywhere.
- RLS policies (`supabase/policies.sql`) grant identical *read* access `to anon, authenticated` — signing into the admin panel must not change what the calculator itself can see in that browser session. *Writes* are a deliberate exception: each admin-panel feature that mutates something sensitive (voiding a report, editing `bars`, editing/deactivating a `users` row, unlinking `user_bars`) gets its own policy gated to `role in ('admin', 'manager')`, added alongside that feature as it's built — not preemptively, and not extended to reads. These policies check role only, not which specific row is targeted: once authenticated as admin/manager you're a fully trusted operator of the table, the same trust model repeated across `update bars`, `update users`, `void reports`, and `unlink user from bar`. Migrations to `policies.sql` aren't applied automatically — after editing the file, the corresponding SQL has to be run by hand in the Supabase SQL editor (there's no CLI link/migration runner set up for this project).

## Mobile responsiveness

This app is used on phones behind a bar at close-out, and must always work well there, especially on iOS Safari. Any change touching layout or form controls must preserve this:

- Every `input`, `select`, and `textarea` (including ones with inline `style`, like the invisible date-input overlay) must have `font-size` >= 16px. Below that threshold, iOS Safari auto-zooms the whole page on focus and the user has to manually zoom back out on every tap — this is the most common way this app breaks on iOS, and it's easy to reintroduce by adding a new field with a smaller `rem` value to match surrounding text.
- Verify no horizontal overflow at narrow widths (375px and 390px are good baselines) after any layout change, including with realistic long content (long bar names, long staff names) — check `document.documentElement.scrollWidth` against `clientWidth`, since visual overflow can be easy to miss in a quick look.
- The `.grid` and `.results-grid` two-column layouts collapse to one column via `@media (max-width: 640px)`; keep new multi-column layouts consistent with that pattern rather than introducing fixed-width layouts that don't collapse.

## Known gaps / not yet built

Still hack-mode, nothing here is live for real users yet — tracked so this doesn't get lost, not because any of it is urgent:

- **Webhook alerting isn't wired up.** `bars.webhook_url` / `bars.webhook_delta_threshold` are editable in Bar Settings and `reports.webhook_sent` exists as a column, but nothing ever reads them or fires a request — no Supabase Edge Function or DB trigger exists yet. Right now editing those fields in Bar Settings has no effect beyond storing the values. Destination platform, researched but not decided: **Discord** fits the existing `bars.webhook_url` field well — a bar creates a webhook URL in their own channel's settings, and alerting is a plain `POST` of a JSON body to that URL, no auth/tokens/third-party account needed on our end. **WhatsApp** doesn't support simple inbound webhook URLs the way Discord/Slack do — it would require going through Twilio's WhatsApp API or Meta's official WhatsApp Cloud API instead, with stored credentials in an Edge Function, a meaningfully bigger lift and a different shape for `webhook_url` (a destination number/API config, not a bare POST-able URL).
- **No admin/manager onboarding flow.** Promoting someone to `role = 'admin'`/`'manager'` and linking their `auth_user_id` is still a manual step in the Supabase SQL editor. A real flow would need an invite-then-self-link-on-first-login pattern (a `users.email` column plus a narrow RLS policy letting a signed-in user claim their own invited row) — deliberately deferred as a bigger, separate feature when Staff was scoped.
- **No bar management.** Bar Settings edits the 4 existing bars only; adding, renaming, or removing a bar isn't supported anywhere in the UI.
- **Voiding a report is one-way.** There's no un-void action in the Reports tab; reversing a mistaken void currently requires a direct DB edit.
