# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bar Math is a single-page end-of-night calculator for bartenders/bar managers. Given credit card tips, cash tips, till counts, and staff hours, it computes total tips, hourly tip-out rate, till over/short delta, and per-bartender payouts. Bootstrapped with Create React App, deployed to GitHub Pages at `mattjcline.github.io/bar-math`.

## Commands

- `npm start` — run dev server at http://localhost:3000 (CRA hot reload)
- `npm test` — run tests via `react-scripts test` (Jest, interactive watch mode; pass `-- --watchAll=false` for a single non-watch run)
- `npm run build` — production build to `build/`
- `npm run deploy` — builds and publishes `build/` to GitHub Pages via `gh-pages`

There is no separate lint command; ESLint runs as part of `react-scripts start`/`build` via the `eslintConfig` (`react-app`, `react-app/jest`) in `package.json`.

## Architecture

Two entry points, chosen in `src/index.tsx` by a query-string check (`?admin`) — not the URL hash, since Supabase's magic-link auth redirect puts session tokens in the hash fragment and a hash-based router would collide with it:
- No `?admin` → `src/App.tsx`, the calculator. Everything is local `useState` in one component, no component tree or state management library.
- `?admin` present → `src/Admin.tsx`, the admin login (currently just a magic-link sign-in + authorization check; the actual admin panel screens don't exist yet).

The calculator (`App.tsx`) is still one file with no routing/state-management library internally — the split above is only between "calculator" and "admin," not a general move to multi-page architecture within each.

Key structure within `App.tsx`:
- `STYLES` — a template-literal CSS string injected via a `<style>` tag at render time (no CSS modules, no styled-components, no external stylesheet). All visual design lives here, dark-themed, using CSS custom class names (`.card`, `.result-block`, `.till-badge`, etc.).
- Pure helper functions above the component: `customRound` (rounds up at `.9` instead of `.5`, used only for displayed bartender payouts), `fmt`/`fmtInt` (currency formatting), `getDefaultDate` (defaults the shift date to "today", but before 6am rolls back to the previous calendar day, since a bar's business day extends past midnight).
- Bartender rows are an array of `{ id, name, hours }` in state, mutated via `addBartender`/`removeBartender`/`updateBartender`; `id` is assigned from a module-level `nextId` counter (not reset on remount).
- All derived values (`totalTips`, `totalHours`, `hourlyRate`, `expectedTill`, `delta`, `hasTill`) are computed inline on every render from the raw string-valued inputs — no `useMemo`, no effects. Numeric inputs are stored as strings and parsed with `parseFloat(...) || 0` at use time.
- Till math: `expectedTill = cashSales + amBank`; `delta = till - expectedTill`. `amBank` defaults to `"400"`.
- Kitchen tip-out comes off the top before bartenders are paid: each bar has a `kitchen_tip_percentage` (Supabase `bars` table, default 12%, editable per-bar in the forthcoming admin panel — not editable from this calculator). `kitchenTipAmount = totalTips * kitchenTipPct / 100`; `tipPool = totalTips - kitchenTipAmount`; `hourlyRate = tipPool / totalHours` (not `totalTips / totalHours`). The percentage actually used is snapshotted onto the saved report (`reports.kitchen_tip_percentage`) so history stays accurate if a bar's percentage changes later; `reports.kitchen_tip_amount` is a generated column derived from it.

When editing, keep new state/derived-value patterns consistent with this style (plain `useState` + inline derivation) rather than introducing new abstractions — the app is intentionally small and flat.

## Auth

Two separate, deliberately different auth models:
- **Calculator**: a single shared password (`REACT_APP_SITE_PASSWORD`), checked client-side, unlock flag in `localStorage`. Not real security (the password is inlined in the shipped JS bundle) — it only exists to keep casual visitors from stumbling onto it. No per-person identity.
- **Admin** (`Admin.tsx`): real Supabase Auth via magic link (passwordless email). `public.users.auth_user_id` links a Supabase Auth account to a row in the app's own `users` table; access is authorized only if that row's `role` is `'admin'` or `'manager'`. Regular auto-created bartenders never get an `auth_user_id` and can't sign in anywhere.
- RLS policies (`supabase/policies.sql`) grant identical access `to anon, authenticated` — signing into the admin panel must not change what the calculator itself can see/do in that browser session, since both currently share the same wide-open, no-per-row-restriction trust model. Admin-only *write* policies (e.g. only admins can edit `kitchen_tip_percentage` or void a report) get added alongside each admin-panel feature as it's built, not preemptively.

## Mobile responsiveness

This app is used on phones behind a bar at close-out, and must always work well there, especially on iOS Safari. Any change touching layout or form controls must preserve this:

- Every `input`, `select`, and `textarea` (including ones with inline `style`, like the invisible date-input overlay) must have `font-size` >= 16px. Below that threshold, iOS Safari auto-zooms the whole page on focus and the user has to manually zoom back out on every tap — this is the most common way this app breaks on iOS, and it's easy to reintroduce by adding a new field with a smaller `rem` value to match surrounding text.
- Verify no horizontal overflow at narrow widths (375px and 390px are good baselines) after any layout change, including with realistic long content (long bar names, long staff names) — check `document.documentElement.scrollWidth` against `clientWidth`, since visual overflow can be easy to miss in a quick look.
- The `.grid` and `.results-grid` two-column layouts collapse to one column via `@media (max-width: 640px)`; keep new multi-column layouts consistent with that pattern rather than introducing fixed-width layouts that don't collapse.
