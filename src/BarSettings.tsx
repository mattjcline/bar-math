import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { KitchenTipMethod } from "./utils";

type Bar = {
  id: string;
  name: string;
  kitchen_tip_percentage: number | null;
  kitchen_tip_method: KitchenTipMethod;
  webhook_url: string | null;
  webhook_delta_threshold: number | null;
};

type Draft = {
  kitchenTipPct: string;
  kitchenTipMethod: KitchenTipMethod;
  webhookUrl: string;
  webhookThreshold: string;
};

type SaveState = { status: "success" | "error"; message?: string };

const toDraft = (bar: Bar): Draft => ({
  kitchenTipPct: bar.kitchen_tip_percentage != null ? String(bar.kitchen_tip_percentage) : "",
  kitchenTipMethod: bar.kitchen_tip_method,
  webhookUrl: bar.webhook_url ?? "",
  webhookThreshold: bar.webhook_delta_threshold != null ? String(bar.webhook_delta_threshold) : "",
});

export default function BarSettings() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<string, SaveState | undefined>>({});

  useEffect(() => {
    supabase
      .from("bars")
      .select("id, name, kitchen_tip_percentage, kitchen_tip_method, webhook_url, webhook_delta_threshold")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          setLoadError("Couldn't load bars — check your connection.");
          setLoading(false);
          return;
        }
        const rows = data ?? [];
        setBars(rows);
        setDrafts(Object.fromEntries(rows.map((b) => [b.id, toDraft(b)])));
        setLoading(false);
      });
  }, []);

  const updateDraft = (barId: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [barId]: { ...prev[barId], ...patch } }));
    setSaveState((prev) => ({ ...prev, [barId]: undefined }));
  };

  const handleSave = async (barId: string) => {
    const draft = drafts[barId];

    const pct = draft.kitchenTipPct.trim() === "" ? null : parseFloat(draft.kitchenTipPct);
    if (pct != null && (isNaN(pct) || pct < 0 || pct > 100)) {
      setSaveState((prev) => ({ ...prev, [barId]: { status: "error", message: "Kitchen tip % must be between 0 and 100." } }));
      return;
    }

    const threshold = draft.webhookThreshold.trim() === "" ? null : parseFloat(draft.webhookThreshold);
    if (threshold != null && (isNaN(threshold) || threshold < 0)) {
      setSaveState((prev) => ({ ...prev, [barId]: { status: "error", message: "Alert threshold can't be negative." } }));
      return;
    }

    setSavingId(barId);
    const { data, error } = await supabase
      .from("bars")
      .update({
        kitchen_tip_percentage: pct,
        kitchen_tip_method: draft.kitchenTipMethod,
        webhook_url: draft.webhookUrl.trim() === "" ? null : draft.webhookUrl.trim(),
        webhook_delta_threshold: threshold,
      })
      .eq("id", barId)
      .select("id, name, kitchen_tip_percentage, kitchen_tip_method, webhook_url, webhook_delta_threshold")
      .single();
    setSavingId(null);

    if (error) {
      setSaveState((prev) => ({ ...prev, [barId]: { status: "error", message: error.message } }));
      return;
    }

    setBars((prev) => prev.map((b) => (b.id === barId ? data : b)));
    setDrafts((prev) => ({ ...prev, [barId]: toDraft(data) }));
    setSaveState((prev) => ({ ...prev, [barId]: { status: "success" } }));
  };

  return (
    <div className="card full-width">
      <div className="card-title">Bar Settings</div>

      {loading && <div className="field-hint">Loading…</div>}
      {loadError && <div className="field-hint error">{loadError}</div>}

      {!loading &&
        !loadError &&
        bars.map((bar, i) => {
          const draft = drafts[bar.id];
          const state = saveState[bar.id];
          if (!draft) return null;
          return (
            <div key={bar.id}>
              {i > 0 && <hr className="divider" />}
              <div className="section-title">{bar.name}</div>

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
                <input
                  type="url"
                  placeholder="https://…"
                  value={draft.webhookUrl}
                  onChange={(e) => updateDraft(bar.id, { webhookUrl: e.target.value })}
                />
              </div>

              <div className="field" style={{ maxWidth: "180px" }}>
                <label>Alert Threshold ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={draft.webhookThreshold}
                  onChange={(e) => updateDraft(bar.id, { webhookThreshold: e.target.value })}
                />
              </div>

              <button
                className="btn-save"
                style={{ marginTop: "0.4rem" }}
                disabled={savingId === bar.id}
                onClick={() => handleSave(bar.id)}
              >
                {savingId === bar.id ? "Saving…" : "Save"}
              </button>
              {state?.status === "success" && (
                <div className="save-status success" style={{ marginTop: "0.4rem" }}>
                  Saved.
                </div>
              )}
              {state?.status === "error" && <div className="field-hint error">{state.message}</div>}
            </div>
          );
        })}
    </div>
  );
}
