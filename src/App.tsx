import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0d0d0f;
    color: #c8c8d0;
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
  }

  .app {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  .header {
    border-bottom: 1px solid #2a2a32;
    padding-bottom: 1.25rem;
    margin-bottom: 2rem;
  }

  .header-eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    color: #5a5a6e;
    text-transform: uppercase;
    margin-bottom: 0.4rem;
  }

  .header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #e8e8f0;
    letter-spacing: -0.02em;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 640px) {
    .grid { grid-template-columns: 1fr; }
  }

  .card {
    background: #14141a;
    border: 1px solid #22222c;
    border-radius: 8px;
    padding: 1.25rem;
  }

  .card-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #5a5a6e;
    margin-bottom: 1rem;
  }

  .field {
    margin-bottom: 0.85rem;
  }

  .field label {
    display: block;
    font-size: 0.78rem;
    color: #8080a0;
    margin-bottom: 0.3rem;
  }

  .field input {
    width: 100%;
    background: #0d0d0f;
    border: 1px solid #2a2a36;
    border-radius: 5px;
    color: #e0e0ec;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.95rem;
    padding: 0.5rem 0.7rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .field input:focus {
    border-color: #5050a0;
  }

  .field input::placeholder {
    color: #3a3a50;
  }

  /* Bartenders */
  .bartender-row {
    display: grid;
    grid-template-columns: 1fr 80px 28px;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.6rem;
  }

  .bartender-row input {
    background: #0d0d0f;
    border: 1px solid #2a2a36;
    border-radius: 5px;
    color: #e0e0ec;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.88rem;
    padding: 0.45rem 0.6rem;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
  }

  .bartender-row input:focus { border-color: #5050a0; }
  .bartender-row input::placeholder { color: #3a3a50; }

  .btn-remove {
    background: none;
    border: 1px solid #2a2a36;
    border-radius: 5px;
    color: #5a5a6e;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0.4rem 0;
    text-align: center;
    transition: color 0.15s, border-color 0.15s;
    width: 28px;
    height: 28px;
  }

  .btn-remove:hover { color: #cc4444; border-color: #cc4444; }

  .btn-add {
    background: none;
    border: 1px dashed #2a2a44;
    border-radius: 5px;
    color: #5050a0;
    cursor: pointer;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    padding: 0.5rem;
    text-align: center;
    width: 100%;
    transition: border-color 0.15s, color 0.15s;
    margin-top: 0.3rem;
  }

  .btn-add:hover { border-color: #5050a0; color: #8080d0; }

  .row-labels {
    display: grid;
    grid-template-columns: 1fr 80px 28px;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  .row-labels span {
    font-size: 0.7rem;
    color: #4a4a60;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.06em;
  }

  /* Results */
  .results-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  @media (max-width: 640px) {
    .results-grid { grid-template-columns: 1fr; }
  }

  .result-block {
    background: #14141a;
    border: 1px solid #22222c;
    border-radius: 8px;
    padding: 1.1rem 1.25rem;
  }

  .result-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #5a5a6e;
    margin-bottom: 0.3rem;
  }

  .result-value {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 1.6rem;
    font-weight: 600;
    color: #e0e0f0;
    letter-spacing: -0.02em;
  }

  .result-value.over { color: #3dcc7a; }
  .result-value.short { color: #cc4444; }

  .till-badge {
    display: inline-block;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border-radius: 3px;
    padding: 0.2rem 0.45rem;
    margin-top: 0.4rem;
  }

  .till-badge.over { background: #0f2a1a; color: #3dcc7a; border: 1px solid #1a4a2a; }
  .till-badge.short { background: #2a0f0f; color: #cc4444; border: 1px solid #4a1a1a; }
  .till-badge.even { background: #1a1a2a; color: #8080c0; border: 1px solid #2a2a44; }

  /* Bartender payouts table */
  .payout-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.82rem;
  }

  .payout-table th {
    text-align: left;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a60;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #22222c;
  }

  .payout-table th:last-child { text-align: right; }

  .payout-table td {
    padding: 0.5rem 0;
    border-bottom: 1px solid #1a1a22;
    color: #c0c0d8;
    vertical-align: middle;
  }

  .payout-table td:last-child {
    text-align: right;
    color: #e0e0f0;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .payout-table tr:last-child td { border-bottom: none; }

  .payout-table .hrs {
    color: #5a5a6e;
    font-size: 0.75rem;
  }

  .divider {
    border: none;
    border-top: 1px solid #1e1e28;
    margin: 1.5rem 0;
  }

  .section-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #5a5a6e;
    margin-bottom: 1rem;
  }

  .full-width { grid-column: 1 / -1; }

  .timestamp {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    color: #3a3a50;
    margin-top: 0.4rem;
  }

  /* Header meta: bar selector + closing user */
  .header-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 0.6rem;
  }

  .bar-select {
    background: #0d0d0f;
    border: 1px solid #2a2a36;
    border-radius: 5px;
    color: #e0e0ec;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.78rem;
    padding: 0.4rem 0.6rem;
    outline: none;
  }

  .bar-select:focus { border-color: #5050a0; }

  .closing-field {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .closing-field label {
    font-size: 0.68rem;
    color: #5a5a6e;
    font-family: 'IBM Plex Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .closing-field input {
    background: #0d0d0f;
    border: 1px solid #2a2a36;
    border-radius: 5px;
    color: #e0e0ec;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.82rem;
    padding: 0.4rem 0.6rem;
    width: 150px;
    outline: none;
  }

  .closing-field input:focus { border-color: #5050a0; }

  /* Validation / warning hints */
  .field-hint {
    font-size: 0.72rem;
    margin-top: 0.5rem;
    font-family: 'IBM Plex Mono', monospace;
  }

  .field-hint.warn { color: #d9a441; }
  .field-hint.error { color: #cc4444; }

  .bartender-row.duplicate input:first-child { border-color: #cc4444; }
  .bartender-row.zero-hours input:nth-child(2) { border-color: #d9a441; }

  /* Till delta severity tiers */
  .result-value.warning { color: #d9a441; }
  .result-value.blocked { color: #ff5050; }

  .till-badge.warning { background: #2a220f; color: #d9a441; border: 1px solid #4a3a1a; }
  .till-badge.blocked { background: #2a0f0f; color: #ff5050; border: 1px solid #ff5050; }

  /* Notes */
  .notes-field textarea {
    width: 100%;
    min-height: 70px;
    background: #0d0d0f;
    border: 1px solid #2a2a36;
    border-radius: 5px;
    color: #e0e0ec;
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    padding: 0.6rem 0.7rem;
    outline: none;
    resize: vertical;
  }

  .notes-field textarea:focus { border-color: #5050a0; }
  .notes-field textarea::placeholder { color: #3a3a50; }

  /* Save */
  .save-bar {
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .btn-save {
    background: #3a3aa0;
    border: 1px solid #5050c0;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.85rem;
    letter-spacing: 0.05em;
    padding: 0.65rem 1.4rem;
    transition: background 0.15s, opacity 0.15s;
  }

  .btn-save:hover:not(:disabled) { background: #4a4ac0; }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

  .save-status {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
  }

  .save-status.success { color: #3dcc7a; }
  .save-status.error { color: #cc4444; }

  .validation-list {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.72rem;
    color: #d9a441;
  }
`;

function customRound(val: number) {
  const floor = Math.floor(val);
  const dec = val - floor;
  return dec >= 0.9 ? floor + 1 : floor;
}

function fmt(val: number) {
  return (
    "$" +
    val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtInt(val: number) {
  return "$" + customRound(val).toLocaleString("en-US");
}

const defaultBartenders = [
  { id: 1, name: "", hours: "" },
  { id: 2, name: "", hours: "" },
  { id: 3, name: "", hours: "" },
];

let nextId = 4;

function getDefaultDate() {
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  return now.toISOString().split("T")[0];
}

type Bar = { id: string; name: string };
type StaffUser = { id: string; name: string };

export default function App() {
  const [ccTips, setCcTips] = useState("");
  const [cashTips, setCashTips] = useState("");
  const [till, setTill] = useState("");
  const [cashSales, setCashSales] = useState("");
  const [creditSales, setCreditSales] = useState("");
  const [amBank, setAmBank] = useState("400");
  const [bartenders, setBartenders] = useState(defaultBartenders);
  const [notes, setNotes] = useState("");
  const [shiftDate, setShiftDate] = useState(getDefaultDate);

  const [bars, setBars] = useState<Bar[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [selectedBarId, setSelectedBarId] = useState("");
  const [closingName, setClosingName] = useState("");
  const [loadError, setLoadError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveInfo, setSaveInfo] = useState<{ version: number; savedAt: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [barsRes, usersRes] = await Promise.all([
        supabase.from("bars").select("id, name").order("name"),
        supabase.from("users").select("id, name").eq("is_active", true).order("name"),
      ]);
      if (barsRes.error || usersRes.error) {
        setLoadError("Couldn't load bars or staff list — check your connection.");
        return;
      }
      setBars(barsRes.data ?? []);
      setUsers(usersRes.data ?? []);
    })();
  }, []);

  const ccVal = parseFloat(ccTips) || 0;
  const cashTipsVal = parseFloat(cashTips) || 0;
  const tillVal = parseFloat(till) || 0;
  const cashSalesVal = parseFloat(cashSales) || 0;
  const creditSalesVal = parseFloat(creditSales) || 0;
  const amBankVal = parseFloat(amBank) || 0;

  const totalTips = ccVal + cashTipsVal;
  const totalSales = cashSalesVal + creditSalesVal;
  const tipPercent = totalSales > 0 ? (totalTips / totalSales) * 100 : 0;
  const totalHours = bartenders.reduce(
    (s, b) => s + (parseFloat(b.hours) || 0),
    0,
  );
  const hourlyRate = totalHours > 0 ? totalTips / totalHours : 0;
  const expectedTill = cashSalesVal + amBankVal;
  const delta = tillVal - expectedTill;
  const hasTill = till !== "" && cashSales !== "";
  const absDelta = Math.abs(delta);
  const deltaSeverity: "none" | "normal" | "warning" | "blocked" = !hasTill
    ? "none"
    : absDelta >= 400
      ? "blocked"
      : absDelta >= 20
        ? "warning"
        : "normal";

  const nameKey = (name: string) => name.trim().toLowerCase();
  const duplicateNameSet = new Set<string>();
  {
    const seen = new Set<string>();
    for (const b of bartenders) {
      const key = nameKey(b.name);
      if (key === "") continue;
      if (seen.has(key)) duplicateNameSet.add(key);
      seen.add(key);
    }
  }
  const hasDuplicateNames = duplicateNameSet.size > 0;
  const hasZeroHourWarning = bartenders.some(
    (b) => nameKey(b.name) !== "" && (parseFloat(b.hours) || 0) === 0,
  );

  const canSave =
    !saving &&
    selectedBarId !== "" &&
    closingName.trim() !== "" &&
    deltaSeverity !== "blocked" &&
    !hasDuplicateNames;

  const handleSave = async () => {
    if (!canSave) return;
    setSaveError("");
    setSaveInfo(null);
    setSaving(true);
    try {
      let knownUsers = users;

      const resolveUser = async (name: string): Promise<string> => {
        const trimmed = name.trim();
        const existing = knownUsers.find((u) => nameKey(u.name) === nameKey(trimmed));
        if (existing) return existing.id;
        const { data, error } = await supabase
          .from("users")
          .insert({ name: trimmed })
          .select("id, name")
          .single();
        if (error) throw error;
        knownUsers = [...knownUsers, { id: data.id, name: data.name }];
        await supabase.from("user_bars").insert({ user_id: data.id, bar_id: selectedBarId });
        return data.id;
      };

      const closingUserId = await resolveUser(closingName);

      const staff: { user_id: string; name: string; hours: number; payout: number }[] = [];
      for (const b of bartenders) {
        if (nameKey(b.name) === "") continue;
        const hrs = parseFloat(b.hours) || 0;
        const userId = await resolveUser(b.name);
        staff.push({
          user_id: userId,
          name: b.name.trim(),
          hours: hrs,
          payout: customRound(hrs * hourlyRate),
        });
      }

      setUsers(knownUsers);

      const { data: existingRows, error: fetchErr } = await supabase
        .from("reports")
        .select("id, version, is_current")
        .eq("bar_id", selectedBarId)
        .eq("shift_date", shiftDate)
        .eq("is_void", false)
        .order("version", { ascending: false });
      if (fetchErr) throw fetchErr;

      const nextVersion = existingRows && existingRows.length > 0 ? existingRows[0].version + 1 : 1;
      const currentIds = (existingRows ?? []).filter((r) => r.is_current).map((r) => r.id);
      if (currentIds.length > 0) {
        const { error: updateErr } = await supabase
          .from("reports")
          .update({ is_current: false })
          .in("id", currentIds);
        if (updateErr) throw updateErr;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("reports")
        .insert({
          shift_date: shiftDate,
          version: nextVersion,
          is_current: true,
          bar_id: selectedBarId,
          created_by: closingUserId,
          cc_tips: ccVal,
          cash_tips: cashTipsVal,
          till: hasTill ? tillVal : null,
          cash_sales: hasTill ? cashSalesVal : null,
          credit_sales: creditSales !== "" ? creditSalesVal : null,
          am_bank: amBankVal,
          staff,
          total_tips: totalTips,
          hourly_rate: hourlyRate,
          till_delta: hasTill ? delta : null,
          notes: notes.trim() === "" ? null : notes.trim(),
        })
        .select("version, created_at")
        .single();
      if (insertErr) throw insertErr;

      setSaveInfo({ version: inserted.version, savedAt: inserted.created_at });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save report.");
    } finally {
      setSaving(false);
    }
  };

  const addBartender = () => {
    setBartenders((prev) => [...prev, { id: nextId++, name: "", hours: "" }]);
  };

  const removeBartender = (id: number) => {
    setBartenders((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBartender = (id: number, field: string, value: string) => {
    setBartenders((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    );
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="header">
          <div className="header-eyebrow">End of Night</div>
          <h1>Bar Math</h1>

          <div className="header-meta">
            <select
              className="bar-select"
              value={selectedBarId}
              onChange={(e) => setSelectedBarId(e.target.value)}
            >
              <option value="" disabled>
                Select bar…
              </option>
              {bars.map((bar) => (
                <option key={bar.id} value={bar.id}>
                  {bar.name}
                </option>
              ))}
            </select>

            <div className="closing-field">
              <label>Closing:</label>
              <input
                type="text"
                list="known-users"
                placeholder="Your name"
                value={closingName}
                onChange={(e) => setClosingName(e.target.value)}
              />
            </div>

            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{
                color: "#3a3a50",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "0.68rem",
                borderBottom: "1px solid #2a2a3a",
                paddingBottom: "0.1rem",
                cursor: "pointer",
              }}>
                {new Date(shiftDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </div>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  width: "100%",
                  height: "100%",
                  cursor: "pointer",
                  colorScheme: "dark",
                }}
              />
            </div>
          </div>

          <datalist id="known-users">
            {users.map((u) => (
              <option key={u.id} value={u.name} />
            ))}
          </datalist>

          {loadError && <div className="field-hint error">{loadError}</div>}
        </div>

        <div className="grid">
          {/* Inputs */}
          <div className="card">
            <div className="card-title">Tips</div>
            <div className="field">
              <label>Credit Card Tips</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={ccTips}
                onChange={(e) => setCcTips(e.target.value)}
              />
            </div>
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

          <div className="card">
            <div className="card-title">Till</div>
            <div className="field">
              <label>AM Bank (Expected Amount)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="400.00"
                value={amBank}
                onChange={(e) => setAmBank(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Cash Sales</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cashSales}
                onChange={(e) => setCashSales(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Credit Card Sales (optional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={creditSales}
                onChange={(e) => setCreditSales(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Money in the Till</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={till}
                onChange={(e) => setTill(e.target.value)}
              />
            </div>
          </div>

          {/* Bartenders full width */}
          <div className="card full-width">
            <div className="card-title">Staff</div>
            <div className="row-labels">
              <span>Name</span>
              <span>Hours</span>
              <span></span>
            </div>
            {bartenders.map((b) => {
              const key = nameKey(b.name);
              const isDuplicate = key !== "" && duplicateNameSet.has(key);
              const isZeroHours = key !== "" && (parseFloat(b.hours) || 0) === 0;
              const rowClass = [
                "bartender-row",
                isDuplicate && "duplicate",
                isZeroHours && "zero-hours",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div className={rowClass} key={b.id}>
                  <input
                    type="text"
                    list="known-users"
                    placeholder="Bartender name"
                    value={b.name}
                    onChange={(e) =>
                      updateBartender(b.id, "name", e.target.value)
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0"
                    value={b.hours}
                    onChange={(e) =>
                      updateBartender(b.id, "hours", e.target.value)
                    }
                  />
                  <button
                    className="btn-remove"
                    onClick={() => removeBartender(b.id)}
                    disabled={bartenders.length <= 1}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <button className="btn-add" onClick={addBartender}>
              + Add Bartender
            </button>
            {hasDuplicateNames && (
              <div className="field-hint error">
                Duplicate names aren't allowed — each bartender needs a unique name.
              </div>
            )}
            {!hasDuplicateNames && hasZeroHourWarning && (
              <div className="field-hint warn">
                Some bartenders have 0 hours — they'll receive no payout.
              </div>
            )}
          </div>

          <div className="card full-width notes-field">
            <div className="card-title">Notes</div>
            <textarea
              placeholder="Anything worth flagging about tonight's close…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Results */}
        <hr className="divider" />
        <div className="section-title">
          Results for {new Date(shiftDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
        </div>

        <div className="results-grid">
          <div className="result-block">
            <div className="result-label">Total Tips</div>
            <div className="result-value">{fmt(totalTips)}</div>
          </div>

          <div className="result-block">
            <div className="result-label">Hourly Rate</div>
            <div className="result-value">
              {totalHours > 0 ? fmt(hourlyRate) : "—"}
              {totalHours > 0 && (
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "#5a5a6e",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  /hr
                </span>
              )}
            </div>
          </div>

          {/* Till delta */}
          <div className="result-block">
            <div className="result-label">Till Delta</div>
            {hasTill ? (
              <>
                <div
                  className={`result-value ${
                    deltaSeverity === "blocked"
                      ? "blocked"
                      : deltaSeverity === "warning"
                        ? "warning"
                        : delta > 0
                          ? "over"
                          : delta < 0
                            ? "short"
                            : ""
                  }`}
                >
                  {delta === 0
                    ? "Even"
                    : `${delta > 0 ? "+" : ""}${fmt(delta)}`}
                </div>
                <div
                  className={`till-badge ${
                    deltaSeverity === "blocked"
                      ? "blocked"
                      : deltaSeverity === "warning"
                        ? "warning"
                        : delta > 0
                          ? "over"
                          : delta < 0
                            ? "short"
                            : "even"
                  }`}
                >
                  {delta > 0 ? "Over" : delta < 0 ? "Short" : "Exact"}
                </div>
                <div
                  style={{
                    marginTop: "0.5rem",
                    fontSize: "0.72rem",
                    color: "#4a4a60",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  Expected {fmt(expectedTill)} (incl. {fmt(amBankVal)} AM bank)
                </div>
                {deltaSeverity === "warning" && (
                  <div className="field-hint warn">
                    ⚠ Exceeds ±$20 — double-check the count
                  </div>
                )}
                {deltaSeverity === "blocked" && (
                  <div className="field-hint error">
                    ✕ Exceeds ±$400 — cannot save until corrected
                  </div>
                )}
              </>
            ) : (
              <div className="result-value" style={{ color: "#3a3a50" }}>
                —
              </div>
            )}
          </div>

          <div className="result-block">
            <div className="result-label">Tip %</div>
            <div className="result-value">
              {totalSales > 0 ? `${tipPercent.toFixed(1)}%` : "—"}
            </div>
          </div>

          {/* Payouts */}
          <div className="result-block">
            <div className="result-label">Bartender Payouts</div>
            {totalHours > 0 ? (
              <table className="payout-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Hrs</th>
                    <th>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {bartenders.map((b) => {
                    const hrs = parseFloat(b.hours) || 0;
                    const payout = hrs * hourlyRate;
                    return (
                      <tr key={b.id}>
                        <td>
                          {b.name || (
                            <span style={{ color: "#3a3a50" }}>Unnamed</span>
                          )}
                        </td>
                        <td className="hrs">{hrs}</td>
                        <td>{hrs > 0 ? fmtInt(payout) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  color: "#3a3a50",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "0.85rem",
                }}
              >
                Add hours to calculate
              </div>
            )}
          </div>
        </div>

        <div className="save-bar">
          <button className="btn-save" disabled={!canSave} onClick={handleSave}>
            {saving ? "Saving…" : "Save Report"}
          </button>
          {!canSave && !saving && (
            <div className="validation-list">
              {selectedBarId === "" && <div>• Select a bar</div>}
              {closingName.trim() === "" && <div>• Enter who's closing</div>}
              {hasDuplicateNames && <div>• Fix duplicate bartender names</div>}
              {deltaSeverity === "blocked" && <div>• Till delta exceeds ±$400</div>}
            </div>
          )}
          {saveError && <div className="save-status error">{saveError}</div>}
          {saveInfo && (
            <div className="save-status success">
              Saved as v{saveInfo.version} ·{" "}
              {new Date(saveInfo.savedAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}