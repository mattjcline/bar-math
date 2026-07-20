# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bar Math is a single-page end-of-night calculator for bartenders/bar managers. Given credit card tips, cash tips, till counts, and staff hours, it computes total tips, hourly tip-out rate, till over/short delta, and per-bartender payouts. Bootstrapped with Create React App, deployed to GitHub Pages at `mattjcline.github.io/bar-math`.

## Commands

- `npm start` - run dev server at http://localhost:3000 (CRA hot reload)
- `npm test` - run tests via `react-scripts test` (Jest, interactive watch mode; pass `-- --watchAll=false` for a single non-watch run)
- `npm run build` - production build to `build/`
- `npm run deploy` - builds and publishes `build/` to GitHub Pages via `gh-pages`
- `npm run dev:signin -- you@example.com [port] [--no-open]` - mints a real admin-panel session via the Supabase admin API (using `SUPABASE_SERVICE_KEY`) and opens it, skipping the sign-in email entirely. Even with custom SMTP configured, use this for local admin-panel testing instead of repeatedly requesting real sign-in codes. Requires `npm start` already running. Local-only - lives in `scripts/`, outside `src/`, never bundled into the shipped app. When Claude is driving this for its own headless verification (e.g. via Playwright) rather than for the user to click into, pass `--no-open` - otherwise it pops a real browser window open on the user's machine via macOS `open`. Likewise, start `npm start` itself with `BROWSER=none npm start` for headless/agent-driven runs, since CRA auto-opens a tab by default.

There is no separate lint command; ESLint runs as part of `react-scripts start`/`build` via the `eslintConfig` (`react-app`, `react-app/jest`) in `package.json`.

### Dev vs. prod Supabase

There are two Supabase projects: prod (real bar data, what the deployed app at `mattjcline.github.io/bar-math` talks to) and a dev project seeded with the same schema but placeholder bars ("Bar One" through "Bar Four") and no real data. Which one gets used is entirely determined by which env file loads, via CRA's own env-file precedence - no code branches on an environment flag:

- `npm start` loads `.env.development.local` (gitignored, holds the dev project's URL/keys), which overrides the tracked `.env`'s prod values - so local dev always hits the dev project automatically.
- `npm run build` / `npm run deploy` don't load `.env.development.local` at all, so they fall through to the tracked `.env` (prod) - the deployed app always hits prod.
- `scripts/dev-signin.mjs` reads env files in the same precedence order CRA itself uses for `npm start` (`.env`, `.env.development`, `.env.local`, `.env.development.local`, later wins), so it always targets whatever `npm start` is currently pointed at.

This means local dev/testing (mine or Matt's) can't touch prod data even by accident, without needing to remember to switch anything. If the dev project's schema or policies ever need updating, re-run the relevant SQL from `src/schema.sql` / `supabase/policies.sql` there by hand too - it doesn't get the changes automatically.

## Architecture

Two entry points, chosen in `src/index.tsx` by a query-string check (`?admin`) - not the URL hash, since the Supabase client (`detectSessionInUrl`, on by default, unset in `src/supabase.ts`) reserves the hash fragment for auth session tokens and a hash-based router would collide with it:
- No `?admin` → `src/App.tsx`, the calculator. Everything is local `useState` in one component, no component tree or state management library.
- `?admin` present → `src/Admin.tsx`, the admin panel: an email-code sign-in + authorization check, then (once signed in as `admin`/`manager`) a tab bar switching between `src/Reports.tsx`, `src/BarSettings.tsx`, and `src/Staff.tsx`. See "Admin panel" below.

The calculator (`App.tsx`) is still one file with no routing/state-management library internally - the split above is only between "calculator" and "admin," not a general move to multi-page architecture within each.

Key structure within `App.tsx`:
- `src/App.css` - a plain external stylesheet (not CSS modules, not styled-components) imported by both `App.tsx` and `Admin.tsx`. All visual design lives here, dark-themed, using shared class names (`.card`, `.result-block`, `.till-badge`, `.field`, `.btn-save`, etc.) - new admin-panel components reuse these rather than inventing parallel styles. `.header` in particular is shared by both entry points, so layout changes scoped to only one of them (e.g. the admin header's signed-in strip) need their own additional class rather than changing `.header` itself.
- Pure helper functions above the component: `customRound` (rounds up at `.9` instead of `.5`, used only for displayed bartender payouts), `fmt`/`fmtInt` (currency formatting), `getDefaultDate` (defaults the shift date to "today", but before 6am rolls back to the previous calendar day, since a bar's business day extends past midnight).
- Bartender rows are an array of `{ id, name, hours }` in state, mutated via `addBartender`/`removeBartender`/`updateBartender`; `id` is assigned from a module-level `nextId` counter (not reset on remount).
- `resolveUser` (used for both the Closing name and every bartender name on save) matches against *all* fetched `users`, active or not - deliberately not just the active ones, or re-entering an exact name that was deactivated would silently create a duplicate `users` row instead of reusing the original (this was a real bug, fixed once the dev Supabase project existed to safely test it against). It does not reactivate a matched-but-inactive user - reusing their id for this shift's payout doesn't flip `is_active` back to true, that stays a deliberate Staff-tab action. The autocomplete suggestion list (`activeNames`) is filtered to active-only separately, so deactivated people still don't show up as suggestions even though they're still matchable by exact name.
- All derived values (`totalTips`, `totalHours`, `hourlyRate`, `expectedTill`, `delta`, `hasTill`) are computed inline on every render from the raw string-valued inputs - no `useMemo`, no effects. Numeric inputs are stored as strings and parsed with `parseFloat(...) || 0` at use time.
- Till math: `expectedTill = cashSales + amBank`; `delta = till - expectedTill`. `amBank` defaults to `"400"`.
- Kitchen tip-out comes off the top before bartenders are paid: each bar has a `kitchen_tip_percentage` and a `kitchen_tip_method` (Supabase `bars` table, editable per-bar in the admin panel's Bar Settings tab - not editable from this calculator). Method is `'percentage_of_tips'` (default; e.g. 12% at most bars) or `'percentage_of_gross_kitchen_sales'` (e.g. Tempest, 10%) - the percentage is always applied against whichever base the method selects; see `computeKitchenTipAmount` in `utils.ts` for the exact formula (`hourlyRate` is `tipPool / totalHours`, not `totalTips / totalHours`). "Gross Kitchen Sales" is a required input on the calculator for every bar regardless of method - not just gross-kitchen-sales bars, where it's actually load-bearing for the tip-out math. The kitchen manager wants it recorded for every shift for his own reporting; for `percentage_of_tips` bars it's collected but never used in the payout calculation. The field's hint text (`kitchenTipMechanismHint` in `utils.ts`) makes this explicit either way - "this is what your tip-out is based on" vs. "recorded for reporting only, your tip-out is actually based on tips." The method and percentage actually used are snapshotted onto the saved report (`reports.kitchen_tip_method`, `reports.kitchen_tip_percentage`, `reports.gross_kitchen_sales`) so history stays accurate if a bar's settings change later; `reports.kitchen_tip_amount` is a generated column derived from them. The Reports tab shows Gross Kitchen Sales as its own line for every bar, separate from the Kitchen Tip-Out line, since it's meaningful even when it didn't drive that shift's math.

When editing, keep new state/derived-value patterns consistent with this style (plain `useState` + inline derivation) rather than introducing new abstractions - the app is intentionally small and flat.

## Admin panel

Three tabs in `Admin.tsx` (`Reports.tsx`, `BarSettings.tsx`, `Staff.tsx`, plus nested `AdminUsers.tsx`), each a flat component with its own `useState` and its own data fetch on mount - no shared state between tabs. All three are read-heavy, low-traffic admin screens, so none paginate, cache, or debounce.

**Read `docs/admin-panel.md` before editing any of these files** - it documents several non-obvious invariants (report versioning/void handling, bar-deactivation edge cases, the invite/claim flow) that are easy to silently break.

## Auth

Two separate, deliberately different auth models: a shared site password for the calculator, real Supabase Auth (email-code OTP, not magic links) for the admin panel.

**Read `docs/auth.md` before touching sign-in, RLS policies, or the invite/claim flow** - the OTP-vs-magic-link choice and the RLS write-policy scoping (`create bartender` vs `invite admin or manager`) both encode fixes for real bugs, not arbitrary style.

## Mobile responsiveness

This app is used on phones behind a bar at close-out, and must always work well there, especially on iOS Safari. Any change touching layout or form controls must preserve this:

- Every `input`, `select`, and `textarea` (including ones with inline `style`, like the invisible date-input overlay) must have `font-size` >= 16px. Below that threshold, iOS Safari auto-zooms the whole page on focus and the user has to manually zoom back out on every tap - this is the most common way this app breaks on iOS, and it's easy to reintroduce by adding a new field with a smaller `rem` value to match surrounding text.
- Verify no horizontal overflow at narrow widths (375px and 390px are good baselines) after any layout change, including with realistic long content (long bar names, long staff names) - check `document.documentElement.scrollWidth` against `clientWidth`, since visual overflow can be easy to miss in a quick look.
- The `.grid` and `.results-grid` two-column layouts collapse to one column via `@media (max-width: 640px)`; keep new multi-column layouts consistent with that pattern rather than introducing fixed-width layouts that don't collapse.

## Writing conventions

- Never use the em dash (—); use a regular hyphen/dash instead.
- Never auto-add an agent name (e.g. "Co-Authored-By: Claude") to commit messages.

## Known gaps / not yet built

Tracked as GitHub issues on this repo (`gh issue list --repo mattjcline/bar-math`), not here, so this list doesn't go stale. Notable ones as of this writing:

- [#1 - Wire up webhook alerting for till over/short](https://github.com/mattjcline/bar-math/issues/1)
