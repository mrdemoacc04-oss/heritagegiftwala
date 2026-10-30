import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { WRONG_ADDRESS, adminOrigin, onAdminHost } from "./admin-host";
import { sql, sqlOne } from "./db";
import { esc, sendMail } from "./mail";
import { hashPassword, needsRehash, passwordProblem, verifyAgainstDummy, verifyPassword } from "./password";
import { breachCount } from "./pwned";
import { allow, clearCounters, deriveKey, hashed, hmacHex, ipKey, refund } from "./security";
import { cookieName, cookieOptions, createSession, destroyOtherSessions, destroySession, expiredCookie, readSession } from "./sessions";
import { normalizeRecovery, recoveryHash, unseal, verifyCode } from "./totp";

/**
 * Owner sign-in. The layers, outermost first:
 *   1. ADMIN_ALLOWED_EMAILS: only listed emails can ever sign in (in production an empty list means NO ONE can).
 *   2. Rate limits that are counted BEFORE the slow check (so a burst of parallel guesses can't all slip through),
 *      per visitor and per account, with identical answers and timing for "no such user" and "wrong password".
 *   3. Password, then (compulsory in production) a 6-digit code from an authenticator app or a one-time recovery code.
 *   4. Random server-side sessions: 12 h at most, 4 h idle, at most 5 at once, revocable, new at every sign-in.
 *   5. Temporary passwords expire and must be changed; until then only the change-password page opens.
 * Every sign-in, failure and security change is written to an audit trail the owner can read.
 */

// ── Who may sign in ─────────────────────────────────────────────────────────

const production = () => process.env.NODE_ENV === "production";

function allowedList(): string[] | null {
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim();
  if (!raw) return production() ? [] : null; // production fails closed
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export const isAllowedAdminEmail = (email: string) => {
  const list = allowedList();
  return list === null || list.includes(email.trim().toLowerCase());
};

/**
 * Two-step sign-in is compulsory in production. Only the exact value "false" switches it off, so a typo
 * such as "False " or "0" can never quietly weaken the login. (Outside production it is off unless set.)
 */
export const twoFactorRequired = () => {
  const v = process.env.ADMIN_REQUIRE_2FA?.trim().toLowerCase();
  if (!v) return production();
  return v !== "false";
};

// ── The signed-in admin ─────────────────────────────────────────────────────

export type Admin = {
  id: string;
  email: string;
  totpEnabled: boolean;
  /** What must happen before the panel unlocks, if anything. */
  setupNeeded: null | "password" | "2fa";
};

type SessionRow = { email: string; must_change_password: boolean; totp_enabled: boolean };

/** The signed-in shop owner for this request, or null. Cached for the duration of one request. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  // The panel only exists on its own address once ADMIN_HOST is set: a session is never honoured anywhere else.
  if (!(await onAdminHost())) return null;
  const token = (await cookies()).get(cookieName("admin"))?.value;
  const row = await readSession<SessionRow>("admin", token, "u.email, u.must_change_password, u.totp_enabled");
  if (!row || !isAllowedAdminEmail(row.email)) return null;
  return {
    id: row.id,
    email: row.email,
    totpEnabled: row.totp_enabled,
    setupNeeded: row.must_change_password ? "password" : twoFactorRequired() && !row.totp_enabled ? "2fa" : null,
  };
});

/**
 * Every admin page and every admin action calls this itself. Layouts alone are not enough, because
 * they do not re-run on every navigation and server actions can be called directly.
 *
 * While set-up is pending only the named steps are allowed: `during: ["password"]` lets that one action run while a
 * temporary password is still in use, `during: ["2fa"]` while two-step set-up is pending. Everything else redirects.
 * (So a temporary password can change the password and nothing more: it can't enrol an authenticator, say.)
 */
export async function requireAdmin(opts: { during?: ("password" | "2fa")[] } = {}): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (admin.setupNeeded && !opts.during?.includes(admin.setupNeeded)) redirect("/admin/account");
  return admin;
}

// ── Audit trail and alerts ──────────────────────────────────────────────────

export async function audit(event: string, who: { adminId?: string | null; email?: string; detail?: string } = {}) {
  try {
    const h = await headers();
    await sql("insert into shop.admin_audit (admin_id, email, event, detail, ip_hash) values ($1, $2, $3, $4, $5)", [
      who.adminId ?? null,
      (who.email ?? "").slice(0, 254),
      event,
      (who.detail ?? "").slice(0, 300),
      ipKey(h),
    ]);
  } catch (e) {
    console.error("[audit]", e instanceof Error ? e.message : e);
  }
}

/** Writes a noisy event at most once per visitor per window, so it can't be used to flood the trail. */
async function auditOncePer(window: number, event: string, who: { adminId?: string | null; email?: string; detail?: string }) {
  const ip = ipKey(await headers());
  if (await allow(`audit-once:${event}:${ip}`, 1, window)) await audit(event, who);
}

async function notifyOwner(email: string, subject: string, lines: string[]) {
  await sendMail({
    to: email,
    subject,
    text: lines.join("\n"),
    html: lines.map((l) => `<p>${esc(l)}</p>`).join(""),
  });
}

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

/** Any reset link that is still open stops working (used whenever the password or two-step settings change). */
export const voidResetLinks = (adminId: string) => sql("update shop.password_resets set used_at = now() where admin_id = $1 and used_at is null", [adminId]);

// ── Sign in ─────────────────────────────────────────────────────────────────

const WRONG = "That email and password don't match.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PENDING_NAME = () => `${production() ? "__Host-" : ""}hgw_admin_2fa`;
const PENDING_SECONDS = 300;

/** "enter your code" cookie: admin id, expiry and a one-off nonce, signed so it can't be forged or edited. */
function signPending(adminId: string) {
  const exp = Math.floor(Date.now() / 1000) + PENDING_SECONDS;
  const nonce = randomBytes(12).toString("base64url");
  return `${adminId}.${exp}.${nonce}.${hmacHex(`2fa:${adminId}.${exp}.${nonce}`)}`;
}

function readPending(raw: string | undefined): { adminId: string; nonce: string } | null {
  const [id, exp, nonce, sig] = (raw ?? "").split(".");
  if (!id || !exp || !nonce || !sig || !/^[0-9a-f-]{36}$/.test(id) || Number(exp) < Date.now() / 1000) return null;
  const want = Buffer.from(hmacHex(`2fa:${id}.${exp}.${nonce}`));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? { adminId: id, nonce } : null;
}

/**
 * "Known device" cookie, set only after a COMPLETE sign-in (password and code). It can't be forged or copied to another
 * account. It does two things: the owner's own browser isn't caught by the per-account guess ceiling when someone else is
 * hammering the owner's email (so a stranger can't lock the owner out), and a sign-in from a browser without it is
 * emailed to the owner as a new device.
 */
const DEVICE_NAME = () => `${production() ? "__Host-" : ""}hgw_admin_dev`;
const DEVICE_DAYS = 90;

function signDevice(adminId: string) {
  const exp = Math.floor(Date.now() / 1000) + DEVICE_DAYS * 86400;
  return `${adminId}.${exp}.${hmacHex(`device:${adminId}.${exp}`)}`;
}

async function knownDevice(adminId: string): Promise<boolean> {
  const [id, exp, sig] = ((await cookies()).get(DEVICE_NAME())?.value ?? "").split(".");
  if (id !== adminId || !exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const want = Buffer.from(hmacHex(`device:${id}.${exp}`));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

async function startSession(adminId: string, email: string) {
  const jar = await cookies();
  const known = await knownDevice(adminId);
  jar.set(cookieName("admin"), await createSession("admin", adminId), cookieOptions("admin"));
  jar.set(PENDING_NAME(), "", expiredCookie("admin"));
  jar.set(DEVICE_NAME(), signDevice(adminId), { ...cookieOptions("admin"), maxAge: DEVICE_DAYS * 86400 });
  await audit("sign_in", { adminId, email, detail: known ? "" : "new device" });
  if (!known) {
    after(() => notifyOwner(email, "New sign-in to your shop control panel", ["Your Heritage Gift Wala control panel was just signed in to from a browser it hasn't seen before.", "If that was you, nothing to do. If not, change your password and use “Sign out everywhere” on the My login page."]));
  }
}

type LoginRow = { id: string; password_hash: string; totp_enabled: boolean; temp_expired: boolean };

export async function adminLogin(emailRaw: string, password: string): Promise<{ error: string } | { next: "panel" | "verify" }> {
  if (!(await onAdminHost())) return { error: WRONG_ADDRESS() };
  const h = await headers();
  const email = emailRaw.trim().toLowerCase().slice(0, 254);
  const ip = ipKey(h);

  if (password.length > 200 || email.length < 3) {
    await verifyAgainstDummy(password.slice(0, 200));
    await allow(`admin-login:ip:${ip}`, 12, 15 * 60);
    return { error: WRONG };
  }
  // A quick indexed lookup (the same one whatever the email is) comes first, so the owner's own known browser can be recognised.
  const found = await sqlOne<LoginRow>(
    "select id, password_hash, totp_enabled, (must_change_password and temp_password_expires_at is not null and temp_password_expires_at < now()) as temp_expired from shop.admins where email = $1 and not disabled",
    [email],
  );
  const allowed = isAllowedAdminEmail(email);
  const row = allowed ? found : null;
  const trusted = row ? await knownDevice(row.id) : false;

  // Count this attempt BEFORE the slow check (atomically), and only give it back if the sign-in turns out to be genuine.
  // Per visitor and email: 6 per 15 minutes. Per visitor: 12. And a ceiling per account whatever address the guesses
  // come from: 60 per hour, so rotating addresses can't give unlimited guesses. The owner's own known browser isn't held
  // to that last ceiling, so a stranger hammering the owner's email can't lock the owner out of their own computer.
  const ipLimit = `admin-login:ip:${ip}`;
  const acctLimit = `admin-login:acct:${ip}:${hashed(email)}`;
  const globalLimit = `admin-login:global:${hashed(email)}`;
  const within = [await allow(ipLimit, 12, 15 * 60), await allow(acctLimit, 6, 15 * 60), trusted ? true : await allow(globalLimit, 60, 3600)];
  if (within.includes(false)) {
    await auditOncePer(15 * 60, "sign_in_throttled", { email });
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const ok = row ? await verifyPassword(password, row.password_hash) : (await verifyAgainstDummy(password), false);

  if (!row || !ok || row.temp_expired) {
    await sleep(250 + Math.floor(Math.random() * 250));
    const why = !allowed ? "sign_in_blocked_not_allowed" : row && ok && row.temp_expired ? "sign_in_temp_password_expired" : "sign_in_failed";
    // Guesses at the owner's real account are each recorded (they are limited); noise aimed at made-up emails is recorded once per window.
    if (row) await audit(why, { adminId: row.id, email });
    else await auditOncePer(3600, why, { email });
    if (row) after(() => alertOnRepeatedFailures(email));
    return { error: WRONG };
  }

  await refund(ipLimit, acctLimit, ...(trusted ? [] : [globalLimit]));
  if (needsRehash(row.password_hash)) await sql("update shop.admins set password_hash = $2 where id = $1", [row.id, await hashPassword(password)]);
  if (row.totp_enabled) {
    (await cookies()).set(PENDING_NAME(), signPending(row.id), { ...cookieOptions("admin"), maxAge: PENDING_SECONDS });
    await audit("password_ok_waiting_for_code", { adminId: row.id, email });
    return { next: "verify" };
  }
  await startSession(row.id, email);
  return { next: "panel" };
}

/** Tells the owner when someone keeps guessing their password, at most once an hour. Runs after the reply is sent. */
async function alertOnRepeatedFailures(email: string) {
  const withinLimit = await allow(`admin-fails:${hashed(email)}`, 7, 3600);
  if (!withinLimit && (await allow(`admin-fails-alert:${hashed(email)}`, 1, 3600))) {
    await notifyOwner(email, "Someone is trying to guess your shop password", [
      "There have been several failed sign-in attempts on your Heritage Gift Wala control panel in the last hour.",
      "If that wasn't you, nothing is wrong: they were turned away. Consider changing your password and keeping two-step sign-in on.",
    ]);
  }
}

/** The second step: a 6-digit app code, or one of the one-time recovery codes. */
export async function adminVerifySecondStep(codeRaw: string): Promise<{ error: string } | { ok: true }> {
  if (!(await onAdminHost())) return { error: WRONG_ADDRESS() };
  const h = await headers();
  const jar = await cookies();
  const pending = readPending(jar.get(PENDING_NAME())?.value);
  if (!pending) return { error: "That sign-in has timed out. Please start again." };
  const { adminId, nonce } = pending;
  const ip = ipKey(h);

  // Counted first, like the password step. A given "enter your code" cookie gets 5 tries; a visitor 10 per 15 minutes;
  // an account 15 per hour, whatever address the guesses come from.
  const keys = [`admin-2fa:nonce:${nonce}`, `admin-2fa:ip:${ip}`, `admin-2fa:acct:${adminId}`];
  const within = [await allow(keys[0], 5, 15 * 60), await allow(keys[1], 10, 15 * 60), await allow(keys[2], 15, 3600)];
  if (within.includes(false)) {
    await auditOncePer(15 * 60, "code_throttled", { adminId });
    jar.set(PENDING_NAME(), "", expiredCookie("admin"));
    return { error: "Too many attempts. Please wait a few minutes and start again." };
  }

  const row = await sqlOne<{ id: string; email: string; totp_secret: string | null; totp_last_step: string }>("select id, email, totp_secret, totp_last_step from shop.admins where id = $1 and not disabled and totp_enabled", [adminId]);
  if (!row || !row.totp_secret || !isAllowedAdminEmail(row.email)) return { error: "That sign-in has timed out. Please start again." };

  const code = codeRaw.trim();
  let good = false;
  if (/^\d{6}$/.test(code)) {
    const secret = unseal(row.totp_secret, deriveKey("totp-secret"));
    const step = secret ? verifyCode(secret, code, Number(row.totp_last_step)) : null;
    // The conditional update means a code can be used once, even if two requests race with it.
    if (step !== null && (await sqlOne("update shop.admins set totp_last_step = $2 where id = $1 and totp_last_step < $2 returning id", [row.id, step]))) good = true;
  } else if (normalizeRecovery(code).length === 12) {
    const hash = recoveryHash(code, deriveKey("recovery-codes"));
    if (await sqlOne("update shop.admins set recovery_hashes = array_remove(recovery_hashes, $2) where id = $1 and $2 = any(recovery_hashes) returning id", [row.id, hash])) {
      good = true;
      await audit("recovery_code_used", { adminId: row.id, email: row.email });
      after(() => notifyOwner(row.email, "A recovery code was used to sign in", ["One of your one-time recovery codes was just used to sign in to the control panel. If that wasn't you, change your password now."]));
    }
  }
  if (!good) {
    await sleep(250 + Math.floor(Math.random() * 250));
    await audit("code_failed", { adminId: row.id, email: row.email });
    return { error: "That code isn't right. Check the code in your app and try again." };
  }
  await refund(...keys);
  await startSession(row.id, row.email);
  return { ok: true };
}

export async function adminLogout() {
  const jar = await cookies();
  const token = jar.get(cookieName("admin"))?.value;
  if (token) {
    const who = await getAdmin();
    await destroySession("admin", token);
    if (who) await audit("sign_out", { adminId: who.id, email: who.email });
  }
  jar.set(cookieName("admin"), "", expiredCookie("admin"));
  jar.set(PENDING_NAME(), "", expiredCookie("admin"));
}

export async function signOutEverywhere(admin: Admin) {
  await destroyOtherSessions("admin", admin.id);
  await voidResetLinks(admin.id);
  (await cookies()).set(cookieName("admin"), "", expiredCookie("admin"));
  await audit("sign_out_everywhere", { adminId: admin.id, email: admin.email });
}

// ── Passwords ───────────────────────────────────────────────────────────────

const SHOP_WORDS = ["heritage", "giftwala", "gift wala", "patan", "password"];

/** A message if the new password isn't good enough: length, common words, the shop's name, known breaches. */
export async function newPasswordProblem(password: string, email: string): Promise<string | null> {
  const local = email.split("@")[0] ?? "";
  const weak = passwordProblem(password, 12, [...SHOP_WORDS, local]);
  if (weak) return weak;
  const seen = await breachCount(password);
  if (seen > 0) return "That password has appeared in known data breaches. Please choose a different one.";
  return null;
}

export async function changeAdminPassword(admin: Admin, current: string, next: string): Promise<string | null> {
  const ip = ipKey(await headers());
  if (!(await allow(`admin-pw:${admin.id}`, 8, 15 * 60)) || !(await allow(`admin-pw-ip:${ip}`, 20, 15 * 60))) return "Too many tries. Please wait a few minutes.";
  const row = await sqlOne<{ password_hash: string }>("select password_hash from shop.admins where id = $1", [admin.id]);
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    await audit("password_change_failed", { adminId: admin.id, email: admin.email });
    return "Your current password isn't right.";
  }
  if (current === next) return "Pick a password different from the current one.";
  const problem = await newPasswordProblem(next, admin.email);
  if (problem) return problem;
  await sql("update shop.admins set password_hash = $2, must_change_password = false, temp_password_expires_at = null, password_changed_at = now() where id = $1", [admin.id, await hashPassword(next)]);
  // Sign out every other device, keep this one, and cancel any reset link that is still open.
  await destroyOtherSessions("admin", admin.id, (await cookies()).get(cookieName("admin"))?.value);
  await voidResetLinks(admin.id);
  await audit("password_changed", { adminId: admin.id, email: admin.email });
  after(() => notifyOwner(admin.email, "Your shop control-panel password was changed", ["Your Heritage Gift Wala control-panel password was just changed and all other devices were signed out.", "If that wasn't you, use “Forgot password” on the sign-in page straight away."]));
  return null;
}

// ── Forgotten password ──────────────────────────────────────────────────────

const RESET_MINUTES = 30;

/**
 * Emails a one-time reset link to the owner. Whatever the answer, the visitor sees the same message, so
 * the form can't be used to find out which emails belong to the shop. The work happens after the reply
 * is sent, so the response time doesn't give it away either.
 */
export async function createPasswordReset(emailRaw: string): Promise<void> {
  if (!(await onAdminHost())) return;
  const email = emailRaw.trim().toLowerCase().slice(0, 254);
  const ip = ipKey(await headers());
  // 5 requests per visitor an hour. There is deliberately NO per-email cap: a stranger who knows the owner's email could
  // use one up and shut the owner out. Instead, a request made while a fresh link (under 10 minutes old) is already in the
  // inbox sends nothing new, so the owner always has a valid link and the mailbox can't be flooded (at most 6 mails an hour).
  if (!(await allow(`admin-reset:ip:${ip}`, 5, 3600))) return;
  if (!isAllowedAdminEmail(email)) {
    await auditOncePer(3600, "reset_requested_not_allowed", { email });
    return;
  }
  const row = await sqlOne<{ id: string }>("select id from shop.admins where email = $1 and not disabled", [email]);
  if (!row) return;
  if (await sqlOne("select 1 from shop.password_resets where admin_id = $1 and used_at is null and created_at > now() - interval '10 minutes'", [row.id])) return;
  const token = randomBytes(32).toString("base64url");
  await sql("insert into shop.password_resets (token_hash, admin_id, expires_at) values ($1, $2, now() + make_interval(mins => $3))", [sha(token), row.id, RESET_MINUTES]);
  await audit("reset_requested", { adminId: row.id, email });
  const link = `${adminOrigin()}/admin/reset?token=${token}`;
  await sendMail({
    to: email,
    subject: "Reset your shop control-panel password",
    text: `Someone asked to reset the password for your Heritage Gift Wala control panel.\n\nOpen this link within ${RESET_MINUTES} minutes (it works once):\n${link}\n\nIf you didn't ask for this, ignore this email. Your password has not changed.`,
    html: `<p>Someone asked to reset the password for your Heritage Gift Wala control panel.</p><p><a href="${esc(link)}">Choose a new password</a><br>This link works once and expires in ${RESET_MINUTES} minutes.</p><p>If you didn't ask for this, ignore this email. Your password has not changed.</p>`,
  });
}

export async function resetTokenValid(token: string): Promise<boolean> {
  if (!(await onAdminHost())) return false;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  return Boolean(await sqlOne("select 1 from shop.password_resets where token_hash = $1 and used_at is null and expires_at > now()", [sha(token)]));
}

export async function completePasswordReset(token: string, password: string): Promise<string | null> {
  if (!(await onAdminHost())) return WRONG_ADDRESS();
  const ip = ipKey(await headers());
  if (!(await allow(`admin-reset-use:${ip}`, 10, 3600))) return "Too many tries. Please wait a while.";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return "This link isn't valid any more. Ask for a new one.";
  const peek = await sqlOne<{ email: string }>(
    "select a.email from shop.password_resets r join shop.admins a on a.id = r.admin_id where r.token_hash = $1 and r.used_at is null and r.expires_at > now() and not a.disabled",
    [sha(token)],
  );
  if (!peek || !isAllowedAdminEmail(peek.email)) return "This link isn't valid any more. Ask for a new one.";
  const problem = await newPasswordProblem(password, peek.email);
  if (problem) return problem;
  const hash = await hashPassword(password);
  // Claim the link first, atomically: a second request with the same link finds it already used.
  const claimed = await sqlOne<{ admin_id: string }>("update shop.password_resets set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning admin_id", [sha(token)]);
  if (!claimed) return "This link isn't valid any more. Ask for a new one.";
  await sql("update shop.admins set password_hash = $2, must_change_password = false, temp_password_expires_at = null, password_changed_at = now() where id = $1", [claimed.admin_id, hash]);
  await voidResetLinks(claimed.admin_id);
  await sql("delete from shop.admin_sessions where admin_id = $1", [claimed.admin_id]);
  // Proving control of the mailbox is a legitimate unlock: sign-in allowances for this account start fresh.
  await clearCounters(`admin-login:global:${hashed(peek.email)}`, `admin-fails:${hashed(peek.email)}`, `admin-2fa:acct:${claimed.admin_id}`);
  await audit("password_reset_completed", { adminId: claimed.admin_id, email: peek.email });
  after(() => notifyOwner(peek.email, "Your shop control-panel password was reset", ["Your Heritage Gift Wala control-panel password was just reset and every device was signed out.", "If that wasn't you, contact the person who set up the site immediately."]));
  return null;
}
