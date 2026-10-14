import "server-only";
import { createHmac } from "node:crypto";
import { sqlOne } from "./db";

function appSecret() {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET must be set (32+ random characters).");
  return "development-only-secret-development-only-secret";
}

/** Vercel overwrites these headers with the real client address, so they can be trusted there. */
export function clientIp(h: Headers): string {
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** A keyed hash, so the database never stores a visitor's real address. */
export const hashed = (value: string) => createHmac("sha256", appSecret()).update(value).digest("hex").slice(0, 32);

export const ipKey = (h: Headers) => hashed(`ip:${clientIp(h)}`);

/** True while within `max` hits per `windowSeconds` for this key. */
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const row = await sqlOne<{ ok: boolean }>("select shop.rate_limit($1, $2, $3) as ok", [key, max, windowSeconds]);
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
