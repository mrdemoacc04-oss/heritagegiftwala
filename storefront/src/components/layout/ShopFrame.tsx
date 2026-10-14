import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CatalogProvider } from "@/components/providers/CatalogProvider";
import { ClientShell } from "@/components/providers/ClientShell";
import { dbEnabled } from "@/lib/server/db";
import { getAllProducts, getCategories, getProducts, getSettings } from "@/lib/catalog";

/** The customer-facing chrome: announcement bar, header, footer, bag drawer and search. The admin panel does not use it. */
export async function ShopFrame({ children }: { children: React.ReactNode }) {
  const [products, categories, all, settings] = await Promise.all([getProducts(), getCategories(), getAllProducts(), getSettings()]);
  const giftWrap = all.find((p) => p.handle === "gift-wrap");

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <CatalogProvider value={{ products, categories, giftWrap, settings, live: dbEnabled() }}>
        <ClientShell>
          <AnnouncementBar />
          <Header />
          <main id="main">{children}</main>
          <Footer categories={categories} />
        </ClientShell>
      </CatalogProvider>
    </>
  );
}
