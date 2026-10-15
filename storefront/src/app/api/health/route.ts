import { dbEnabled, sqlOne } from "@/lib/server/db";
import { deriveKey, json } from "@/lib/server/security";

/**
 * A plain "is the shop wired up?" check for the person setting the site up. It reports only whether each part is
 * configured and reachable (never a value), and caches its answer for 20 seconds so it can't be used to hammer the database.
 */
let cached: { at: number; body: Record<string, string>; ok: boolean } | undefined;

export async function GET() {
  if (cached && Date.now() - cached.at < 20_000) return json(cached.body, cached.ok ? 200 : 503);

  const body: Record<string, string> = {};
  try {
    deriveKey("health");
    body.appSecret = "ok";
  } catch {
    body.appSecret = "missing: set APP_SECRET (32+ random characters)";
  }
  body.adminAllowList = process.env.ADMIN_ALLOWED_EMAILS?.trim() ? "ok" : "empty: set ADMIN_ALLOWED_EMAILS or nobody can sign in to /admin";
  body.photoStorage = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY";
  if (!dbEnabled()) {
    body.database = "not configured: set DATABASE_URL (the Supabase Transaction pooler address) and redeploy";
  } else {
    try {
      await Promise.race([sqlOne("select 1 as ok"), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))]);
      body.database = "connected";
    } catch (e) {
      console.error("[health] database check failed:", e instanceof Error ? e.message : e);
      body.database = "configured but not reachable: check the password and that it is the pooler address (see the deployment logs)";
    }
  }
  const ok = body.appSecret === "ok" && body.database === "connected";
  cached = { at: Date.now(), body, ok };
  return json(body, ok ? 200 : 503);
}
