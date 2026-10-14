import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sql, sqlOne } from "./db";

/**
 * Opaque, server-side sessions. The browser holds a random token; the database holds only its
 * SHA-256. Sessions can be revoked at any time, expire on their own, and a leaked database
 * cannot be turned back into working logins.
 */
export type Kind = "admin" | "customer";

const TABLES = {
  admin: { sessions: "shop.admin_sessions", users: "shop.admins", fk: "admin_id", absolute: 12 * 3600, idle: 4 * 3600, max: 5 },
  customer: { sessions: "shop.customer_sessions", users: "shop.customers", fk: "customer_id", absolute: 30 * 86400, idle: 14 * 86400, max: 10 },
} as const;

const sha = (token: string) => createHash("sha256").update(token).digest("hex");

export const cookieName = (kind: Kind) => `${process.env.NODE_ENV === "production" ? "__Host-" : ""}hgw_${kind}`;

export function cookieOptions(kind: Kind) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Admin pages are never reached from other sites, so the strictest setting is safe there.
    sameSite: (kind === "admin" ? "strict" : "lax") as "strict" | "lax",
    path: "/",
    maxAge: TABLES[kind].absolute,
  };
}

export async function createSession(kind: Kind, userId: string): Promise<string> {
  const t = TABLES[kind];
  const token = randomBytes(32).toString("base64url");
  await sql(`insert into ${t.sessions} (token_hash, ${t.fk}, expires_at) values ($1, $2, now() + make_interval(secs => $3))`, [sha(token), userId, t.absolute]);
  // Keep only the newest few sessions per person, so signing in over and over can't pile up rows.
  await sql(
    `delete from ${t.sessions} where ${t.fk} = $1 and token_hash not in (select token_hash from ${t.sessions} where ${t.fk} = $1 order by created_at desc limit $2)`,
    [userId, t.max],
  );
  return token;
}

/** The signed-in user for a token, or null. Expired and idle sessions are rejected. */
export async function readSession<U>(kind: Kind, token: string | undefined, columns: string): Promise<(U & { id: string }) | null> {
  if (!token || token.length < 32 || token.length > 128) return null;
  const t = TABLES[kind];
  const row = await sqlOne<U & { id: string; stale: boolean }>(
    `select u.id, ${columns}, (s.last_seen < now() - interval '5 minutes') as stale
       from ${t.sessions} s join ${t.users} u on u.id = s.${t.fk}
      where s.token_hash = $1 and s.expires_at > now() and s.last_seen > now() - make_interval(secs => $2)
        ${kind === "admin" ? "and not u.disabled" : ""}`,
    [sha(token), t.idle],
  );
  if (!row) return null;
  if (row.stale) await sql(`update ${t.sessions} set last_seen = now() where token_hash = $1`, [sha(token)]);
  return row;
}

export const destroySession = (kind: Kind, token: string) => sql(`delete from ${TABLES[kind].sessions} where token_hash = $1`, [sha(token)]);

/** Signs a user out everywhere, optionally keeping the session they are using right now. */
export const destroyOtherSessions = (kind: Kind, userId: string, keepToken?: string) =>
  sql(`delete from ${TABLES[kind].sessions} where ${TABLES[kind].fk} = $1 and ($2::text is null or token_hash <> $2)`, [userId, keepToken ? sha(keepToken) : null]);

/**
 * Removes a cookie. "__Host-" cookies can only be changed by a response that carries the same Secure/Path rules they
 * were set with, so a plain delete is ignored by browsers; an immediately-expired cookie with the same options isn't.
 */
export const expiredCookie = (kind: Kind) => ({ ...cookieOptions(kind), maxAge: 0, expires: new Date(0) });
