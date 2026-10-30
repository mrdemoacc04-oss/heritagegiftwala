import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { categories as localCategories } from "@/data/categories";
import { products as localProducts } from "@/data/products";
import { dbEnabled, sql } from "@/lib/server/db";
import { site } from "./site";
import type { Category, Occasion, Product, Recipient, ShopSettings } from "./types";

/** Cache tag the admin panel expires whenever the owner changes products, categories or delivery fees. */
export const CATALOG_TAG = "catalog";
const REFRESH_SECONDS = 60;

type ProductRow = {
  id: string; handle: string; title: string; subtitle: string; description: string; price: number | null; compare_at: number | null;
  categories: string[]; recipients: string[]; occasions: string[]; details: string[]; tint: string; badge: string; rank: number;
  is_new: boolean; hidden: boolean; show_price: boolean; track_stock: boolean; stock: number; image: string; studio: string; shelf: string; image_fit: "contain" | "cover";
};

const fromRow = (r: ProductRow): Product => ({
  id: r.id,
  handle: r.handle,
  title: r.title,
  subtitle: r.subtitle,
  description: r.description,
  // A price the owner has switched off (or never typed) is no price at all as far as the shop is concerned. The MRP goes with it.
  price: r.show_price === false ? null : r.price,
  compareAtPrice: r.show_price !== false && r.price !== null && r.compare_at && r.compare_at > r.price ? r.compare_at : undefined,
  categories: r.categories,
  recipients: r.recipients as Recipient[],
  occasions: r.occasions as Occasion[],
  image: r.image,
  studio: r.studio || undefined,
  shelf: r.shelf || undefined,
  tint: r.tint,
  badge: r.badge || undefined,
  details: r.details,
  imageFit: r.image_fit,
  inStock: !r.track_stock || r.stock > 0,
  rank: r.rank,
  isNew: r.is_new,
  hidden: r.hidden,
});

const liveProducts = unstable_cache(
  async () => (await sql<ProductRow>("select * from shop.products where status = 'active' order by rank, title")).map(fromRow),
  ["catalog-products"],
  { tags: [CATALOG_TAG], revalidate: REFRESH_SECONDS },
);

const liveCategories = unstable_cache(
  async () => {
    const rows = await sql<{ handle: string; title: string; blurb: string; cover: string; tint: string }>("select handle, title, blurb, cover, tint from shop.categories order by sort, title");
    return rows.map((c): Category => ({ handle: c.handle, title: c.title, blurb: c.blurb, cover: c.cover, tint: c.tint }));
  },
  ["catalog-categories"],
  { tags: [CATALOG_TAG], revalidate: REFRESH_SECONDS },
);

type SettingsRow = {
  shipping_flat: number; shipping_express: number; free_shipping_from: number; show_prices: boolean;
  popup_enabled: boolean; popup_label: string; popup_title: string; popup_text: string; popup_button_text: string; popup_button_url: string;
  popup_image: string; popup_tint: string; popup_delay: number; popup_reshow_days: number; popup_ends_at: Date | null; popup_updated_at: Date;
};

const liveSettings = unstable_cache(
  async () => {
    // The popup ends at the close of the owner's last day, India time.
    const [r] = await sql<SettingsRow>(
      `select shipping_flat, shipping_express, free_shipping_from, show_prices, popup_enabled, popup_label, popup_title, popup_text, popup_button_text,
              popup_button_url, popup_image, popup_tint, popup_delay, popup_reshow_days, popup_updated_at,
              case when popup_ends_on is null then null else ((popup_ends_on + 1)::timestamp at time zone 'Asia/Kolkata') end as popup_ends_at
         from shop.settings where id = 1`,
    );
    const endsAt = r.popup_ends_at ? new Date(r.popup_ends_at).toISOString() : null;
    const live = r.popup_enabled && r.popup_title !== "" && (!endsAt || new Date(endsAt).getTime() > Date.now());
    return {
      showPrices: r.show_prices,
      settings: {
        shippingFlat: r.shipping_flat,
        shippingExpress: r.shipping_express,
        freeShippingFrom: r.free_shipping_from,
        popup: live
          ? {
              label: r.popup_label, title: r.popup_title, text: r.popup_text, buttonText: r.popup_button_text, buttonUrl: r.popup_button_url,
              image: r.popup_image, tint: r.popup_tint, delay: r.popup_delay, reshowDays: r.popup_reshow_days, endsAt,
              version: new Date(r.popup_updated_at).getTime(),
            }
          : null,
      } satisfies ShopSettings,
    };
  },
  ["catalog-settings"],
  { tags: [CATALOG_TAG], revalidate: REFRESH_SECONDS },
);

const publicFile = (src?: string) => (src && fs.existsSync(path.join(process.cwd(), "public", src)) ? src : undefined);

export const getAllProducts = cache(async (): Promise<Product[]> => {
  if (!dbEnabled()) {
    // Preview mode: no database configured. Gallery frames that haven't been photographed yet are left out rather than shown broken.
    return localProducts.map((p) => ({ ...p, studio: publicFile(p.studio), shelf: publicFile(p.shelf) }));
  }
  const [products, { showPrices }] = await Promise.all([liveProducts(), liveSettings()]);
  // The owner's shop-wide "show prices" switch: off hides every price and MRP at once.
  return showPrices ? products : products.map((p) => ({ ...p, price: null, compareAtPrice: undefined }));
});

/** Everything shoppers can browse (a product marked hidden stays out of listings). */
export const getProducts = cache(async () => (await getAllProducts()).filter((p) => !p.hidden).sort((a, b) => a.rank - b.rank));

export const getProduct = cache(async (handle: string) => (await getAllProducts()).find((p) => p.handle === handle));

export const getCategories = cache(async (): Promise<Category[]> => (dbEnabled() ? liveCategories() : localCategories));

export const getCategory = cache(async (handle: string) => (await getCategories()).find((c) => c.handle === handle));

export const getSettings = cache(
  async (): Promise<ShopSettings> =>
    dbEnabled() ? (await liveSettings()).settings : { shippingFlat: site.shippingFlat, shippingExpress: site.expressShipping, freeShippingFrom: site.freeShippingThreshold, popup: null },
);

export async function getProductsInCategory(handle: string) {
  return (await getProducts()).filter((p) => p.categories.includes(handle));
}

/** Products that complete a gift: same recipient first, then same shelf, never the product itself. */
export async function getPairings(product: Product, count = 4) {
  const all = await getProducts();
  const score = (p: Product) =>
    p.recipients.filter((r) => product.recipients.includes(r)).length * 2 +
    p.categories.filter((c) => product.categories.includes(c)).length +
    p.occasions.filter((o) => product.occasions.includes(o)).length;
  return all
    .filter((p) => p.handle !== product.handle)
    .sort((a, b) => score(b) - score(a) || a.rank - b.rank)
    .slice(0, count);
}
