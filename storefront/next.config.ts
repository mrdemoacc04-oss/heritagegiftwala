import path from "node:path";
import type { NextConfig } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://heritagegiftwala.in";
const supabase = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL) : null;
const storagePattern = supabase
  ? { protocol: supabase.protocol.replace(":", "") as "http" | "https", hostname: supabase.hostname, ...(supabase.port ? { port: supabase.port } : {}) }
  : { protocol: "https" as const, hostname: "*.supabase.co" };

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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
