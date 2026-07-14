// Local dev helper: mints a real admin-panel session without sending a
// magic-link email, since Supabase's built-in email sender rate-limits
// hard after a few sends. Uses SUPABASE_SERVICE_KEY (.env.local, never
// committed) to generate + verify a link server-side, then opens the
// same kind of URL the real email link would redirect to (session
// tokens in the hash) so Admin.tsx's existing auth code handles it
// completely unchanged. Never run this against a deployed build.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { execSync } from "child_process";

const root = new URL("..", import.meta.url).pathname;

const parseEnv = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    });

let env = {};
for (const file of [".env", ".env.local"]) {
  try {
    env = { ...env, ...Object.fromEntries(parseEnv(root + file)) };
  } catch {
    // optional
  }
}

const url = env.REACT_APP_SUPABASE_URL;
const anonKey = env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_KEY;
const email = process.argv[2];
const port = process.argv[3] ?? "3000";

if (!serviceKey) {
  console.error("SUPABASE_SERVICE_KEY not found in .env.local — add it before using this script.");
  process.exit(1);
}
if (!email) {
  console.error("Usage: npm run dev:signin -- you@example.com [port]");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (linkErr) {
  console.error("generateLink failed:", linkErr.message);
  process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
  email,
  token: linkData.properties.email_otp,
  type: "magiclink",
});
if (verifyErr) {
  console.error("verifyOtp failed:", verifyErr.message);
  process.exit(1);
}

const s = verifyData.session;
const hash = new URLSearchParams({
  access_token: s.access_token,
  refresh_token: s.refresh_token,
  expires_in: String(s.expires_in),
  expires_at: String(s.expires_at),
  token_type: s.token_type,
  type: "magiclink",
}).toString();

const target = `http://localhost:${port}/?admin#${hash}`;
console.log(`Signed-in URL for ${email}:\n${target}\n`);

try {
  execSync(`open "${target}"`);
  console.log("Opened in your default browser.");
} catch {
  console.log("Couldn't auto-open — copy/paste the URL above into your browser.");
}
