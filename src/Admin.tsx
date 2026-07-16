import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "./supabase";
import Reports from "./Reports";
import BarSettings from "./BarSettings";
import Staff from "./Staff";
import "./App.css";

type AdminSession = {
  email: string;
  name: string | null;
  role: string | null;
  isAuthorized: boolean;
};

type Tab = "reports" | "settings" | "staff";

// supabase-js treats any 5xx response as "retryable" and stringifies the raw
// fetch Response instead of reading its JSON body, so .message ends up as the
// unhelpful literal string "{}" whenever the server errors (e.g. a broken
// SMTP/email-provider config) rather than rejecting the request itself.
function friendlyAuthErrorMessage(err: { name?: string; message: string }): string {
  if (err.name === "AuthRetryableFetchError") {
    return "Couldn't reach Supabase to send that — check the email server (SMTP) configuration and try again.";
  }
  return err.message;
}

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("reports");

  useEffect(() => {
    let active = true;

    const evaluateSession = async (authUserId?: string, userEmail?: string) => {
      if (!authUserId || !userEmail) {
        if (active) setSession(null);
        return;
      }
      let { data } = await supabase
        .from("users")
        .select("name, role, is_active")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (!data) {
        // Not linked yet -- self-link-on-first-login: claim an invited row
        // matching this email, if one exists and hasn't been claimed
        // already. Scoped by the "claim invited user row" RLS policy, not
        // just this query, so this is safe even against a crafted request.
        const { data: claimed } = await supabase
          .from("users")
          .update({ auth_user_id: authUserId })
          .is("auth_user_id", null)
          .eq("email", userEmail.toLowerCase())
          .select("name, role, is_active")
          .maybeSingle();
        data = claimed ?? null;
      }

      if (!active) return;
      const role = data?.role ?? null;
      setSession({
        email: userEmail,
        name: data?.name ?? null,
        role,
        isAuthorized: data?.is_active === true && (role === "admin" || role === "manager"),
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

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    });
    setSending(false);
    if (sendError) {
      setError(friendlyAuthErrorMessage(sendError));
      return;
    }
    setCodeSent(true);
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setVerifying(false);
    if (verifyError) {
      setError(friendlyAuthErrorMessage(verifyError));
    }
  };

  const useDifferentEmail = () => {
    setCodeSent(false);
    setCode("");
    setError("");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCodeSent(false);
    setCode("");
    setEmail("");
  };

  if (loading) {
    return <div className="app" />;
  }

  return (
    <div className="app">
      <div className="header admin-header">
        <div>
          <div className="header-eyebrow">Bar Math</div>
          <h1>Admin</h1>
        </div>
        {session && session.isAuthorized && (
          <div className="header-signed-in">
            <span>
              <strong>{session.name ?? session.email}</strong> ({session.role})
            </span>
            <button className="btn-signout" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        )}
      </div>

      {!session && (
        <div className="card" style={{ maxWidth: "360px" }}>
          <div className="card-title">Sign In</div>
          {codeSent ? (
            <form onSubmit={handleVerifyCode}>
              <div className="field-hint" style={{ marginBottom: "0.75rem" }}>
                Check your email for a code.
              </div>
              <div className="field">
                <label>Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Code from your email"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-save" disabled={verifying}>
                {verifying ? "Verifying…" : "Verify Code"}
              </button>
              {error && <div className="field-hint error">{error}</div>}
              <button
                type="button"
                className="btn-signout"
                style={{ display: "block", marginTop: "0.75rem" }}
                onClick={useDifferentEmail}
              >
                Use a different email
              </button>
            </form>
          ) : (
            <form onSubmit={handleSendCode}>
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
                {sending ? "Sending…" : "Send Code"}
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
        <>
          <div className="tab-bar">
            <button
              className={`tab-button ${activeTab === "reports" ? "active" : ""}`}
              onClick={() => setActiveTab("reports")}
            >
              Reports
            </button>
            <button
              className={`tab-button ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              Bar Settings
            </button>
            <button
              className={`tab-button ${activeTab === "staff" ? "active" : ""}`}
              onClick={() => setActiveTab("staff")}
            >
              Staff
            </button>
          </div>

          {activeTab === "reports" && <Reports />}
          {activeTab === "settings" && <BarSettings />}
          {activeTab === "staff" && <Staff />}
        </>
      )}
    </div>
  );
}
