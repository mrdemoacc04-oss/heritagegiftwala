import "server-only";
import { headers } from "next/headers";

/**
 * Where the owner's control panel lives. With ADMIN_HOST set (for example "admin.heritagegiftwala.in") the panel is
 * served only on that address and the shop's own address no longer has an /admin. Without it the panel stays at /admin
 * on whatever address the site is on (local work, preview deployments).
 *
 * next.config.ts applies the same setting to redirect and hide pages before they render. The checks here are a second lock:
 * even if a request got past those rules, nobody can sign in, or stay signed in, on any other address.
 */
const hostOnly = (h: string) => h.split(",")[0].trim().toLowerCase().split(":")[0];

export const adminHost = () => {
  const want = (process.env.ADMIN_HOST ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  // The shop's own address would hide the whole shop (next.config.ts ignores it too), so it counts as "not set".
  const shop = process.env.NEXT_PUBLIC_SITE_URL ? hostOnly(new URL(process.env.NEXT_PUBLIC_SITE_URL).host) : "";
  return want && hostOnly(want) === shop ? "" : want;
};

/** The control panel's address, for links in emails. */
export function adminOrigin(): string {
  const host = adminHost();
  if (host) return `${process.env.NODE_ENV === "production" ? "https" : "http"}://${host}`;
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

/** True when this request arrived on the control panel's address (always true while no separate address is set). */
export async function onAdminHost(): Promise<boolean> {
  const want = adminHost();
  if (!want) return true;
  const h = await headers();
  // Same comparison the routing rules make: the host name alone, in lower case (the port and any proxy list are ignored).
  return hostOnly(h.get("host") ?? h.get("x-forwarded-host") ?? "") === hostOnly(want);
}

export const WRONG_ADDRESS = () => `Please sign in at ${adminHost() || "the control panel's own address"}.`;
