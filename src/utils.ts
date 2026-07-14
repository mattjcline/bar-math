export type Bar = { id: string; name: string };
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
  return now.toISOString().split("T")[0];
}

export function nameKey(name: string) {
  return name.trim().toLowerCase();
}
