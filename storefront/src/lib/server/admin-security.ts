import "server-only";
import { cookies, headers } from "next/headers";
import QRCode from "qrcode";
import { audit, voidResetLinks, type Admin } from "./admin-auth";
import { sql, sqlOne } from "./db";
import { verifyPassword } from "./password";
import { allow, deriveKey, ipKey } from "./security";
import { cookieName, destroyOtherSessions } from "./sessions";
import { newRecoveryCodes, newSecret, normalizeRecovery, otpauthUri, recoveryHash, seal, unseal, verifyCode } from "./totp";

/**
 * Setting up, turning off and re-issuing two-step sign-in. Every change asks for the password again, so a session left
 * open on a shared computer can't be used to take over the login. Attempts are counted before they are checked.
 */

const tooMany = async (admin: Admin) => {
  const own = await allow(`admin-2fa-manage:${admin.id}`, 10, 15 * 60);
  const ip = await allow(`admin-2fa-manage-ip:${ipKey(await headers())}`, 30, 15 * 60);
  return !own || !ip;
};

async function passwordOk(admin: Admin, password: string) {
  const row = await sqlOne<{ password_hash: string }>("select password_hash from shop.admins where id = $1", [admin.id]);
  return Boolean(row && (await verifyPassword(password.slice(0, 200), row.password_hash)));
}

async function freshRecoveryCodes(adminId: string) {
  const codes = newRecoveryCodes(10);
  await sql("update shop.admins set recovery_hashes = $2 where id = $1", [adminId, codes.map((c) => recoveryHash(c, deriveKey("recovery-codes")))]);
  return codes;
}

const securityChanged = async (admin: Admin) => {
  // Every other device has to sign in again, and a reset link already sitting in someone's mailbox stops working.
  await destroyOtherSessions("admin", admin.id, (await cookies()).get(cookieName("admin"))?.value);
  await voidResetLinks(admin.id);
};

/** Step 1: needs the password. Makes a secret and a QR code to scan. Nothing is switched on until a code from the app is confirmed. */
export async function beginTotpSetup(admin: Admin, password: string): Promise<{ error: string } | { secret: string; qr: string }> {
  if (await tooMany(admin)) return { error: "Too many tries. Please wait a few minutes." };
  if (!(await passwordOk(admin, password))) {
    await audit("two_step_setup_refused", { adminId: admin.id, email: admin.email, detail: "wrong password" });
    return { error: "Your password isn't right." };
  }
  const state = await sqlOne<{ totp_enabled: boolean }>("select totp_enabled from shop.admins where id = $1", [admin.id]);
  // Replacing a working authenticator isn't allowed in one step: turn it off first (that needs a code from it).
  if (state?.totp_enabled) return { error: "Two-step sign-in is already on. Turn it off first if you want to set it up again." };
  const secret = newSecret();
  await sql("update shop.admins set totp_pending = $2 where id = $1", [admin.id, seal(secret, deriveKey("totp-secret"))]);
  const qr = await QRCode.toString(otpauthUri(admin.email, secret), { type: "svg", margin: 1, width: 220, errorCorrectionLevel: "M" });
  return { secret, qr };
}

/** Step 2: the owner types the code their app shows. If it matches, two-step sign-in is on and recovery codes are issued. */
export async function confirmTotpSetup(admin: Admin, code: string): Promise<{ error: string } | { codes: string[] }> {
  if (await tooMany(admin)) return { error: "Too many tries. Please wait a few minutes." };
  const row = await sqlOne<{ totp_pending: string | null; totp_enabled: boolean }>("select totp_pending, totp_enabled from shop.admins where id = $1", [admin.id]);
  if (row?.totp_enabled) return { error: "Two-step sign-in is already on." };
  const secret = row?.totp_pending ? unseal(row.totp_pending, deriveKey("totp-secret")) : null;
  if (!secret) return { error: "Start the set-up again to get a fresh QR code." };
  const step = verifyCode(secret, code.trim(), 0);
  if (step === null) return { error: "That code isn't right. Check the code in your app and try again." };
  // Only switches on if it is still off: two requests racing can't swap the secret under each other.
  const done = await sqlOne("update shop.admins set totp_secret = totp_pending, totp_pending = null, totp_enabled = true, totp_last_step = $2 where id = $1 and not totp_enabled and totp_pending is not null returning id", [admin.id, step]);
  if (!done) return { error: "Start the set-up again to get a fresh QR code." };
  const codes = await freshRecoveryCodes(admin.id);
  await securityChanged(admin);
  await audit("two_step_enabled", { adminId: admin.id, email: admin.email });
  return { codes };
}

/** Checks a current authenticator code or an unused recovery code, and uses it up (so it can't be replayed). */
async function secondFactorOk(admin: Admin, code: string): Promise<boolean | "off"> {
  const row = await sqlOne<{ totp_secret: string | null; totp_last_step: string }>("select totp_secret, totp_last_step from shop.admins where id = $1 and totp_enabled", [admin.id]);
  if (!row?.totp_secret) return "off";
  const secret = unseal(row.totp_secret, deriveKey("totp-secret"));
  const step = secret ? verifyCode(secret, code.trim(), Number(row.totp_last_step)) : null;
  const hash = normalizeRecovery(code).length === 12 ? recoveryHash(code, deriveKey("recovery-codes")) : null;
  const okCode = step !== null && Boolean(await sqlOne("update shop.admins set totp_last_step = $2 where id = $1 and totp_last_step < $2 returning id", [admin.id, step]));
  const okRecovery = hash !== null && Boolean(await sqlOne("update shop.admins set recovery_hashes = array_remove(recovery_hashes, $2) where id = $1 and $2 = any(recovery_hashes) returning id", [admin.id, hash]));
  return okCode || okRecovery;
}

export async function disableTotp(admin: Admin, password: string, code: string): Promise<string | null> {
  if (await tooMany(admin)) return "Too many tries. Please wait a few minutes.";
  if (!(await passwordOk(admin, password))) return "Your password isn't right.";
  const ok = await secondFactorOk(admin, code);
  if (ok === "off") return "Two-step sign-in isn't on.";
  if (!ok) return "That code isn't right.";
  await sql("update shop.admins set totp_enabled = false, totp_secret = null, totp_pending = null, recovery_hashes = '{}', totp_last_step = 0 where id = $1", [admin.id]);
  await securityChanged(admin);
  await audit("two_step_disabled", { adminId: admin.id, email: admin.email });
  return null;
}

export async function regenerateRecovery(admin: Admin, password: string, code: string): Promise<{ error: string } | { codes: string[] }> {
  if (await tooMany(admin)) return { error: "Too many tries. Please wait a few minutes." };
  if (!(await passwordOk(admin, password))) return { error: "Your password isn't right." };
  // Fresh recovery codes are a way past the second step, so they need the second step: a stolen session plus the password isn't enough.
  const ok = await secondFactorOk(admin, code);
  if (ok === "off") return { error: "Turn on two-step sign-in first." };
  if (!ok) return { error: "That code isn't right." };
  const codes = await freshRecoveryCodes(admin.id);
  await securityChanged(admin);
  await audit("recovery_codes_regenerated", { adminId: admin.id, email: admin.email });
  return { codes };
}

export type AuditRow = { event: string; detail: string; created_at: string };

/** Changes to the login itself (shown separately so a flood of failed sign-ins can never push them out of sight). */
const SECURITY_EVENTS = [
  "password_changed", "password_reset_completed", "two_step_enabled", "two_step_disabled",
  "recovery_codes_regenerated", "recovery_code_used", "sign_out_everywhere", "login_set_by_script",
];
/** Successful sign-ins and sign-outs, on their own list so failed guesses can never bury them. */
const SIGN_IN_EVENTS = ["sign_in", "sign_out"];

export async function recentActivity(admin: Admin): Promise<{ changes: AuditRow[]; signIns: AuditRow[]; attempts: AuditRow[] }> {
  const q = (where: string, params: unknown[]) =>
    sql<AuditRow>(`select event, detail, created_at from shop.admin_audit where (admin_id = $1 or email = $2) and ${where} order by created_at desc limit 15`, [admin.id, admin.email, ...params]);
  const [changes, signIns, attempts] = await Promise.all([
    q("event = any($3)", [SECURITY_EVENTS]),
    q("event = any($3)", [SIGN_IN_EVENTS]),
    q("not event = any($3) and not event = any($4)", [SECURITY_EVENTS, SIGN_IN_EVENTS]),
  ]);
  return { changes, signIns, attempts };
}

export const securityStatus = (admin: Admin) =>
  sqlOne<{ password_changed_at: string | null; codes_left: number }>("select password_changed_at, coalesce(array_length(recovery_hashes, 1), 0)::int as codes_left from shop.admins where id = $1", [admin.id]);
