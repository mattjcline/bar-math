import Fuse from "fuse.js";

export type Bar = { id: string; name: string; kitchen_tip_percentage: number | null };
export type StaffUser = { id: string; name: string };

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
