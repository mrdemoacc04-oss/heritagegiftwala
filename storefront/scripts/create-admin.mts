/**
 * Creates (or resets) the shop owner's login. Run from your own computer:
 *
 *   npm run admin:create -- owner@example.com                 you are asked for a strong password
 *   npm run admin:create -- owner@example.com --temporary     a temporary password the owner must change at first sign-in (expires in 48 hours;
 *                                                              add --hours=6 for a shorter life)
 *   npm run admin:create -- owner@example.com --reset-2fa     also switches two-step sign-in off (lost phone and recovery codes)
 *
 * The password is asked for at a hidden prompt; it is never written to disk or shell history.
 * Resetting signs that owner out everywhere.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { cleanDatabaseUrl, pgSsl } from "../src/lib/server/pg-config.ts";
import { hashPassword, passwordProblem } from "../src/lib/server/password.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const file of [".env.local", ".env"]) {
  const p = path.join(here, "..", file);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (put it in storefront/.env.local).");

const args = process.argv.slice(2);
const email = (args.find((a) => !a.startsWith("--")) ?? "").trim().toLowerCase();
const temporary = args.includes("--temporary");
const hours = Math.min(168, Math.max(1, Number(args.find((a) => a.startsWith("--hours="))?.split("=")[1] ?? 48)));
const reset2fa = args.includes("--reset-2fa");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: npm run admin:create -- owner@example.com [--temporary] [--reset-2fa]");

function ask(question: string): Promise<string> {
  const fromEnv = process.env.ADMIN_PASSWORD_FOR_SCRIPT;
  if (fromEnv) return Promise.resolve(fromEnv);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => (s.includes(question) ? write.call(rl, s) : write.call(rl, "*"));
  return new Promise((resolve) => rl.question(question, (answer) => (rl.close(), console.log(), resolve(answer))));
}

const password = await ask(temporary ? "Temporary password (the owner must change it at first sign-in): " : "Password (12+ characters): ");
if (!temporary) {
  const problem = passwordProblem(password, 12, ["heritage", "giftwala", "patan", email.split("@")[0]]);
  if (problem) throw new Error(problem);
} else if (password.length < 8 || password.length > 128) {
  throw new Error("A temporary password still needs 8 to 128 characters.");
}

const allowed = process.env.ADMIN_ALLOWED_EMAILS?.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
if (allowed && !allowed.includes(email)) console.warn(`\nNote: ${email} is not in ADMIN_ALLOWED_EMAILS in this environment. Add it on Vercel too, or this login will be refused.\n`);

const client = new pg.Client({ connectionString: cleanDatabaseUrl(url), ssl: pgSsl(url) });
await client.connect();
const hash = await hashPassword(password);
const { rows } = await client.query(
  `insert into shop.admins (email, password_hash, must_change_password, temp_password_expires_at, password_changed_at)
   values ($1, $2, $3, case when $3 then now() + make_interval(hours => $4) end, case when $3 then null else now() end)
   on conflict (email) do update set password_hash = excluded.password_hash, disabled = false,
     must_change_password = excluded.must_change_password, temp_password_expires_at = excluded.temp_password_expires_at,
     password_changed_at = excluded.password_changed_at
   returning id`,
  [email, hash, temporary, hours],
);
if (reset2fa) await client.query("update shop.admins set totp_enabled = false, totp_secret = null, totp_pending = null, recovery_hashes = '{}', totp_last_step = 0 where id = $1", [rows[0].id]);
// Resetting a login signs that owner out everywhere and cancels any pending reset links.
await client.query("delete from shop.admin_sessions where admin_id = $1", [rows[0].id]);
await client.query("update shop.password_resets set used_at = now() where admin_id = $1 and used_at is null", [rows[0].id]);
await client.query("insert into shop.admin_audit (admin_id, email, event, detail) values ($1, $2, 'login_set_by_script', $3)", [rows[0].id, email, [temporary ? "temporary password" : "password", reset2fa ? "two-step reset" : ""].filter(Boolean).join(", ")]);
await client.end();
console.log(`Admin login ready for ${email}${temporary ? ` (the temporary password must be changed at first sign-in, and stops working in ${hours} hours)` : ""}${reset2fa ? ", two-step sign-in switched off" : ""}`);
