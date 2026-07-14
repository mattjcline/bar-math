import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Bartender = {
  id: string;
  name: string;
  is_active: boolean;
};

type Bar = { id: string; name: string };

type Draft = { name: string; isActive: boolean };
type SaveState = { status: "success" | "error"; message?: string };

export default function Staff() {
  const [bartenders, setBartenders] = useState<Bartender[]>([]);
  const [bars, setBars] = useState<Bar[]>([]);
  const [userBars, setUserBars] = useState<Record<string, string[]>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [barFilter, setBarFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<string, SaveState | undefined>>({});
  const [addBarSelection, setAddBarSelection] = useState<Record<string, string>>({});
  const [linkError, setLinkError] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    supabase
      .from("bars")
      .select("id, name")
      .order("name")
      .then(({ data }) => setBars(data ?? []));
  }, []);

  const load = async () => {
    setLoading(true);
    setLoadError("");

    const [usersRes, userBarsRes] = await Promise.all([
      supabase.from("users").select("id, name, is_active").eq("role", "bartender").order("name"),
      supabase.from("user_bars").select("user_id, bar_id"),
    ]);

    if (usersRes.error || userBarsRes.error) {
      setLoadError("Couldn't load staff — check your connection.");
      setLoading(false);
      return;
    }

    const rows = usersRes.data ?? [];
    setBartenders(rows);
    setDrafts(Object.fromEntries(rows.map((u) => [u.id, { name: u.name, isActive: u.is_active }])));

    const linkMap: Record<string, string[]> = {};
    for (const row of userBarsRes.data ?? []) {
      linkMap[row.user_id] = [...(linkMap[row.user_id] ?? []), row.bar_id];
    }
    setUserBars(linkMap);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDraft = (userId: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [userId]: { ...prev[userId], ...patch } }));
    setSaveState((prev) => ({ ...prev, [userId]: undefined }));
  };

  const handleSave = async (userId: string) => {
    const draft = drafts[userId];
    const trimmed = draft.name.trim();
    if (trimmed === "") {
      setSaveState((prev) => ({ ...prev, [userId]: { status: "error", message: "Name can't be blank." } }));
      return;
    }

    setSavingId(userId);
    const { data, error } = await supabase
      .from("users")
      .update({ name: trimmed, is_active: draft.isActive })
      .eq("id", userId)
      .select("id, name, is_active")
      .single();
    setSavingId(null);

    if (error) {
      setSaveState((prev) => ({ ...prev, [userId]: { status: "error", message: error.message } }));
      return;
    }

    setBartenders((prev) => prev.map((u) => (u.id === userId ? data : u)));
    setDrafts((prev) => ({ ...prev, [userId]: { name: data.name, isActive: data.is_active } }));
    setSaveState((prev) => ({ ...prev, [userId]: { status: "success" } }));
  };

  const handleAddBar = async (userId: string, barId: string) => {
    if (!barId) return;
    setLinkError((prev) => ({ ...prev, [userId]: undefined }));
    const { error } = await supabase.from("user_bars").insert({ user_id: userId, bar_id: barId });
    if (error) {
      setLinkError((prev) => ({ ...prev, [userId]: error.message }));
      return;
    }
    setUserBars((prev) => ({ ...prev, [userId]: [...(prev[userId] ?? []), barId] }));
    setAddBarSelection((prev) => ({ ...prev, [userId]: "" }));
  };

  const handleRemoveBar = async (userId: string, barId: string) => {
    setLinkError((prev) => ({ ...prev, [userId]: undefined }));
    const { error } = await supabase
      .from("user_bars")
      .delete()
      .eq("user_id", userId)
      .eq("bar_id", barId);
    if (error) {
      setLinkError((prev) => ({ ...prev, [userId]: error.message }));
      return;
    }
    setUserBars((prev) => ({ ...prev, [userId]: (prev[userId] ?? []).filter((id) => id !== barId) }));
  };

  const barName = (barId: string) => bars.find((b) => b.id === barId)?.name ?? "Unknown bar";

  const visible = bartenders.filter((u) => {
    if (!showInactive && !u.is_active) return false;
    if (barFilter && !(userBars[u.id] ?? []).includes(barFilter)) return false;
    return true;
  });

  return (
    <div className="card full-width">
      <div className="card-title">Staff</div>

      <div className="staff-filters">
        <div className="field" style={{ maxWidth: "220px", marginBottom: 0 }}>
          <label>Bar</label>
          <select className="bar-select" value={barFilter} onChange={(e) => setBarFilter(e.target.value)}>
            <option value="">All bars</option>
            {bars.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <label className="show-inactive-toggle">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {loading && <div className="field-hint">Loading…</div>}
      {loadError && <div className="field-hint error">{loadError}</div>}
      {!loading && !loadError && visible.length === 0 && (
        <div className="field-hint">No staff match this filter.</div>
      )}

      {!loading &&
        !loadError &&
        visible.map((u, i) => {
          const draft = drafts[u.id];
          const state = saveState[u.id];
          const linkedBarIds = userBars[u.id] ?? [];
          const availableBars = bars.filter((b) => !linkedBarIds.includes(b.id));
          if (!draft) return null;
          return (
            <div key={u.id}>
              {i > 0 && <hr className="divider" />}

              <div className="field" style={{ maxWidth: "320px" }}>
                <label>Name</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateDraft(u.id, { name: e.target.value })}
                />
              </div>

              <button
                className={`btn-toggle-active ${draft.isActive ? "active" : "inactive"}`}
                onClick={() => updateDraft(u.id, { isActive: !draft.isActive })}
              >
                {draft.isActive ? "Active" : "Inactive"}
              </button>

              <div className="bar-chips">
                {linkedBarIds.length === 0 && <span className="field-hint">No bars linked.</span>}
                {linkedBarIds.map((barId) => (
                  <span className="bar-chip" key={barId}>
                    {barName(barId)}
                    <button className="bar-chip-remove" onClick={() => handleRemoveBar(u.id, barId)}>
                      ×
                    </button>
                  </span>
                ))}
                {availableBars.length > 0 && (
                  <select
                    className="bar-select bar-chip-add"
                    value={addBarSelection[u.id] ?? ""}
                    onChange={(e) => {
                      setAddBarSelection((prev) => ({ ...prev, [u.id]: e.target.value }));
                      handleAddBar(u.id, e.target.value);
                    }}
                  >
                    <option value="">+ Add bar…</option>
                    {availableBars.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {linkError[u.id] && <div className="field-hint error">{linkError[u.id]}</div>}

              <button
                className="btn-save"
                style={{ marginTop: "0.75rem" }}
                disabled={savingId === u.id}
                onClick={() => handleSave(u.id)}
              >
                {savingId === u.id ? "Saving…" : "Save"}
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
