import path from "node:path";
import type { NextConfig } from "next";

const medusaUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL;

const nextConfig: NextConfig = {
  // The home folder has its own lockfile; keep Turbopack rooted here.
  turbopack: { root: path.join(__dirname) },
  images: {
    formats: ["image/avif", "image/webp"],
    // Product images uploaded through Medusa admin are served by the backend (Render) or Supabase storage.
    remotePatterns: [
      ...(medusaUrl ? [new URL("/**", medusaUrl)] : []),
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
