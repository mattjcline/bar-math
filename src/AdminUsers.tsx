import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./supabase";

type Role = "admin" | "manager" | "bartender";

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  role: "admin" | "manager";
  is_active: boolean;
  auth_user_id: string | null;
};

type Bartender = { id: string; name: string };

type Draft = { name: string; email: string; role: Role; isActive: boolean };
type SaveState = { status: "success" | "error"; message?: string };

export default function AdminUsers() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [bartenders, setBartenders] = useState<Bartender[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<string, SaveState | undefined>>({});

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "manager">("manager");
  const [promoteExistingId, setPromoteExistingId] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState<"" | "invited" | "promoted">("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    const [adminsRes, bartendersRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, email, role, is_active, auth_user_id")
        .in("role", ["admin", "manager"])
        .order("name"),
      supabase.from("users").select("id, name").eq("role", "bartender").eq("is_active", true).order("name"),
    ]);
    if (adminsRes.error || bartendersRes.error) {
      setLoadError("Couldn't load admins & managers — check your connection.");
      setLoading(false);
      return;
    }
    const rows = adminsRes.data ?? [];
    setAdmins(rows);
    setDrafts(
      Object.fromEntries(
        rows.map((u) => [u.id, { name: u.name, email: u.email ?? "", role: u.role, isActive: u.is_active }]),
      ),
    );
    setBartenders(bartendersRes.data ?? []);
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
    const trimmedName = draft.name.trim();
    const trimmedEmail = draft.email.trim().toLowerCase();
    if (trimmedName === "" || trimmedEmail === "") {
      setSaveState((prev) => ({ ...prev, [userId]: { status: "error", message: "Name and email can't be blank." } }));
      return;
    }

    setSavingId(userId);
    const { error } = await supabase
      .from("users")
      .update({ name: trimmedName, email: trimmedEmail, role: draft.role, is_active: draft.isActive })
      .eq("id", userId);
    setSavingId(null);

    if (error) {
      setSaveState((prev) => ({ ...prev, [userId]: { status: "error", message: error.message } }));
      return;
    }

    setSaveState((prev) => ({ ...prev, [userId]: { status: "success" } }));
    load();
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    const trimmedName = inviteName.trim();
    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (trimmedName === "" || trimmedEmail === "") {
      setInviteError("Name and email are required.");
      return;
    }

    const wasPromote = promoteExistingId !== "";
    setInviteSaving(true);
    const { error } = wasPromote
      ? await supabase
          .from("users")
          .update({ name: trimmedName, email: trimmedEmail, role: inviteRole })
          .eq("id", promoteExistingId)
      : await supabase.from("users").insert({ name: trimmedName, email: trimmedEmail, role: inviteRole, is_active: true });
    setInviteSaving(false);

    if (error) {
      setInviteError(error.message);
      return;
    }

    setInviteName("");
    setInviteEmail("");
    setInviteRole("manager");
    setPromoteExistingId("");
    setInviteSuccess(wasPromote ? "promoted" : "invited");
    load();
  };

  return (
    <div className="card full-width" style={{ marginTop: "1.5rem" }}>
      <div className="card-title">Admins & Managers</div>

      {loading && <div className="field-hint">Loading…</div>}
      {loadError && <div className="field-hint error">{loadError}</div>}
      {!loading && !loadError && admins.length === 0 && (
        <div className="field-hint">No admins or managers yet.</div>
      )}

      {!loading &&
        !loadError &&
        admins.map((u, i) => {
          const draft = drafts[u.id];
          const state = saveState[u.id];
          if (!draft) return null;
          return (
            <div key={u.id}>
              {i > 0 && <hr className="divider" />}

              <div className="field" style={{ maxWidth: "320px" }}>
                <label>Name</label>
                <input type="text" value={draft.name} onChange={(e) => updateDraft(u.id, { name: e.target.value })} />
              </div>

              <div className="field" style={{ maxWidth: "320px" }}>
                <label>Email</label>
                <input type="email" value={draft.email} onChange={(e) => updateDraft(u.id, { email: e.target.value })} />
              </div>

              <div className="field" style={{ maxWidth: "220px" }}>
                <label>Role</label>
                <select
                  className="bar-select"
                  value={draft.role}
                  onChange={(e) => updateDraft(u.id, { role: e.target.value as Role })}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="bartender">Bartender (remove admin access)</option>
                </select>
              </div>

              <button
                className={`btn-toggle-active ${draft.isActive ? "active" : "inactive"}`}
                onClick={() => updateDraft(u.id, { isActive: !draft.isActive })}
              >
                {draft.isActive ? "Active" : "Inactive"}
              </button>

              <div className="field-hint" style={{ marginTop: "0.5rem" }}>
                {u.auth_user_id ? "Signed in at least once." : "Invited — hasn't signed in yet."}
              </div>

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

      <hr className="divider" />

      <div className="section-title">Invite Admin or Manager</div>
      <form onSubmit={handleInvite}>
        {bartenders.length > 0 && (
          <div className="field" style={{ maxWidth: "320px" }}>
            <label>Promote an existing bartender (optional)</label>
            <select
              className="bar-select"
              value={promoteExistingId}
              onChange={(e) => {
                const id = e.target.value;
                setPromoteExistingId(id);
                const match = bartenders.find((b) => b.id === id);
                if (match) setInviteName(match.name);
              }}
            >
              <option value="">— New person —</option>
              {bartenders.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field" style={{ maxWidth: "320px" }}>
          <label>Name</label>
          <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
        </div>

        <div className="field" style={{ maxWidth: "320px" }}>
          <label>Email</label>
          <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
        </div>

        <div className="field" style={{ maxWidth: "180px" }}>
          <label>Role</label>
          <select className="bar-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "manager")}>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button type="submit" className="btn-save" disabled={inviteSaving}>
          {inviteSaving ? "Sending…" : "Send Invite"}
        </button>
        {inviteError && <div className="field-hint error">{inviteError}</div>}
        {inviteSuccess && (
          <div className="save-status success" style={{ marginTop: "0.4rem" }}>
            {inviteSuccess === "promoted" ? "Promoted." : "Invited."} They can sign in at{" "}
            <code>{window.location.origin}{window.location.pathname}?admin</code> once they enter their email.
          </div>
        )}
      </form>
    </div>
  );
}
