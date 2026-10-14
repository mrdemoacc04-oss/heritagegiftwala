import "server-only";
import { createHmac, hkdfSync } from "node:crypto";
import { isIPv6 } from "node:net";
import { sqlOne } from "./db";

function rootSecret() {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set (32+ random characters).");
  return "development-only-secret-development-only-secret";
}

/**
 * One independent key per purpose, all derived from APP_SECRET. A value signed or hashed for one purpose
 * (a visitor's address, the "enter your code" cookie, recovery codes, the two-step secret) can never be
 * mistaken for another.
 */
export const deriveKey = (purpose: string): string => Buffer.from(hkdfSync("sha256", rootSecret(), "heritagegiftwala", `key:${purpose}`, 32)).toString("hex");

/** Full-length keyed hash, used to sign short-lived values such as the "enter your code" step. */
export const hmacHex = (value: string) => createHmac("sha256", deriveKey("signed-values")).update(value).digest("hex");

/** A keyed hash, so the database never stores a visitor's real address or email. */
export const hashed = (value: string) => createHmac("sha256", deriveKey("hashed-identifiers")).update(value).digest("hex").slice(0, 32);

/** Expands "2001:db8::1" to its eight 16-bit groups. */
function expandIPv6(ip: string): string[] {
  const [head, tail = ""] = ip.split("::");
  const a = head ? head.split(":") : [];
  const b = tail ? tail.split(":") : [];
  return ip.includes("::") ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b] : a;
}

/**
 * Vercel overwrites these headers with the real client address, so they can be trusted there.
 * An IPv6 visitor is identified by their /64 (the first four groups): one device can hold billions of addresses
 * inside it, and counting each separately would make every per-visitor limit meaningless.
 */
export function rawIp(h: Headers): string {
  const raw = (h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").replace(/^\[|\]$/g, "").split("%")[0];
  // "::ffff:203.0.113.7" is just the IPv4 address 203.0.113.7 written another way.
  return /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(raw)?.[1] ?? raw;
}

export function clientIp(h: Headers): string {
  const raw = rawIp(h);
  if (isIPv6(raw)) return `${expandIPv6(raw).slice(0, 4).map((g) => g.toLowerCase().padStart(4, "0")).join(":")}::/64`;
  return raw;
}

export const ipKey = (h: Headers) => hashed(`ip:${clientIp(h)}`);

/** The same mailbox written differently ("a.b+x@gmail.com") is one mailbox. Mirrors shop.normalize_email in SQL. */
export function normalizeEmail(email: string): string {
  const l = email.trim().toLowerCase();
  const [local = "", domain = ""] = [l.slice(0, l.lastIndexOf("@")), l.slice(l.lastIndexOf("@") + 1)];
  let loc = local.replace(/\+.*$/, "");
  let dom = domain;
  if (dom === "gmail.com" || dom === "googlemail.com") {
    loc = loc.replace(/\./g, "");
    dom = "gmail.com";
  }
  return `${loc}@${dom}`;
}

/**
 * Counts one hit and says whether the caller is still within `max` per `windowSeconds`.
 * Call it BEFORE the slow or sensitive work: counting first is what stops a burst of parallel requests from all
 * slipping through before any of them has been counted. Use `refund` when the work succeeds and shouldn't count.
 */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const row = await sqlOne<{ ok: boolean }>("select shop.rate_limit($1, $2, $3) as ok", [key, max, windowSeconds]);
  return row?.ok === true;
}

/** Gives one counted hit back (for example, a successful sign-in doesn't use up the failed-attempt allowance). */
export const refund = async (...keys: string[]) => {
  await Promise.all(keys.map((k) => sqlOne("select shop.rate_limit_refund($1)", [k])));
};

/** Wipes counters whose key starts with any of the prefixes (for example after a password reset by emailed link). */
export const clearCounters = async (...prefixes: string[]) => {
  await Promise.all(prefixes.map((p) => sqlOne("select shop.rate_limit_clear($1)", [p])));
};

/** True while this key still has allowance left. It only looks; it never counts. */
export async function underLimit(key: string, max: number): Promise<boolean> {
  const row = await sqlOne<{ ok: boolean }>("select shop.rate_limit_check($1, $2) as ok", [key, max]);
  return row?.ok === true;
}

/**
 * Browsers always send an Origin header on cross-site POSTs. Requiring it to match our own host
 * stops other websites from making a signed-in visitor's browser act on this site.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const isJson = (req: Request) => (req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** Parses a small JSON body, refusing anything oversized or malformed. */
export async function readJson(req: Request, maxBytes = 32_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "That request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "That request couldn't be read.");
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps a route handler so unexpected errors become a generic message, never a stack trace. */
export function guard(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ message: e.message }, e.status);
      console.error("[api]", e instanceof Error ? e.message : e);
      return json({ message: "Something went wrong on our side. Please try again." }, 500);
    }
  };
}

/** Standard gate for public JSON endpoints that change something. */
export function requirePost(req: Request) {
  if (!sameOrigin(req)) throw new HttpError(403, "That request wasn't allowed.");
  if (!isJson(req)) throw new HttpError(415, "That request couldn't be read.");
}
