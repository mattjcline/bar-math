# Tempest Kitchen Tip-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a bar's kitchen tip-out be calculated as a percentage of Gross Kitchen Sales instead of a percentage of total tips, so Tempest (10% of Gross Kitchen Sales) can be onboarded correctly alongside the existing percentage-of-tips bars.

**Architecture:** A new `kitchen_tip_method` column on `bars` (and, snapshotted, on `reports`) selects which base the existing `kitchen_tip_percentage` is applied against. A new pure-function layer in `src/utils.ts` centralizes the calculation and all display formatting for both methods, consumed by the calculator, Bar Settings, and Reports.

**Tech Stack:** React 19 + TypeScript (Create React App), Supabase (Postgres + supabase-js), Jest via `react-scripts test`.

Spec: `docs/superpowers/specs/2026-07-14-tempest-kitchen-tip-out-design.md`

## Global Constraints

- Every new/changed `input`/`select` must render at `font-size >= 16px` (iOS Safari auto-zoom rule). The project's existing pattern for this is `font-size: 1rem` on `.field input` in `src/App.css` — this plan extends that same rule to cover `.field select` too, since this feature introduces the app's first `<select>` inside a `.field`.
- No horizontal overflow at 375px/390px viewport widths after any layout change.
- `src/schema.sql` is edited to the desired end-state (its usual role as the from-scratch schema reference); the live Supabase project is migrated separately by hand-running the equivalent SQL in the Supabase SQL editor — this is the existing project convention (see `supabase/policies.sql` and the commit history of `src/schema.sql`), not something this plan can automate.
- Keep the existing `useState` + inline-derivation style. No `useMemo`, no effects, no new state-management abstractions.
- This codebase has no component-level test harness today (no React Testing Library usage anywhere, despite the dependency being installed) and none is being introduced by this plan — that would be a disproportionate new pattern for a small, flat, Supabase-coupled app. TDD applies to the new pure functions in `src/utils.ts` (this project's existing home for testable logic, e.g. `customRound`, `fmt`), which is where this feature's real logic lives. UI wiring tasks are verified by `tsc --noEmit` plus a final end-to-end manual pass driving the real app (Task 7), matching how this app's other recent UI changes were verified.
- No new RLS policies are needed: `bars` and `reports` already have admin/manager-gated update and public-insert policies respectively that cover whatever columns exist on those tables — adding columns doesn't require new policies.

---

### Task 1: Kitchen tip-out pure functions in `utils.ts`

**Files:**
- Modify: `src/utils.ts`
- Create: `src/utils.test.ts`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces (used by Tasks 3, 4, 5):
  - `export type KitchenTipMethod = "percentage_of_tips" | "percentage_of_gross_kitchen_sales"`
  - `export type Bar = { id: string; name: string; kitchen_tip_percentage: number | null; kitchen_tip_method: KitchenTipMethod }` (existing type, gains one field)
  - `export function computeKitchenTipAmount(method: KitchenTipMethod, percentage: number, totalTips: number, grossKitchenSales: number): number`
  - `export function kitchenTipShortCaption(method: KitchenTipMethod, percentage: number): string`
  - `export function kitchenTipPoolCaption(method: KitchenTipMethod, percentage: number): string`
  - `export function kitchenTipReportLabel(method: KitchenTipMethod, percentage: number, amount: number, grossKitchenSales: number | null): string`

- [ ] **Step 1: Write the failing tests**

Create `src/utils.test.ts`:

```ts
import {
  computeKitchenTipAmount,
  kitchenTipPoolCaption,
  kitchenTipReportLabel,
  kitchenTipShortCaption,
} from "./utils";

describe("computeKitchenTipAmount", () => {
  it("computes off total tips for percentage_of_tips", () => {
    expect(computeKitchenTipAmount("percentage_of_tips", 12, 500, 999)).toBeCloseTo(60);
  });

  it("computes off gross kitchen sales for percentage_of_gross_kitchen_sales", () => {
    expect(computeKitchenTipAmount("percentage_of_gross_kitchen_sales", 10, 500, 1200)).toBeCloseTo(120);
  });

  it("returns 0 when the relevant base is 0", () => {
    expect(computeKitchenTipAmount("percentage_of_tips", 12, 0, 500)).toBe(0);
    expect(computeKitchenTipAmount("percentage_of_gross_kitchen_sales", 10, 500, 0)).toBe(0);
  });
});

describe("kitchenTipShortCaption", () => {
  it("says 'off the top' for percentage_of_tips", () => {
    expect(kitchenTipShortCaption("percentage_of_tips", 12)).toBe("12% off the top");
  });

  it("says 'of gross kitchen sales' for percentage_of_gross_kitchen_sales", () => {
    expect(kitchenTipShortCaption("percentage_of_gross_kitchen_sales", 10)).toBe("10% of gross kitchen sales");
  });
});

describe("kitchenTipPoolCaption", () => {
  it("matches the pre-existing wording for percentage_of_tips", () => {
    expect(kitchenTipPoolCaption("percentage_of_tips", 12)).toBe("12% kitchen tip-out");
  });

  it("calls out the gross-kitchen-sales basis", () => {
    expect(kitchenTipPoolCaption("percentage_of_gross_kitchen_sales", 10)).toBe(
      "10% gross-kitchen-sales kitchen tip-out"
    );
  });
});

describe("kitchenTipReportLabel", () => {
  it("matches the pre-existing report format for percentage_of_tips", () => {
    expect(kitchenTipReportLabel("percentage_of_tips", 12, 84, null)).toBe("12% ($84.00)");
  });

  it("shows the gross kitchen sales base and the resulting amount", () => {
    expect(kitchenTipReportLabel("percentage_of_gross_kitchen_sales", 10, 120, 1200)).toBe(
      "10% of Gross Kitchen Sales ($1,200.00) = $120.00"
    );
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `CI=true npx react-scripts test src/utils.test.ts --watchAll=false`
Expected: FAIL — `TypeError: (0 , _utils.computeKitchenTipAmount) is not a function` (CRA's Jest uses Babel to strip types without type-checking, so the failure is a runtime "not a function" error, not a TS error).

- [ ] **Step 3: Implement the functions**

In `src/utils.ts`, change the existing `Bar` type (line 1):

```ts
export type Bar = { id: string; name: string; kitchen_tip_percentage: number | null; kitchen_tip_method: KitchenTipMethod };
```

Add the new type and four functions (anywhere after the `fmt` function, since `kitchenTipReportLabel` calls `fmt`):

```ts
export type KitchenTipMethod = "percentage_of_tips" | "percentage_of_gross_kitchen_sales";

export function computeKitchenTipAmount(
  method: KitchenTipMethod,
  percentage: number,
  totalTips: number,
  grossKitchenSales: number,
): number {
  const base = method === "percentage_of_gross_kitchen_sales" ? grossKitchenSales : totalTips;
  return (base * percentage) / 100;
}

export function kitchenTipShortCaption(method: KitchenTipMethod, percentage: number): string {
  return method === "percentage_of_gross_kitchen_sales"
    ? `${percentage}% of gross kitchen sales`
    : `${percentage}% off the top`;
}

export function kitchenTipPoolCaption(method: KitchenTipMethod, percentage: number): string {
  return method === "percentage_of_gross_kitchen_sales"
    ? `${percentage}% gross-kitchen-sales kitchen tip-out`
    : `${percentage}% kitchen tip-out`;
}

export function kitchenTipReportLabel(
  method: KitchenTipMethod,
  percentage: number,
  amount: number,
  grossKitchenSales: number | null,
): string {
  if (method === "percentage_of_gross_kitchen_sales") {
    return `${percentage}% of Gross Kitchen Sales (${fmt(grossKitchenSales ?? 0)}) = ${fmt(amount)}`;
  }
  return `${percentage}% (${fmt(amount)})`;
}
```

Note: `KitchenTipMethod` must be declared (or moved) before its use in the `Bar` type — put the `export type KitchenTipMethod = ...` line above `export type Bar = ...` at the top of the file rather than after `fmt`, then put the four functions after `fmt`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `CI=true npx react-scripts test src/utils.test.ts --watchAll=false`
Expected: PASS — `Tests: 9 passed, 9 total`

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output (no errors)

- [ ] **Step 6: Commit**

```bash
git add src/utils.ts src/utils.test.ts
git commit -m "$(cat <<'EOF'
Add pure functions for the two kitchen tip-out calculation methods

computeKitchenTipAmount, kitchenTipShortCaption, kitchenTipPoolCaption,
and kitchenTipReportLabel centralize the math and display formatting
needed to support both percentage-of-tips and
percentage-of-gross-kitchen-sales bars, consumed by the calculator,
Bar Settings, and Reports in later commits. First test file in the
project — these are the first pure, easily-unit-testable functions
this feature adds.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Schema changes

**Files:**
- Modify: `src/schema.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: the `bars.kitchen_tip_method`, `reports.kitchen_tip_method`, and `reports.gross_kitchen_sales` columns that Tasks 3–5 read/write, and the new `kitchen_tip_amount` generated-column formula.

- [ ] **Step 1: Update the `bars` table**

In `src/schema.sql`, change:

```sql
create table bars (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  webhook_url              text,
  webhook_delta_threshold  numeric default 20,
  kitchen_tip_percentage   numeric default 12
);

alter table bars add constraint kitchen_tip_percentage_range
  check (kitchen_tip_percentage between 0 and 100);
```

to:

```sql
create table bars (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  webhook_url              text,
  webhook_delta_threshold  numeric default 20,
  kitchen_tip_percentage   numeric default 12,
  kitchen_tip_method       text not null default 'percentage_of_tips'
);

alter table bars add constraint kitchen_tip_percentage_range
  check (kitchen_tip_percentage between 0 and 100);

alter table bars add constraint kitchen_tip_method_values
  check (kitchen_tip_method in ('percentage_of_tips', 'percentage_of_gross_kitchen_sales'));
```

- [ ] **Step 2: Update the `reports` table**

Change:

```sql
  webhook_sent boolean default false,
  kitchen_tip_percentage numeric,
  total_sales  numeric generated always as (
    coalesce(cash_sales, 0) + coalesce(credit_sales, 0)
  ) stored,
  tip_percentage numeric generated always as (
    case when (coalesce(cash_sales, 0) + coalesce(credit_sales, 0)) > 0
    then (coalesce(cc_tips, 0) + coalesce(cash_tips, 0)) /
         (coalesce(cash_sales, 0) + coalesce(credit_sales, 0)) * 100
    else null end
  ) stored,
  kitchen_tip_amount numeric generated always as (
    coalesce(total_tips, 0) * coalesce(kitchen_tip_percentage, 0) / 100
  ) stored
);
```

to:

```sql
  webhook_sent boolean default false,
  kitchen_tip_percentage numeric,
  kitchen_tip_method text not null default 'percentage_of_tips',
  gross_kitchen_sales numeric,
  total_sales  numeric generated always as (
    coalesce(cash_sales, 0) + coalesce(credit_sales, 0)
  ) stored,
  tip_percentage numeric generated always as (
    case when (coalesce(cash_sales, 0) + coalesce(credit_sales, 0)) > 0
    then (coalesce(cc_tips, 0) + coalesce(cash_tips, 0)) /
         (coalesce(cash_sales, 0) + coalesce(credit_sales, 0)) * 100
    else null end
  ) stored,
  kitchen_tip_amount numeric generated always as (
    case
      when kitchen_tip_method = 'percentage_of_gross_kitchen_sales'
        then coalesce(gross_kitchen_sales, 0) * coalesce(kitchen_tip_percentage, 0) / 100
      else coalesce(total_tips, 0) * coalesce(kitchen_tip_percentage, 0) / 100
    end
  ) stored
);

alter table reports add constraint kitchen_tip_method_values
  check (kitchen_tip_method in ('percentage_of_tips', 'percentage_of_gross_kitchen_sales'));
```

- [ ] **Step 3: Review the diff**

Run: `git diff src/schema.sql`
Expected: only the additions above — table structure otherwise unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/schema.sql
git commit -m "$(cat <<'EOF'
Add kitchen_tip_method to schema.sql for both bars and reports

Reflects the desired end-state schema; the live Supabase project is
migrated separately by hand via the SQL editor, same as prior schema
changes (see 883837d).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Note for whoever runs this plan:** after this task, the following SQL must be run by hand in the Supabase SQL editor against the live project (it is not applied automatically — same convention as `supabase/policies.sql`):

```sql
alter table bars add column kitchen_tip_method text not null default 'percentage_of_tips';
alter table bars add constraint kitchen_tip_method_values
  check (kitchen_tip_method in ('percentage_of_tips', 'percentage_of_gross_kitchen_sales'));

alter table reports add column kitchen_tip_method text not null default 'percentage_of_tips';
alter table reports add constraint kitchen_tip_method_values
  check (kitchen_tip_method in ('percentage_of_tips', 'percentage_of_gross_kitchen_sales'));
alter table reports add column gross_kitchen_sales numeric;

alter table reports drop column kitchen_tip_amount;
alter table reports add column kitchen_tip_amount numeric generated always as (
  case
    when kitchen_tip_method = 'percentage_of_gross_kitchen_sales'
      then coalesce(gross_kitchen_sales, 0) * coalesce(kitchen_tip_percentage, 0) / 100
    else coalesce(total_tips, 0) * coalesce(kitchen_tip_percentage, 0) / 100
  end
) stored;
```

Task 7 (end-to-end verification) cannot pass until this has been run.

---

### Task 3: Calculator (`App.tsx`)

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes (from Task 1): `KitchenTipMethod`, `Bar` (now includes `kitchen_tip_method`), `computeKitchenTipAmount`, `kitchenTipShortCaption`, `kitchenTipPoolCaption`.
- Produces: no new exports (leaf consumer).

- [ ] **Step 1: Import the new utils exports**

Change:

```ts
import { customRound, fmt, fmtInt, getDefaultDate, nameKey, type Bar, type StaffUser } from "./utils";
```

to:

```ts
import {
  computeKitchenTipAmount,
  customRound,
  fmt,
  fmtInt,
  getDefaultDate,
  kitchenTipPoolCaption,
  kitchenTipShortCaption,
  nameKey,
  type Bar,
  type KitchenTipMethod,
  type StaffUser,
} from "./utils";
```

- [ ] **Step 2: Select `kitchen_tip_method` in the bars fetch**

Change:

```ts
        supabase.from("bars").select("id, name, kitchen_tip_percentage").order("name"),
```

to:

```ts
        supabase.from("bars").select("id, name, kitchen_tip_percentage, kitchen_tip_method").order("name"),
```

- [ ] **Step 3: Add `grossKitchenSales` state**

Change:

```ts
  const [amBank, setAmBank] = useState("400");
```

to:

```ts
  const [amBank, setAmBank] = useState("400");
  const [grossKitchenSales, setGrossKitchenSales] = useState("");
```

- [ ] **Step 4: Parse it alongside the other numeric fields**

Change:

```ts
  const ccVal = parseFloat(ccTips) || 0;
  const cashTipsVal = parseFloat(cashTips) || 0;
  const tillVal = parseFloat(till) || 0;
  const cashSalesVal = parseFloat(cashSales) || 0;
  const creditSalesVal = parseFloat(creditSales) || 0;
  const amBankVal = parseFloat(amBank) || 0;
```

to:

```ts
  const ccVal = parseFloat(ccTips) || 0;
  const cashTipsVal = parseFloat(cashTips) || 0;
  const tillVal = parseFloat(till) || 0;
  const cashSalesVal = parseFloat(cashSales) || 0;
  const creditSalesVal = parseFloat(creditSales) || 0;
  const amBankVal = parseFloat(amBank) || 0;
  const grossKitchenSalesVal = parseFloat(grossKitchenSales) || 0;
```

- [ ] **Step 5: Use the method and the new function for `kitchenTipAmount`**

Change:

```ts
  const selectedBar = bars.find((b) => b.id === selectedBarId);
  const kitchenTipPct = selectedBar?.kitchen_tip_percentage ?? 0;
  const kitchenTipAmount = totalTips * kitchenTipPct / 100;
  const tipPool = totalTips - kitchenTipAmount;
```

to:

```ts
  const selectedBar = bars.find((b) => b.id === selectedBarId);
  const kitchenTipPct = selectedBar?.kitchen_tip_percentage ?? 0;
  const kitchenTipMethod: KitchenTipMethod = selectedBar?.kitchen_tip_method ?? "percentage_of_tips";
  const usesGrossKitchenSales = kitchenTipMethod === "percentage_of_gross_kitchen_sales";
  const kitchenTipAmount = computeKitchenTipAmount(kitchenTipMethod, kitchenTipPct, totalTips, grossKitchenSalesVal);
  const tipPool = totalTips - kitchenTipAmount;
```

- [ ] **Step 6: Require the field when it's shown**

Change:

```ts
  const canSave =
    !saving &&
    selectedBarId !== "" &&
    closingName.trim() !== "" &&
    deltaSeverity !== "blocked" &&
    !hasDuplicateNames;
```

to:

```ts
  const canSave =
    !saving &&
    selectedBarId !== "" &&
    closingName.trim() !== "" &&
    deltaSeverity !== "blocked" &&
    !hasDuplicateNames &&
    (!usesGrossKitchenSales || grossKitchenSales.trim() !== "");
```

- [ ] **Step 7: Save the method and the gross kitchen sales figure**

Change:

```ts
          total_tips: totalTips,
          hourly_rate: hourlyRate,
          kitchen_tip_percentage: kitchenTipPct,
```

to:

```ts
          total_tips: totalTips,
          hourly_rate: hourlyRate,
          kitchen_tip_percentage: kitchenTipPct,
          kitchen_tip_method: kitchenTipMethod,
          gross_kitchen_sales: usesGrossKitchenSales ? grossKitchenSalesVal : null,
```

- [ ] **Step 8: Add the conditional input field**

In the Tips card, change:

```tsx
            <div className="field">
              <label>Cash Tips</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cashTips}
                onChange={(e) => setCashTips(e.target.value)}
              />
            </div>
          </div>
```

to:

```tsx
            <div className="field">
              <label>Cash Tips</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cashTips}
                onChange={(e) => setCashTips(e.target.value)}
              />
            </div>
            {usesGrossKitchenSales && (
              <div className="field">
                <label>Gross Kitchen Sales</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={grossKitchenSales}
                  onChange={(e) => setGrossKitchenSales(e.target.value)}
                />
                <div className="field-hint">
                  {selectedBar?.name}'s kitchen tip-out is {kitchenTipPct}% of this.
                </div>
              </div>
            )}
          </div>
```

- [ ] **Step 9: Add the validation hint**

Change:

```tsx
          {!canSave && !saving && (
            <div className="validation-list">
              {selectedBarId === "" && <div>• Select a bar</div>}
              {closingName.trim() === "" && <div>• Enter who's closing</div>}
              {hasDuplicateNames && <div>• Fix duplicate bartender names</div>}
              {deltaSeverity === "blocked" && <div>• Till delta exceeds ±$400</div>}
            </div>
          )}
```

to:

```tsx
          {!canSave && !saving && (
            <div className="validation-list">
              {selectedBarId === "" && <div>• Select a bar</div>}
              {closingName.trim() === "" && <div>• Enter who's closing</div>}
              {hasDuplicateNames && <div>• Fix duplicate bartender names</div>}
              {deltaSeverity === "blocked" && <div>• Till delta exceeds ±$400</div>}
              {usesGrossKitchenSales && grossKitchenSales.trim() === "" && (
                <div>• Enter gross kitchen sales</div>
              )}
            </div>
          )}
```

- [ ] **Step 10: Make the two captions base-aware**

Change:

```tsx
                {kitchenTipPct}% off the top
```

to:

```tsx
                {kitchenTipShortCaption(kitchenTipMethod, kitchenTipPct)}
```

Change:

```tsx
                Pool: {fmt(tipPool)} after {kitchenTipPct}% kitchen tip-out
```

to:

```tsx
                Pool: {fmt(tipPool)} after {kitchenTipPoolCaption(kitchenTipMethod, kitchenTipPct)}
```

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output (no errors)

- [ ] **Step 12: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
Support gross-kitchen-sales-based kitchen tip-out on the calculator

Bars using the percentage_of_gross_kitchen_sales method (e.g. Tempest)
get an extra required "Gross Kitchen Sales" input, and the Kitchen
Tip-Out math and captions switch basis accordingly. Behavior and
copy for percentage_of_tips bars is unchanged (covered by
kitchenTipShortCaption/kitchenTipPoolCaption's existing tests).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Bar Settings (`BarSettings.tsx`) + shared select styling

**Files:**
- Modify: `src/BarSettings.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes (from Task 1): `KitchenTipMethod`.
- Produces: no new exports (leaf consumer).

- [ ] **Step 1: Style `<select>` inside `.field` like `.field input`**

In `src/App.css`, change:

```css
.field input {
  width: 100%;
  background: #0d0d0f;
  border: 1px solid #2a2a36;
  border-radius: 5px;
  color: #e0e0ec;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1rem;
  padding: 0.5rem 0.7rem;
  outline: none;
  transition: border-color 0.15s;
}

.field input:focus {
  border-color: #5050a0;
}
```

to:

```css
.field input,
.field select {
  width: 100%;
  background: #0d0d0f;
  border: 1px solid #2a2a36;
  border-radius: 5px;
  color: #e0e0ec;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 1rem;
  padding: 0.5rem 0.7rem;
  outline: none;
  transition: border-color 0.15s;
}

.field input:focus,
.field select:focus {
  border-color: #5050a0;
}
```

(This is the app's first `<select>` inside a `.field` div — without this change it would fall back to the browser default font-size, under the 16px iOS Safari auto-zoom threshold.)

- [ ] **Step 2: Import `KitchenTipMethod`**

Change:

```ts
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
```

to:

```ts
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { KitchenTipMethod } from "./utils";
```

- [ ] **Step 3: Extend the `Bar` and `Draft` types**

Change:

```ts
type Bar = {
  id: string;
  name: string;
  kitchen_tip_percentage: number | null;
  webhook_url: string | null;
  webhook_delta_threshold: number | null;
};
```

to:

```ts
type Bar = {
  id: string;
  name: string;
  kitchen_tip_percentage: number | null;
  kitchen_tip_method: KitchenTipMethod;
  webhook_url: string | null;
  webhook_delta_threshold: number | null;
};
```

Change:

```ts
type Draft = {
  kitchenTipPct: string;
  webhookUrl: string;
  webhookThreshold: string;
};
```

to:

```ts
type Draft = {
  kitchenTipPct: string;
  kitchenTipMethod: KitchenTipMethod;
  webhookUrl: string;
  webhookThreshold: string;
};
```

- [ ] **Step 4: Carry the method through `toDraft`**

Change:

```ts
const toDraft = (bar: Bar): Draft => ({
  kitchenTipPct: bar.kitchen_tip_percentage != null ? String(bar.kitchen_tip_percentage) : "",
  webhookUrl: bar.webhook_url ?? "",
  webhookThreshold: bar.webhook_delta_threshold != null ? String(bar.webhook_delta_threshold) : "",
});
```

to:

```ts
const toDraft = (bar: Bar): Draft => ({
  kitchenTipPct: bar.kitchen_tip_percentage != null ? String(bar.kitchen_tip_percentage) : "",
  kitchenTipMethod: bar.kitchen_tip_method,
  webhookUrl: bar.webhook_url ?? "",
  webhookThreshold: bar.webhook_delta_threshold != null ? String(bar.webhook_delta_threshold) : "",
});
```

- [ ] **Step 5: Select and save the new column**

Change (this exact string appears twice — the initial fetch and the post-update `.select()` — replace both):

```ts
      .select("id, name, kitchen_tip_percentage, webhook_url, webhook_delta_threshold")
```

to:

```ts
      .select("id, name, kitchen_tip_percentage, kitchen_tip_method, webhook_url, webhook_delta_threshold")
```

Change:

```ts
      .update({
        kitchen_tip_percentage: pct,
        webhook_url: draft.webhookUrl.trim() === "" ? null : draft.webhookUrl.trim(),
        webhook_delta_threshold: threshold,
      })
```

to:

```ts
      .update({
        kitchen_tip_percentage: pct,
        kitchen_tip_method: draft.kitchenTipMethod,
        webhook_url: draft.webhookUrl.trim() === "" ? null : draft.webhookUrl.trim(),
        webhook_delta_threshold: threshold,
      })
```

- [ ] **Step 6: Add the method dropdown**

Change:

```tsx
              <div className="field" style={{ maxWidth: "180px" }}>
                <label>Kitchen Tip-Out %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={draft.kitchenTipPct}
                  onChange={(e) => updateDraft(bar.id, { kitchenTipPct: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Webhook URL</label>
```

to:

```tsx
              <div className="field" style={{ maxWidth: "180px" }}>
                <label>Kitchen Tip-Out %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={draft.kitchenTipPct}
                  onChange={(e) => updateDraft(bar.id, { kitchenTipPct: e.target.value })}
                />
              </div>

              <div className="field" style={{ maxWidth: "260px" }}>
                <label>Kitchen Tip-Out Calculation</label>
                <select
                  value={draft.kitchenTipMethod}
                  onChange={(e) =>
                    updateDraft(bar.id, { kitchenTipMethod: e.target.value as KitchenTipMethod })
                  }
                >
                  <option value="percentage_of_tips">% of Tips</option>
                  <option value="percentage_of_gross_kitchen_sales">% of Gross Kitchen Sales</option>
                </select>
              </div>

              <div className="field">
                <label>Webhook URL</label>
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output (no errors)

- [ ] **Step 8: Commit**

```bash
git add src/BarSettings.tsx src/App.css
git commit -m "$(cat <<'EOF'
Add a kitchen tip-out calculation method dropdown to Bar Settings

Lets an admin switch a bar between % of Tips and % of Gross Kitchen
Sales. Also extends the .field input styling rule to cover .field
select, since this is the first <select> used inside a .field.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Reports (`Reports.tsx`)

**Files:**
- Modify: `src/Reports.tsx`

**Interfaces:**
- Consumes (from Task 1): `KitchenTipMethod`, `kitchenTipReportLabel`.
- Produces: no new exports (leaf consumer).

- [ ] **Step 1: Import the new utils exports**

Change:

```ts
import { fmt, fmtInt } from "./utils";
```

to:

```ts
import { fmt, fmtInt, kitchenTipReportLabel, type KitchenTipMethod } from "./utils";
```

- [ ] **Step 2: Extend `ReportRow`**

Change:

```ts
  kitchen_tip_percentage: number | null;
  kitchen_tip_amount: number | null;
```

to:

```ts
  kitchen_tip_percentage: number | null;
  kitchen_tip_amount: number | null;
  kitchen_tip_method: KitchenTipMethod;
  gross_kitchen_sales: number | null;
```

- [ ] **Step 3: Select the new columns**

Change:

```ts
        "id, shift_date, version, is_void, bar_id, till, am_bank, staff, total_tips, hourly_rate, till_delta, kitchen_tip_percentage, kitchen_tip_amount, notes, created_at, bars(name), users(name)"
```

to:

```ts
        "id, shift_date, version, is_void, bar_id, till, am_bank, staff, total_tips, hourly_rate, till_delta, kitchen_tip_percentage, kitchen_tip_amount, kitchen_tip_method, gross_kitchen_sales, notes, created_at, bars(name), users(name)"
```

- [ ] **Step 4: Use `kitchenTipReportLabel` in the detail view**

Change:

```tsx
        <div>
          <div className="result-label">Kitchen Tip-Out</div>
          <div>
            {viewed.kitchen_tip_percentage != null
              ? `${viewed.kitchen_tip_percentage}% (${fmt(viewed.kitchen_tip_amount ?? 0)})`
              : "—"}
          </div>
        </div>
```

to:

```tsx
        <div>
          <div className="result-label">Kitchen Tip-Out</div>
          <div>
            {viewed.kitchen_tip_percentage != null
              ? kitchenTipReportLabel(
                  viewed.kitchen_tip_method,
                  viewed.kitchen_tip_percentage,
                  viewed.kitchen_tip_amount ?? 0,
                  viewed.gross_kitchen_sales,
                )
              : "—"}
          </div>
        </div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no output (no errors)

- [ ] **Step 6: Commit**

```bash
git add src/Reports.tsx
git commit -m "$(cat <<'EOF'
Show the kitchen tip-out basis in the report detail view

percentage_of_tips reports keep their existing "12% ($84.00)" format;
percentage_of_gross_kitchen_sales reports now show the base amount
too, e.g. "10% of Gross Kitchen Sales ($1,200.00) = $120.00".

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the kitchen tip-out paragraph in Architecture**

Change:

```markdown
- Kitchen tip-out comes off the top before bartenders are paid: each bar has a `kitchen_tip_percentage` (Supabase `bars` table, default 12%, editable per-bar in the admin panel's Bar Settings tab — not editable from this calculator). `kitchenTipAmount = totalTips * kitchenTipPct / 100`; `tipPool = totalTips - kitchenTipAmount`; `hourlyRate = tipPool / totalHours` (not `totalTips / totalHours`). The percentage actually used is snapshotted onto the saved report (`reports.kitchen_tip_percentage`) so history stays accurate if a bar's percentage changes later; `reports.kitchen_tip_amount` is a generated column derived from it.
```

to:

```markdown
- Kitchen tip-out comes off the top before bartenders are paid: each bar has a `kitchen_tip_percentage` and a `kitchen_tip_method` (Supabase `bars` table, editable per-bar in the admin panel's Bar Settings tab — not editable from this calculator). Method is `'percentage_of_tips'` (default; e.g. 12% at most bars) or `'percentage_of_gross_kitchen_sales'` (e.g. Tempest, 10%) — the percentage is always applied against whichever base the method selects, via `computeKitchenTipAmount` in `utils.ts`: `kitchenTipAmount = (method === "percentage_of_gross_kitchen_sales" ? grossKitchenSales : totalTips) * kitchenTipPct / 100`; `tipPool = totalTips - kitchenTipAmount`; `hourlyRate = tipPool / totalHours` (not `totalTips / totalHours`). Gross-kitchen-sales bars get an extra required "Gross Kitchen Sales" input on the calculator, since nothing else the calculator collects gives that number. The method and percentage actually used are snapshotted onto the saved report (`reports.kitchen_tip_method`, `reports.kitchen_tip_percentage`) so history stays accurate if a bar's settings change later; `reports.kitchen_tip_amount` is a generated column derived from them (and from `reports.gross_kitchen_sales` when applicable).
```

- [ ] **Step 2: Remove the now-resolved "Known gaps" entry**

Delete this line from the "Known gaps / not yet built" section:

```markdown
- **Tempest's kitchen tip-out doesn't fit the current model.** Every bar's `kitchen_tip_percentage` is applied as a percentage of *total tips* (see the kitchen tip-out math in "Architecture" above), but Tempest actually calculates it as 10% of Gross Kitchen Sales — a different input entirely that the calculator doesn't currently collect. Needs a per-bar calculation-method field (percentage-of-tips vs. percentage-of-gross-kitchen-sales) plus a gross kitchen sales input on the calculator for bars using the latter, before Tempest can be onboarded correctly.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
Document the two kitchen tip-out calculation methods in CLAUDE.md

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: End-to-end verification

**Files:** none (verification only)

**Pre-requisite:** the migration SQL block at the end of Task 2 must have been run against the live Supabase project by hand. Without it, the calculator's bars fetch and Bar Settings' update will fail against the live DB even though the code type-checks.

- [ ] **Step 1: Full type-check and test suite**

Run: `npx tsc --noEmit -p .`
Expected: no output

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: all tests pass (the `src/utils.test.ts` suite from Task 1; no other test files exist in this project)

- [ ] **Step 2: Regression check — an existing percentage-of-tips bar is unaffected**

Start the dev server if not already running (`npm start`), unlock the calculator, select a bar that still uses `percentage_of_tips` (e.g. Louie's). Confirm:
- No "Gross Kitchen Sales" field appears in the Tips card.
- The Kitchen Tip-Out result block still reads `N% off the top`.
- The Hourly Rate pool caption still reads `Pool: $X after N% kitchen tip-out`.

- [ ] **Step 3: Set a bar to the gross-kitchen-sales method**

Sign into the admin panel (`npm run dev:signin -- you@example.com`), go to Bar Settings, pick a bar (Tempest if it already exists as a row in `bars`; otherwise any existing bar as a stand-in, since bar creation is a separate known gap), set "Kitchen Tip-Out Calculation" to "% of Gross Kitchen Sales" and the percentage to 10, and save.

- [ ] **Step 4: Verify the new field and math on the calculator**

Back on the calculator, select that bar. Confirm:
- A "Gross Kitchen Sales" field appears in the Tips card, with a hint naming the bar and percentage.
- Clicking Save Report with it blank shows "• Enter gross kitchen sales" in the validation list and the button stays disabled.
- Entering `1200` makes the Kitchen Tip-Out result block show `$120.00` and its caption read `10% of gross kitchen sales`.
- The Hourly Rate pool caption reads `Pool: $X after 10% gross-kitchen-sales kitchen tip-out`.

- [ ] **Step 5: Verify the saved report and its Reports-tab display**

Fill in the rest of the required fields (bar already selected, enter a closing name) and save. In the admin panel's Reports tab, open that report and confirm the Kitchen Tip-Out line reads `10% of Gross Kitchen Sales ($1,200.00) = $120.00`.

- [ ] **Step 6: Mobile overflow check**

At 375px and 390px viewport widths, with the Gross Kitchen Sales field visible, confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth` (no horizontal overflow).

- [ ] **Step 7: Report results**

Summarize pass/fail for each check above. Any failures found here should be fixed with a small follow-up commit before considering the feature done — this task has no commit of its own since it changes no files when everything passes.
