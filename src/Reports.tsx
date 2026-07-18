import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { fmt, fmtInt, kitchenTipReportLabel, type KitchenTipMethod } from "./utils";

type StaffPayout = { user_id: string; name: string; hours: number; payout: number };

type ReportRow = {
  id: string;
  shift_date: string;
  version: number;
  is_void: boolean;
  bar_id: string;
  till: number | null;
  am_bank: number | null;
  staff: StaffPayout[] | null;
  cc_tips: number | null;
  cash_tips: number | null;
  cash_sales: number | null;
  credit_sales: number | null;
  total_sales: number | null;
  total_tips: number | null;
  tip_percentage: number | null;
  hourly_rate: number | null;
  till_delta: number | null;
  kitchen_tip_percentage: number | null;
  kitchen_tip_amount: number | null;
  kitchen_tip_method: KitchenTipMethod;
  gross_kitchen_sales: number | null;
  notes: string | null;
  created_at: string;
  bars: { name: string } | null;
  users: { name: string } | null;
};

type Bar = { id: string; name: string; is_active: boolean };

type ReportGroup = {
  key: string;
  barName: string;
  shiftDate: string;
  versions: ReportRow[];
};

export default function Reports() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [selectedBarId, setSelectedBarId] = useState("");
  const [groups, setGroups] = useState<ReportGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [viewedVersionId, setViewedVersionId] = useState<Record<string, string>>({});
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [confirmingVoidId, setConfirmingVoidId] = useState<string | null>(null);
  const [voidError, setVoidError] = useState("");

  useEffect(() => {
    supabase
      .from("bars")
      .select("id, name, is_active")
      .order("name")
      .then(({ data }) => setBars(data ?? []));
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setError("");
    let query = supabase
      .from("reports")
      .select(
        "id, shift_date, version, is_void, bar_id, till, am_bank, staff, cc_tips, cash_tips, cash_sales, credit_sales, total_sales, total_tips, tip_percentage, hourly_rate, till_delta, kitchen_tip_percentage, kitchen_tip_amount, kitchen_tip_method, gross_kitchen_sales, notes, created_at, bars(name), users(name)"
      )
      .order("shift_date", { ascending: false })
      .order("version", { ascending: false });
    if (selectedBarId) query = query.eq("bar_id", selectedBarId);

    const { data, error: fetchErr } = await query;
    if (fetchErr) {
      setError("Couldn't load reports — check your connection.");
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as ReportRow[];
    const byKey = new Map<string, ReportGroup>();
    for (const row of rows) {
      const key = `${row.bar_id}_${row.shift_date}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.versions.push(row);
      } else {
        byKey.set(key, {
          key,
          barName: row.bars?.name ?? "Unknown bar",
          shiftDate: row.shift_date,
          versions: [row],
        });
      }
    }
    const sorted = Array.from(byKey.values()).sort((a, b) => {
      if (a.shiftDate !== b.shiftDate) return a.shiftDate < b.shiftDate ? 1 : -1;
      return a.barName.localeCompare(b.barName);
    });
    setGroups(sorted);
    setLoading(false);
  };

  useEffect(() => {
    loadReports();
    setExpandedKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBarId]);

  const handleVoid = async (reportId: string) => {
    if (confirmingVoidId !== reportId) {
      setConfirmingVoidId(reportId);
      return;
    }
    setVoidingId(reportId);
    setVoidError("");
    const { error: voidErr } = await supabase
      .from("reports")
      .update({ is_void: true })
      .eq("id", reportId);
    setVoidingId(null);
    setConfirmingVoidId(null);
    if (voidErr) {
      setVoidError(voidErr.message);
      return;
    }
    await loadReports();
  };

  const handleUnvoid = async (reportId: string, barId: string, shiftDate: string) => {
    if (confirmingVoidId !== reportId) {
      setConfirmingVoidId(reportId);
      return;
    }
    setVoidingId(reportId);
    setVoidError("");

    // Voiding never touches is_current, so a voided row can still carry
    // is_current = true from before it was voided. If a fresh report has
    // since been saved for the same bar+date (handleSave starts a new
    // version thread once the old one is voided, since voided rows are
    // excluded from version-counting), un-voiding this row straight would
    // collide with the "one current, non-void report per bar+date" DB
    // constraint. Check for that conflict up front instead of surfacing
    // whatever raw error Postgres would give.
    const { data: conflict, error: conflictErr } = await supabase
      .from("reports")
      .select("version")
      .eq("bar_id", barId)
      .eq("shift_date", shiftDate)
      .eq("is_current", true)
      .eq("is_void", false)
      .neq("id", reportId)
      .maybeSingle();

    if (conflictErr) {
      setVoidingId(null);
      setConfirmingVoidId(null);
      setVoidError(conflictErr.message);
      return;
    }
    if (conflict) {
      setVoidingId(null);
      setConfirmingVoidId(null);
      setVoidError(
        `Can't un-void — v${conflict.version} is already the current report for this date. Void that one first if you want to bring this version back.`,
      );
      return;
    }

    const { error: unvoidErr } = await supabase
      .from("reports")
      .update({ is_void: false })
      .eq("id", reportId);
    setVoidingId(null);
    setConfirmingVoidId(null);
    if (unvoidErr) {
      setVoidError(unvoidErr.message);
      return;
    }
    await loadReports();
  };

  return (
    <div className="card full-width">
      <div className="card-title">Reports</div>

      <div className="field" style={{ maxWidth: "260px" }}>
        <label>Bar</label>
        <select
          className="bar-select"
          value={selectedBarId}
          onChange={(e) => setSelectedBarId(e.target.value)}
        >
          <option value="">All bars</option>
          {bars.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {!b.is_active && " (inactive)"}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="field-hint">Loading…</div>}
      {error && <div className="field-hint error">{error}</div>}
      {!loading && !error && groups.length === 0 && (
        <div className="field-hint">No reports yet.</div>
      )}

      {!loading && !error && groups.length > 0 && (
        <div className="reports-list">
          {groups.map((g) => {
            const current = g.versions[0];
            const expanded = expandedKey === g.key;
            return (
              <div className="report-row" key={g.key}>
                <div
                  className="report-row-summary"
                  onClick={() => {
                    setExpandedKey(expanded ? null : g.key);
                    setConfirmingVoidId(null);
                    setViewedVersionId((prev) => {
                      const next = { ...prev };
                      delete next[g.key];
                      return next;
                    });
                  }}
                >
                  <span className="report-row-date">{g.shiftDate}</span>
                  <span className="report-row-bar">{g.barName}</span>
                  <span className="report-row-stats">
                    <span>{current.total_tips != null ? fmt(current.total_tips) : "—"}</span>
                    <span>
                      {current.till_delta == null
                        ? "—"
                        : `${current.till_delta > 0 ? "+" : ""}${fmt(current.till_delta)}`}
                    </span>
                    {current.is_void && <span className="void-badge">Voided</span>}
                    {g.versions.length > 1 && (
                      <span className="version-badge">v{current.version}</span>
                    )}
                    <span className="expand-chevron">{expanded ? "▾" : "▸"}</span>
                  </span>
                </div>
                {expanded && (
                  <ReportDetail
                    versions={g.versions}
                    viewedVersionId={viewedVersionId[g.key] ?? current.id}
                    onSelectVersion={(id) =>
                      setViewedVersionId((prev) => ({ ...prev, [g.key]: id }))
                    }
                    voidingId={voidingId}
                    confirmingVoidId={confirmingVoidId}
                    voidError={voidError}
                    onVoid={handleVoid}
                    onUnvoid={handleUnvoid}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportDetail({
  versions,
  viewedVersionId,
  onSelectVersion,
  voidingId,
  confirmingVoidId,
  voidError,
  onVoid,
  onUnvoid,
}: {
  versions: ReportRow[];
  viewedVersionId: string;
  onSelectVersion: (id: string) => void;
  voidingId: string | null;
  confirmingVoidId: string | null;
  voidError: string;
  onVoid: (id: string) => void;
  onUnvoid: (id: string, barId: string, shiftDate: string) => void;
}) {
  const latest = versions[0];
  const viewed = versions.find((v) => v.id === viewedVersionId) ?? latest;
  const isSuperseded = viewed.id !== latest.id;
  const tipPool =
    viewed.total_tips != null && viewed.kitchen_tip_amount != null
      ? viewed.total_tips - viewed.kitchen_tip_amount
      : null;

  return (
    <div className="report-detail">
      {isSuperseded && (
        <div className="superseded-banner">
          Viewing v{viewed.version}, saved {new Date(viewed.created_at).toLocaleString()} — superseded by v
          {latest.version}. This is not the current report.
        </div>
      )}

      <div className="report-detail-grid">
        <div>
          <div className="result-label">Closed By</div>
          <div>{viewed.users?.name ?? "—"}</div>
        </div>
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
        <div>
          <div className="result-label">Gross Kitchen Sales</div>
          <div>{viewed.gross_kitchen_sales != null ? fmt(viewed.gross_kitchen_sales) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Tip Pool</div>
          <div>{tipPool != null ? fmt(tipPool) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Hourly Rate</div>
          <div>{viewed.hourly_rate != null ? fmt(viewed.hourly_rate) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Till</div>
          <div>{viewed.till != null ? fmt(viewed.till) : "—"}</div>
        </div>
        <div>
          <div className="result-label">AM Bank</div>
          <div>{viewed.am_bank != null ? fmt(viewed.am_bank) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Till Delta</div>
          <div>
            {viewed.till_delta == null
              ? "—"
              : `${viewed.till_delta > 0 ? "+" : ""}${fmt(viewed.till_delta)}`}
          </div>
        </div>
        <div>
          <div className="result-label">Cash Tips</div>
          <div>{viewed.cash_tips != null ? fmt(viewed.cash_tips) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Credit Card Tips</div>
          <div>{viewed.cc_tips != null ? fmt(viewed.cc_tips) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Total Tips</div>
          <div>{viewed.total_tips != null ? fmt(viewed.total_tips) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Tip %</div>
          <div>{viewed.tip_percentage != null ? `${viewed.tip_percentage.toFixed(1)}%` : "—"}</div>
        </div>
        <div>
          <div className="result-label">Cash Sales</div>
          <div>{viewed.cash_sales != null ? fmt(viewed.cash_sales) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Credit Card Sales</div>
          <div>{viewed.credit_sales != null ? fmt(viewed.credit_sales) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Total Sales</div>
          <div>{viewed.total_sales != null ? fmt(viewed.total_sales) : "—"}</div>
        </div>
        <div>
          <div className="result-label">Saved At</div>
          <div>{new Date(viewed.created_at).toLocaleString()}</div>
        </div>
      </div>

      {viewed.notes && (
        <div className="field-hint" style={{ marginTop: "0.75rem" }}>
          Notes: {viewed.notes}
        </div>
      )}

      {viewed.staff && viewed.staff.length > 0 && (
        <table className="payout-table" style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Hours</th>
              <th>Payout</th>
            </tr>
          </thead>
          <tbody>
            {viewed.staff.map((s) => (
              <tr key={s.user_id}>
                <td>{s.name}</td>
                <td className="hrs">{s.hours}</td>
                <td>{fmtInt(s.payout)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {versions.length > 1 && (
        <div className="version-history">
          <div className="section-title" style={{ marginTop: "1rem" }}>
            Version History
          </div>
          {versions.map((v) => (
            <div
              key={v.id}
              className={`version-history-row ${v.id === viewed.id ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectVersion(v.id);
              }}
            >
              v{v.version} — {new Date(v.created_at).toLocaleString()}{" "}
              {v.id === latest.id && <span className="current-badge">Current</span>}
              {v.is_void && <span className="void-badge">Voided</span>}
            </div>
          ))}
        </div>
      )}

      {!isSuperseded && !viewed.is_void && (
        <a
          className="btn-edit"
          href={`${window.location.origin}${window.location.pathname}?editReport=${viewed.id}`}
          onClick={(e) => e.stopPropagation()}
        >
          Edit This Report
        </a>
      )}

      {viewed.is_void ? (
        <button
          className="btn-edit"
          disabled={voidingId === viewed.id}
          onClick={(e) => {
            e.stopPropagation();
            onUnvoid(viewed.id, viewed.bar_id, viewed.shift_date);
          }}
        >
          {voidingId === viewed.id
            ? "Un-voiding…"
            : confirmingVoidId === viewed.id
            ? "Confirm Un-void?"
            : isSuperseded
            ? `Un-void v${viewed.version}`
            : "Un-void Report"}
        </button>
      ) : (
        <button
          className="btn-void"
          disabled={voidingId === viewed.id}
          onClick={(e) => {
            e.stopPropagation();
            onVoid(viewed.id);
          }}
        >
          {voidingId === viewed.id
            ? "Voiding…"
            : confirmingVoidId === viewed.id
            ? "Confirm Void?"
            : isSuperseded
            ? `Void v${viewed.version}`
            : "Void Report"}
        </button>
      )}
      {voidError && <div className="field-hint error">{voidError}</div>}
    </div>
  );
}
