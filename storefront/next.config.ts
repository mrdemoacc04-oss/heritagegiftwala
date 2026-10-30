import path from "node:path";
import type { NextConfig } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://heritagegiftwala.in";
const supabase = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL) : null;
const storagePattern = supabase
  ? { protocol: supabase.protocol.replace(":", "") as "http" | "https", hostname: supabase.hostname, ...(supabase.port ? { port: supabase.port } : {}) }
  : { protocol: "https" as const, hostname: "*.supabase.co" };

/**
 * The owner's control panel gets its own address (for example admin.heritagegiftwala.in) once ADMIN_HOST is set.
 * Matching is done on the host name alone (no port, any capitals), exactly as Next.js does it.
 * Next.js reads these rules when the site is built, so changing ADMIN_HOST needs a redeploy.
 */
const hostOnly = (h: string) => h.split(":")[0];
const wantedAdminHost = (process.env.ADMIN_HOST ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
// An ADMIN_HOST that is the shop's own address would hide the whole shop, so it is ignored (the panel stays at /admin).
const sameAsShop = wantedAdminHost !== "" && hostOnly(wantedAdminHost) === hostOnly(new URL(siteUrl).host.toLowerCase());
if (sameAsShop) console.warn("ADMIN_HOST is the shop's own address, so it was ignored. Use a different address such as admin.example.com.");
const adminHost = sameAsShop ? "" : wantedAdminHost;
const adminOrigin = `${process.env.NODE_ENV === "production" ? "https" : "http"}://${adminHost}`;
const onAdminHost = [{ type: "host" as const, value: hostOnly(adminHost).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Locks down framing, plugins and where forms may post. Scripts and styles stay open because Next.js inlines its own.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  // The home folder has its own lockfile; keep Turbopack rooted here.
  turbopack: { root: path.join(__dirname) },
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Product photos uploaded from the admin panel are served from Supabase Storage.
    remotePatterns: [
      new URL("/**", siteUrl),
      storagePattern,
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Nothing on the control panel's address belongs in a search engine.
      ...(adminHost ? [{ source: "/:path*", has: onAdminHost, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }] : []),
    ];
  },
  async redirects() {
    if (!adminHost) return [];
    return [
      // The shop's own address no longer has a control panel: old /admin links lead to the new address.
      { source: "/admin/:path*", missing: onAdminHost, destination: `${adminOrigin}/admin/:path*`, permanent: false },
      // Typing the bare address opens the panel (which sends signed-out visitors to the sign-in page).
      { source: "/", has: onAdminHost, destination: "/admin", permanent: false },
    ];
  },
  async rewrites() {
    if (!adminHost) return [];
    // The control panel's address serves the control panel and nothing else: every shop page is a 404 there.
    // (Picture files are let through: the product photos the panel shows are files in /products.)
    return {
      beforeFiles: [
        {
          source: "/:path((?!admin$|admin/|api/admin/|api/health$|_next/|icon\\.png$|apple-icon\\.png$|favicon\\.ico$|products/.*\\.png$|products/.*\\.jpg$|brand/.*\\.png$|brand/.*\\.jpg$|shop/.*\\.jpg$).*)",
          has: onAdminHost,
          destination: "/not-found-on-the-control-panel-address",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
