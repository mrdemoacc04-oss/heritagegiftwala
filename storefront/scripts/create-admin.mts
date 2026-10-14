/**
 * Creates (or resets the password of) a shop-owner login:
 *   npm run admin:create -- owner@example.com
 * You are asked for the password; it is never written to disk or shell history.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { hashPassword, passwordProblem } from "../src/lib/server/password.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const file of [".env.local", ".env"]) {
  const p = path.join(here, "..", file);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (put it in storefront/.env.local).");

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: npm run admin:create -- owner@example.com");

function ask(question: string): Promise<string> {
  const fromEnv = process.env.ADMIN_PASSWORD_FOR_SCRIPT;
  if (fromEnv) return Promise.resolve(fromEnv);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => (s.includes(question) ? write.call(rl, s) : write.call(rl, "*"));
  return new Promise((resolve) => rl.question(question, (answer) => (rl.close(), console.log(), resolve(answer))));
}

const password = await ask("Password (12+ characters): ");
const problem = passwordProblem(password, 12);
if (problem) throw new Error(problem);

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
const hash = await hashPassword(password);
const { rows } = await client.query(
  `insert into shop.admins (email, password_hash) values ($1, $2)
   on conflict (email) do update set password_hash = excluded.password_hash, disabled = false returning id`,
  [email, hash],
);
// A password reset signs that admin out everywhere.
await client.query("delete from shop.admin_sessions where admin_id = $1", [rows[0].id]);
await client.end();
console.log(`Admin login ready for ${email}`);
