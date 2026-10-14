import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sqlOne } from "./db";
import { hashPassword, passwordProblem, verifyAgainstDummy, verifyPassword } from "./password";
import { allow, hashed, ipKey } from "./security";
import { cookieName, cookieOptions, createSession, destroyOtherSessions, destroySession, readSession } from "./sessions";

export type Admin = { id: string; email: string };

/** The signed-in shop owner for this request, or null. Cached for the duration of one request. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(cookieName("admin"))?.value;
  return readSession<{ email: string }>("admin", token, "u.email");
});

/**
 * Every admin page and every admin action calls this itself. Layouts alone are not enough, because
 * they do not re-run on every navigation and server actions can be called directly.
 */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

const WRONG = "That email and password don't match.";

export async function adminLogin(emailRaw: string, password: string): Promise<{ error: string } | { ok: true }> {
  const h = await headers();
  const email = emailRaw.trim().toLowerCase().slice(0, 254);
  const ip = ipKey(h);
  // Per-visitor limits: a stranger cannot lock the owner out, only slow themselves down.
  if (!(await allow(`admin-login:ip:${ip}`, 12, 15 * 60)) || !(await allow(`admin-login:acct:${ip}:${hashed(email)}`, 6, 15 * 60))) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }
  if (password.length > 200 || email.length < 3) {
    await verifyAgainstDummy(password.slice(0, 200));
    return { error: WRONG };
  }
  const row = await sqlOne<{ id: string; password_hash: string }>("select id, password_hash from shop.admins where email = $1 and not disabled", [email]);
  const ok = row ? await verifyPassword(password, row.password_hash) : (await verifyAgainstDummy(password), false);
  if (!row || !ok) return { error: WRONG };

  const token = await createSession("admin", row.id);
  (await cookies()).set(cookieName("admin"), token, cookieOptions("admin"));
  return { ok: true };
}

export async function adminLogout() {
  const jar = await cookies();
  const token = jar.get(cookieName("admin"))?.value;
  if (token) await destroySession("admin", token);
  jar.delete(cookieName("admin"));
}

export async function changeAdminPassword(admin: Admin, current: string, next: string): Promise<string | null> {
  const row = await sqlOne<{ password_hash: string }>("select password_hash from shop.admins where id = $1", [admin.id]);
  if (!row || !(await verifyPassword(current, row.password_hash))) return "Your current password isn't right.";
  const problem = passwordProblem(next, 12);
  if (problem) return problem;
  await sqlOne("update shop.admins set password_hash = $2 where id = $1", [admin.id, await hashPassword(next)]);
  // Sign out every other device, keep this one.
  await destroyOtherSessions("admin", admin.id, (await cookies()).get(cookieName("admin"))?.value);
  return null;
}
