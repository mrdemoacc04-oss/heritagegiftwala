import type { Metadata } from "next";
import { PageBanner } from "@/components/shop/PageBanner";
import { ShopBrowser, type ShopFilters } from "@/components/shop/ShopBrowser";
import { getCategories, getProducts } from "@/lib/catalog";
import type { Recipient } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop all gifts",
  description: "Every gift on our shelves: plush toys, crochet, hampers, tumblers, lamps, clocks, idols, bags and more.",
  alternates: { canonical: "/shop" },
};

const recipients: Recipient[] = ["her", "him", "kids", "parents", "colleague", "home"];

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [sp, products, categories] = await Promise.all([searchParams, getProducts(), getCategories()]);
  const initial: ShopFilters = {
    shelf: categories.some((c) => c.handle === sp.shelf) ? sp.shelf : undefined,
    for: recipients.includes(sp.for as Recipient) ? (sp.for as Recipient) : undefined,
    max: Number(sp.max) > 0 ? Number(sp.max) : undefined,
    sort: (["featured", "price-asc", "price-desc", "az"] as const).find((s) => s === sp.sort),
  };
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  const cutouts = ["plush-sunflower-bunny", "lamp-brass-mushroom", "cup-bow-kitty"].map((h) => byHandle.get(h)).filter((p) => p !== undefined);

  return (
    <>
      <PageBanner
        eyebrow="the whole shop, on one page"
        title="All the gifts"
        blurb="Every plushie, pot, lamp and little treasure from our shelves. Filter by who it's for."
        tint="#d3f3ea"
        cutouts={cutouts}
        crumbs={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
        ]}
      />
      <ShopBrowser key={JSON.stringify(initial)} products={products} categories={categories} initial={initial} />
    </>
  );
}
