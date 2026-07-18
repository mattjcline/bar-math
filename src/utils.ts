import Fuse from "fuse.js";

export type KitchenTipMethod = "percentage_of_tips" | "percentage_of_gross_kitchen_sales";

export type Bar = { id: string; name: string; kitchen_tip_percentage: number | null; kitchen_tip_method: KitchenTipMethod };
export type StaffUser = { id: string; name: string; is_active: boolean };

export function customRound(val: number) {
  const floor = Math.floor(val);
  const dec = val - floor;
  return dec >= 0.9 ? floor + 1 : floor;
}

export function fmt(val: number) {
  return (
    "$" +
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

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

function possessive(name: string): string {
  return name.endsWith("'s") ? name : `${name}'s`;
}

export function kitchenTipMechanismHint(barName: string, method: KitchenTipMethod, percentage: number): string {
  const name = possessive(barName);
  return method === "percentage_of_gross_kitchen_sales"
    ? `${name} kitchen tip-out is ${percentage}% of this.`
    : `${name} kitchen tip-out is ${percentage}% of total tips, not gross kitchen sales — this is recorded for reporting only.`;
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

export function fmtInt(val: number) {
  return "$" + customRound(val).toLocaleString("en-US");
}

export function getDefaultDate() {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nameKey(name: string) {
  return name.trim().toLowerCase();
}

export function filterSuggestions(suggestions: string[], query: string): string[] {
  if (query.trim() === "") return suggestions;
  const fuse = new Fuse(suggestions, { threshold: 0.4 });
  return fuse.search(query).map((result) => result.item);
}
