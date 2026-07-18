import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./supabase";
import type { KitchenTipMethod } from "./utils";

type Bar = {
  id: string;
  name: string;
  kitchen_tip_percentage: number | null;
  kitchen_tip_method: KitchenTipMethod;
  webhook_url: string | null;
  webhook_delta_threshold: number | null;
  is_active: boolean;
};

type Draft = {
  name: string;
  isActive: boolean;
  kitchenTipPct: string;
  kitchenTipMethod: KitchenTipMethod;
  webhookUrl: string;
  webhookThreshold: string;
};

type SaveState = { status: "success" | "error"; message?: string };

const BAR_COLUMNS =
  "id, name, kitchen_tip_percentage, kitchen_tip_method, webhook_url, webhook_delta_threshold, is_active";

const toDraft = (bar: Bar): Draft => ({
  name: bar.name,
  isActive: bar.is_active,
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

  const [newBarName, setNewBarName] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState(false);

  const load = () => {
    supabase
      .from("bars")
      .select(BAR_COLUMNS)
      .order("is_active", { ascending: false })
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
  };

  useEffect(() => {
    load();
  }, []);

  const updateDraft = (barId: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [barId]: { ...prev[barId], ...patch } }));
    setSaveState((prev) => ({ ...prev, [barId]: undefined }));
  };

  const isDuplicateName = (name: string, excludeId?: string) =>
    bars.some((b) => b.id !== excludeId && b.name.toLowerCase() === name.toLowerCase());

  const handleSave = async (barId: string) => {
    const draft = drafts[barId];

    const trimmedName = draft.name.trim();
    if (trimmedName === "") {
      setSaveState((prev) => ({ ...prev, [barId]: { status: "error", message: "Name can't be blank." } }));
      return;
    }
    if (isDuplicateName(trimmedName, barId)) {
      setSaveState((prev) => ({ ...prev, [barId]: { status: "error", message: "A bar with this name already exists." } }));
      return;
    }

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
        name: trimmedName,
        is_active: draft.isActive,
        kitchen_tip_percentage: pct,
        kitchen_tip_method: draft.kitchenTipMethod,
        webhook_url: draft.webhookUrl.trim() === "" ? null : draft.webhookUrl.trim(),
        webhook_delta_threshold: threshold,
      })
      .eq("id", barId)
      .select(BAR_COLUMNS)
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

  const handleAddBar = async (e: FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSuccess(false);

    const trimmedName = newBarName.trim();
    if (trimmedName === "") {
      setAddError("Name can't be blank.");
      return;
    }
    if (isDuplicateName(trimmedName)) {
      setAddError("A bar with this name already exists.");
      return;
    }

    setAddSaving(true);
    const { data, error } = await supabase
      .from("bars")
      .insert({ name: trimmedName })
      .select(BAR_COLUMNS)
      .single();
    setAddSaving(false);

    if (error) {
      setAddError(error.message);
      return;
    }

    setBars((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setDrafts((prev) => ({ ...prev, [data.id]: toDraft(data) }));
    setNewBarName("");
    setAddSuccess(true);
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

              <div className="field" style={{ maxWidth: "320px" }}>
                <label>Name</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateDraft(bar.id, { name: e.target.value })}
                />
              </div>

              <button
                className={`btn-toggle-active ${draft.isActive ? "active" : "inactive"}`}
                onClick={() => updateDraft(bar.id, { isActive: !draft.isActive })}
              >
                {draft.isActive ? "Active" : "Inactive"}
              </button>

              <div className="field" style={{ maxWidth: "180px", marginTop: "0.75rem" }}>
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
                  className="bar-select"
                  style={{ width: "100%" }}
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

      <hr className="divider" />

      <div className="section-title">Add a New Bar</div>
      <form onSubmit={handleAddBar}>
        <div className="field" style={{ maxWidth: "320px" }}>
          <label>Name</label>
          <input type="text" value={newBarName} onChange={(e) => setNewBarName(e.target.value)} required />
        </div>

        <button type="submit" className="btn-save" disabled={addSaving}>
          {addSaving ? "Adding…" : "Add Bar"}
        </button>
        {addError && <div className="field-hint error">{addError}</div>}
        {addSuccess && (
          <div className="save-status success" style={{ marginTop: "0.4rem" }}>
            Added. Its kitchen tip-out and webhook settings default to the usual values above — edit its row
            to change them.
          </div>
        )}
      </form>
    </div>
  );
}
