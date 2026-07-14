import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./supabase";
import "./App.css";

type AdminSession = {
  email: string;
  name: string | null;
  role: string | null;
  isAuthorized: boolean;
};

function adminRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}?admin`;
}

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const evaluateSession = async (authUserId?: string, userEmail?: string) => {
      if (!authUserId || !userEmail) {
        if (active) setSession(null);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("name, role")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (!active) return;
      const role = data?.role ?? null;
      setSession({
        email: userEmail,
        name: data?.name ?? null,
        role,
        isAuthorized: role === "admin" || role === "manager",
      });
    };

    supabase.auth.getSession().then(({ data }) => {
      evaluateSession(data.session?.user.id, data.session?.user.email).finally(() => {
        if (active) setLoading(false);
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      evaluateSession(newSession?.user.id, newSession?.user.email);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSendLink = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: adminRedirectUrl() },
    });
    setSending(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setLinkSent(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setLinkSent(false);
    setEmail("");
  };

  if (loading) {
    return <div className="app" />;
  }

  return (
    <div className="app">
      <div className="header">
        <div className="header-eyebrow">Bar Math</div>
        <h1>Admin</h1>
      </div>

      {!session && (
        <div className="card" style={{ maxWidth: "360px" }}>
          <div className="card-title">Sign In</div>
          {linkSent ? (
            <div className="field-hint">Check your email for a sign-in link.</div>
          ) : (
            <form onSubmit={handleSendLink}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-save" disabled={sending}>
                {sending ? "Sending…" : "Send Magic Link"}
              </button>
              {error && <div className="field-hint error">{error}</div>}
            </form>
          )}
        </div>
      )}

      {session && !session.isAuthorized && (
        <div className="card" style={{ maxWidth: "360px" }}>
          <div className="card-title">Not Authorized</div>
          <div className="field-hint error">
            Signed in as {session.email}, but this account isn't set up for
            admin access.
          </div>
          <button className="btn-save" style={{ marginTop: "1rem" }} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      )}

      {session && session.isAuthorized && (
        <div className="card" style={{ maxWidth: "360px" }}>
          <div className="card-title">Signed In</div>
          <div className="field-hint">
            {session.name ?? session.email} ({session.role})
          </div>
          <div className="field-hint" style={{ marginTop: "0.5rem" }}>
            Admin panel coming soon.
          </div>
          <button className="btn-save" style={{ marginTop: "1rem" }} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
