import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./supabase";
import {
  computeKitchenTipAmount,
  customRound,
  fmt,
  fmtInt,
  getDefaultDate,
  kitchenTipMechanismHint,
  kitchenTipPoolCaption,
  kitchenTipShortCaption,
  nameKey,
  type Bar,
  type KitchenTipMethod,
  type StaffUser,
} from "./utils";
import NameAutocomplete from "./NameAutocomplete";
import "./App.css";

const defaultBartenders = [
  { id: 1, name: "", hours: "" },
  { id: 2, name: "", hours: "" },
  { id: 3, name: "", hours: "" },
];

let nextId = 4;

type EditableReport = {
  version: number;
  shift_date: string;
  bar_id: string;
  cc_tips: number | null;
  cash_tips: number | null;
  till: number | null;
  cash_sales: number | null;
  credit_sales: number | null;
  am_bank: number | null;
  gross_kitchen_sales: number | null;
  staff: { user_id: string; name: string; hours: number; payout: number }[] | null;
  notes: string | null;
  is_void: boolean;
  bars: { name: string } | null;
  users: { name: string } | null;
};

const UNLOCK_KEY = "bar-math-unlocked";

export default function App() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(UNLOCK_KEY) === "true");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const [ccTips, setCcTips] = useState("");
  const [cashTips, setCashTips] = useState("");
  const [till, setTill] = useState("");
  const [cashSales, setCashSales] = useState("");
  const [creditSales, setCreditSales] = useState("");
  const [amBank, setAmBank] = useState("400");
  const [grossKitchenSales, setGrossKitchenSales] = useState("");
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

  const editReportId = new URLSearchParams(window.location.search).get("editReport");
  const [editingReport, setEditingReport] = useState<{ version: number; barName: string; shiftDate: string } | null>(null);
  const [editLoadError, setEditLoadError] = useState("");

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      const [barsRes, usersRes] = await Promise.all([
        supabase.from("bars").select("id, name, kitchen_tip_percentage, kitchen_tip_method").order("name"),
        // Deliberately not filtering by is_active here: this is also the
        // matching set resolveUser checks before creating a new user row,
        // and it must include deactivated bartenders too, or re-entering
        // an exact name that was deactivated silently creates a duplicate
        // row instead of reusing/reactivating the original. Active-only
        // filtering for the autocomplete suggestions happens separately,
        // via activeNames below.
        supabase.from("users").select("id, name, is_active").order("name"),
      ]);
      if (barsRes.error || usersRes.error) {
        setLoadError("Couldn't load bars or staff list — check your connection.");
        return;
      }
      setBars(barsRes.data ?? []);
      setUsers(usersRes.data ?? []);
      const defaultBar = (barsRes.data ?? []).find((b) => b.name === "Louie's");
      if (defaultBar && !editReportId) setSelectedBarId(defaultBar.id);
    })();
  }, [unlocked, editReportId]);

  useEffect(() => {
    if (!unlocked || !editReportId) return;
    (async () => {
      const { data, error } = await supabase
        .from("reports")
        .select(
          "id, version, shift_date, bar_id, cc_tips, cash_tips, till, cash_sales, credit_sales, am_bank, gross_kitchen_sales, staff, notes, is_void, bars(name), users(name)"
        )
        .eq("id", editReportId)
        .single();
      const report = data as EditableReport | null;
      if (error || !report) {
        setEditLoadError("Couldn't load that report to edit — check the link or try again.");
        return;
      }
      if (report.is_void) {
        setEditLoadError("This report has been voided and can't be edited.");
        return;
      }
      setSelectedBarId(report.bar_id);
      setShiftDate(report.shift_date);
      setCcTips(report.cc_tips != null ? String(report.cc_tips) : "");
      setCashTips(report.cash_tips != null ? String(report.cash_tips) : "");
      setTill(report.till != null ? String(report.till) : "");
      setCashSales(report.cash_sales != null ? String(report.cash_sales) : "");
      setCreditSales(report.credit_sales != null ? String(report.credit_sales) : "");
      setAmBank(report.am_bank != null ? String(report.am_bank) : "400");
      setGrossKitchenSales(report.gross_kitchen_sales != null ? String(report.gross_kitchen_sales) : "");
      setNotes(report.notes ?? "");
      setClosingName(report.users?.name ?? "");
      const staff = report.staff ?? [];
      setBartenders(
        staff.length > 0 ? staff.map((s) => ({ id: nextId++, name: s.name, hours: String(s.hours) })) : defaultBartenders,
      );
      setEditingReport({ version: report.version, barName: report.bars?.name ?? "", shiftDate: report.shift_date });
    })();
  }, [unlocked, editReportId]);

  const handleUnlockSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (passwordInput === process.env.REACT_APP_SITE_PASSWORD) {
      localStorage.setItem(UNLOCK_KEY, "true");
      setUnlocked(true);
    } else {
      setPasswordError(true);
    }
  };

  const ccVal = parseFloat(ccTips) || 0;
  const cashTipsVal = parseFloat(cashTips) || 0;
  const tillVal = parseFloat(till) || 0;
  const cashSalesVal = parseFloat(cashSales) || 0;
  const creditSalesVal = parseFloat(creditSales) || 0;
  const amBankVal = parseFloat(amBank) || 0;
  const grossKitchenSalesVal = parseFloat(grossKitchenSales) || 0;

  const totalTips = ccVal + cashTipsVal;
  const totalSales = cashSalesVal + creditSalesVal;
  const tipPercent = totalSales > 0 ? (totalTips / totalSales) * 100 : 0;
  const totalHours = bartenders.reduce(
    (s, b) => s + (parseFloat(b.hours) || 0),
    0,
  );

  const selectedBar = bars.find((b) => b.id === selectedBarId);
  const kitchenTipPct = selectedBar?.kitchen_tip_percentage ?? 0;
  const kitchenTipMethod: KitchenTipMethod = selectedBar?.kitchen_tip_method ?? "percentage_of_tips";
  const kitchenTipAmount = computeKitchenTipAmount(kitchenTipMethod, kitchenTipPct, totalTips, grossKitchenSalesVal);
  const tipPool = totalTips - kitchenTipAmount;
  const hourlyRate = totalHours > 0 ? tipPool / totalHours : 0;
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
  const activeNames = users.filter((u) => u.is_active).map((u) => u.name);

  const canSave =
    !saving &&
    selectedBarId !== "" &&
    closingName.trim() !== "" &&
    deltaSeverity !== "blocked" &&
    !hasDuplicateNames &&
    grossKitchenSales.trim() !== "";

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
          .select("id, name, is_active")
          .single();
        if (error) throw error;
        knownUsers = [...knownUsers, { id: data.id, name: data.name, is_active: data.is_active }];
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

      // Deliberately not filtering out voided rows here: version numbers
      // must stay unique per (bar_id, shift_date) even across a void, or a
      // fresh save right after voiding the only existing report reuses
      // version 1 instead of continuing to 2 -- two different rows both
      // called "v1" for the same shift, with no reliable way to tell them
      // apart by version number alone.
      const { data: existingRows, error: fetchErr } = await supabase
        .from("reports")
        .select("id, version, is_current")
        .eq("bar_id", selectedBarId)
        .eq("shift_date", shiftDate)
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
          kitchen_tip_percentage: kitchenTipPct,
          kitchen_tip_method: kitchenTipMethod,
          gross_kitchen_sales: grossKitchenSalesVal,
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

  if (!unlocked) {
    return (
      <div className="app">
        <div className="header">
          <div className="header-eyebrow">End of Night</div>
          <h1>Bar Math</h1>
        </div>
        <div className="card" style={{ maxWidth: "320px" }}>
          <div className="card-title">Enter Password</div>
          <form onSubmit={handleUnlockSubmit}>
            <div className="field">
              <input
                type="password"
                placeholder="Password"
                autoFocus
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
              />
            </div>
            <button type="submit" className="btn-save">
              Unlock
            </button>
            {passwordError && (
              <div className="field-hint error">Incorrect password</div>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
      <div className="app">
        <div className="header">
          <div className="header-eyebrow">End of Night</div>
          <h1>Bar Math</h1>

          <div className="header-meta">
            <select
              className="bar-select"
              value={selectedBarId}
              onChange={(e) => setSelectedBarId(e.target.value)}
              disabled={!!editingReport}
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
              <NameAutocomplete
                value={closingName}
                onChange={setClosingName}
                suggestions={activeNames}
                placeholder="Your name"
              />
            </div>

            <div className="date-field">
              <label>Date:</label>
              <div className="date-display">
                <span>
                  {new Date(shiftDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="date-input-overlay"
                  disabled={!!editingReport}
                />
              </div>
            </div>
          </div>

          {editingReport && (
            <div className="superseded-banner">
              Editing v{editingReport.version} of {editingReport.barName} —{" "}
              {new Date(editingReport.shiftDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              . Saving adds a new version — it won't overwrite this one. Bar and date are locked while editing.
            </div>
          )}
          {editLoadError && <div className="field-hint error">{editLoadError}</div>}
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
              {selectedBar && (
                <div className="field-hint">
                  {kitchenTipMechanismHint(selectedBar.name, kitchenTipMethod, kitchenTipPct)}
                </div>
              )}
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
              <div className="field-hint">Expected: {fmt(expectedTill)} (Cash Sales + AM Bank)</div>
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
                  <NameAutocomplete
                    value={b.name}
                    onChange={(v) => updateBartender(b.id, "name", v)}
                    suggestions={activeNames}
                    placeholder="Bartender name"
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
            <div className="result-label">Kitchen Tip-Out</div>
            <div className="result-value">
              {selectedBar ? fmt(kitchenTipAmount) : "—"}
            </div>
            {selectedBar && (
              <div
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.72rem",
                  color: "#4a4a60",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {kitchenTipShortCaption(kitchenTipMethod, kitchenTipPct)}
              </div>
            )}
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
            {totalHours > 0 && selectedBar && kitchenTipPct > 0 && (
              <div
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.72rem",
                  color: "#4a4a60",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                Pool: {fmt(tipPool)} after {kitchenTipPoolCaption(kitchenTipMethod, kitchenTipPct)}
              </div>
            )}
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
            {saving ? "Saving…" : editingReport ? "Save New Version" : "Save Report"}
          </button>
          {!canSave && !saving && (
            <div className="validation-list">
              {selectedBarId === "" && <div>• Select a bar</div>}
              {closingName.trim() === "" && <div>• Enter who's closing</div>}
              {hasDuplicateNames && <div>• Fix duplicate bartender names</div>}
              {deltaSeverity === "blocked" && <div>• Till delta exceeds ±$400</div>}
              {grossKitchenSales.trim() === "" && (
                <div>• Enter gross kitchen sales</div>
              )}
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

        <div className="app-footer">
          <a href="?admin" className="footer-link">Admin →</a>
        </div>
      </div>
  );
}