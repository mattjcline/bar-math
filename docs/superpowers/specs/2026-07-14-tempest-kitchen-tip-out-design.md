# Tempest kitchen tip-out calculation

## Problem

Every bar's `kitchen_tip_percentage` is currently applied as a percentage of
*total tips* (`kitchenTipAmount = totalTips * kitchenTipPct / 100`). Tempest
calculates its kitchen tip-out differently: 10% of Gross Kitchen Sales, a
number the calculator doesn't currently collect. Tempest can't be onboarded
correctly until the app supports both calculation methods on a per-bar basis.

## Data model

`bars` gains a calculation-method field:

```sql
alter table bars add column kitchen_tip_method text not null
  default 'percentage_of_tips'
  check (kitchen_tip_method in ('percentage_of_tips', 'percentage_of_gross_kitchen_sales'));
```

The existing `kitchen_tip_percentage` column is reused for both methods — it's
still "N%", just applied to a different base depending on `kitchen_tip_method`.

`reports` gains the same method as a snapshot column (mirroring how
`kitchen_tip_percentage` is already snapshotted per-report so history stays
accurate if a bar's settings change later), plus the gross kitchen sales
figure for reports that use it:

```sql
alter table reports add column kitchen_tip_method text not null
  default 'percentage_of_tips'
  check (kitchen_tip_method in ('percentage_of_tips', 'percentage_of_gross_kitchen_sales'));
alter table reports add column gross_kitchen_sales numeric;
```

`reports.kitchen_tip_amount` is a generated column; its expression changes
from a flat formula to a `CASE` on the method:

```sql
alter table reports drop column kitchen_tip_amount;
alter table reports add column kitchen_tip_amount numeric generated always as (
  case
    when kitchen_tip_method = 'percentage_of_gross_kitchen_sales'
      then coalesce(gross_kitchen_sales, 0) * coalesce(kitchen_tip_percentage, 0) / 100
    else coalesce(total_tips, 0) * coalesce(kitchen_tip_percentage, 0) / 100
  end
) stored;
```

`src/schema.sql` is updated to this end-state directly (its usual role as
the from-scratch schema reference); the live Supabase project is migrated
separately by hand-running the equivalent SQL in the Supabase SQL editor,
same split already used for `supabase/policies.sql`.

## Calculator (`src/App.tsx`, `src/utils.ts`)

- `Bar` type (`utils.ts`) gains `kitchen_tip_method: 'percentage_of_tips' | 'percentage_of_gross_kitchen_sales'`; the bars fetch in `App.tsx` selects it.
- New state: `grossKitchenSales` (string, same raw-string/`parseFloat(...) || 0` pattern as every other numeric input).
- A new "Gross Kitchen Sales" number field renders in the Tips card, but only when `selectedBar?.kitchen_tip_method === 'percentage_of_gross_kitchen_sales'`. Same input styling/attributes (`type="number"`, `min="0"`, `step="0.01"`, `placeholder="0.00"`) as the existing Cash Sales / Credit Card Sales fields, so it inherits the same ≥16px font-size and mobile behavior without any new CSS.
- Derived values:
  ```ts
  const grossKitchenSalesVal = parseFloat(grossKitchenSales) || 0;
  const kitchenTipMethod = selectedBar?.kitchen_tip_method ?? "percentage_of_tips";
  const kitchenTipBase = kitchenTipMethod === "percentage_of_gross_kitchen_sales" ? grossKitchenSalesVal : totalTips;
  const kitchenTipAmount = kitchenTipBase * kitchenTipPct / 100;
  ```
- Validation: since an empty Gross Kitchen Sales field would silently produce a wrong ($0) kitchen tip-out rather than just an incomplete one, it's required (not optional-defaults-to-0 like the other fields) when the selected bar uses that method. `canSave` gets an added condition, and the existing validation-hint list (`• Select a bar`, `• Enter who's closing`, etc.) gets a new line: `• Enter gross kitchen sales`.
- Display wording: the "N% off the top" / "Pool: $X after Y% kitchen tip-out" captions become base-aware, e.g. "10% of gross kitchen sales" instead of the generic "off the top" phrasing, when `kitchenTipMethod === "percentage_of_gross_kitchen_sales"`.
- `handleSave`'s insert payload adds `kitchen_tip_method: kitchenTipMethod` and `gross_kitchen_sales: kitchenTipMethod === "percentage_of_gross_kitchen_sales" ? grossKitchenSalesVal : null`.

## Bar Settings (`src/BarSettings.tsx`)

- `Bar` type and the `bars` select/query gain `kitchen_tip_method`.
- `Draft` gains `kitchenTipMethod`; `toDraft` reads it from the bar row.
- A new `<select>` next to the existing "Kitchen Tip-Out %" field, labeled "Kitchen Tip-Out Calculation", with options "% of Tips" / "% of Gross Kitchen Sales".
- `handleSave`'s update payload includes `kitchen_tip_method: draft.kitchenTipMethod`.

## Reports (`src/Reports.tsx`)

- `ReportRow` type and the `reports` select query gain `kitchen_tip_method` and `gross_kitchen_sales`.
- The "Kitchen Tip-Out" line in the report detail view becomes base-aware:
  - `percentage_of_tips` (today's format, unchanged): `12% ($84.00)`
  - `percentage_of_gross_kitchen_sales`: `10% of Gross Kitchen Sales ($1,200.00) = $120.00`

## Out of scope

- No changes to the webhook alerting, admin onboarding, bar management, or
  report-voiding gaps tracked elsewhere in `CLAUDE.md`.
- No UI for adding a new bar — Tempest is assumed to already exist as a row
  in `bars` (or admin adds it by hand, per the existing "no bar management"
  gap) with `kitchen_tip_method` set via the new Bar Settings dropdown.
