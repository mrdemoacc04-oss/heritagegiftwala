import { NextResponse, type NextRequest } from "next/server";

const ADMIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-hgw_admin" : "hgw_admin";
// Pages a signed-out owner has to reach.
const OPEN = new Set(["/admin/login", "/admin/login/verify", "/admin/forgot", "/admin/reset"]);

/**
 * A quick first gate: visitors with no admin cookie never reach an admin page. This is only a
 * convenience. The real check (does the cookie belong to a live session?) happens on every admin
 * page and every admin action, and it is the one that counts.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && !OPEN.has(pathname.replace(/\/+$/, "")) && !req.cookies.has(ADMIN_COOKIE)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/admin/:path*", "/api/:path*"] };
