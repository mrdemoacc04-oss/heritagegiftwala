import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Figtree } from "next/font/google";
import "./globals.css";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CatalogProvider } from "@/components/providers/CatalogProvider";
import { ClientShell } from "@/components/providers/ClientShell";
import { getAllProducts, getCategories, getProducts } from "@/lib/catalog";
import { site } from "@/lib/site";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const sans = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const hand = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — gifts, hampers & happy little things`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { type: "website", siteName: site.name, images: ["/brand/og.jpg"], locale: "en_IN" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#fff8ee" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [products, categories, all] = await Promise.all([getProducts(), getCategories(), getAllProducts()]);
  const giftWrap = all.find((p) => p.handle === "gift-wrap");

  return (
    <html lang="en-IN" className={`${display.variable} ${sans.variable} ${hand.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <CatalogProvider value={{ products, categories, giftWrap }}>
          <ClientShell>
            <AnnouncementBar />
            <Header />
            <main id="main">{children}</main>
            <Footer categories={categories} />
          </ClientShell>
        </CatalogProvider>
      </body>
    </html>
  );
}
