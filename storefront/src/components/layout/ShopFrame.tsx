import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CatalogProvider } from "@/components/providers/CatalogProvider";
import { ClientShell } from "@/components/providers/ClientShell";
import { dbEnabled } from "@/lib/server/db";
import { getCategories, getProducts, getSettings } from "@/lib/catalog";
import { hasPrice } from "@/lib/format";

/** The customer-facing chrome: announcement bar, header, footer, bag drawer and search. The admin panel does not use it. */
export async function ShopFrame({ children }: { children: React.ReactNode }) {
  const [products, categories, settings] = await Promise.all([getProducts(), getCategories(), getSettings()]);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <CatalogProvider value={{ products, categories, settings, live: dbEnabled() }}>
        <ClientShell>
          <AnnouncementBar />
          <Header />
          <main id="main">{children}</main>
          <Footer categories={categories} showBudgets={products.some(hasPrice)} />
        </ClientShell>
      </CatalogProvider>
    </>
  );
}
