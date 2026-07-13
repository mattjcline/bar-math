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

The entire app is one file: `src/App.tsx`. There is no component tree, routing, or state management library — everything is local `useState` in the single `App` component. `src/index.tsx` only mounts `<App />` into `#root`.

Key structure within `App.tsx`:
- `STYLES` — a template-literal CSS string injected via a `<style>` tag at render time (no CSS modules, no styled-components, no external stylesheet). All visual design lives here, dark-themed, using CSS custom class names (`.card`, `.result-block`, `.till-badge`, etc.).
- Pure helper functions above the component: `customRound` (rounds up at `.9` instead of `.5`, used only for displayed bartender payouts), `fmt`/`fmtInt` (currency formatting), `getDefaultDate` (defaults the shift date to "today", but before 6am rolls back to the previous calendar day, since a bar's business day extends past midnight).
- Bartender rows are an array of `{ id, name, hours }` in state, mutated via `addBartender`/`removeBartender`/`updateBartender`; `id` is assigned from a module-level `nextId` counter (not reset on remount).
- All derived values (`totalTips`, `totalHours`, `hourlyRate`, `expectedTill`, `delta`, `hasTill`) are computed inline on every render from the raw string-valued inputs — no `useMemo`, no effects. Numeric inputs are stored as strings and parsed with `parseFloat(...) || 0` at use time.
- Till math: `expectedTill = cashSales + amBank`; `delta = till - expectedTill`. `amBank` defaults to `"400"`.

When editing, keep new state/derived-value patterns consistent with this style (plain `useState` + inline derivation) rather than introducing new abstractions — the app is intentionally small and flat.
