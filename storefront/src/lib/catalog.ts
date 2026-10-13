import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { HttpTypes } from "@medusajs/types";
import { categories as localCategories } from "@/data/categories";
import { products as localProducts } from "@/data/products";
import { medusaEnabled, regionId, sdk } from "./medusa";
import { ownPhoto } from "./format";
import type { Category, Occasion, Product, Recipient } from "./types";

const PRODUCT_FIELDS =
  "*variants.calculated_price,+variants.inventory_quantity,+variants.manage_inventory,*categories,*images,+metadata";

const list = (v: unknown, sep: string) =>
  typeof v === "string" ? v.split(sep).map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? (v as string[]) : [];
const csv = (v: unknown) => list(v, ",");

/**
 * Medusa product → storefront product. Shop-specific fields (tint, badge,
 * recipients, occasions, details) live in product metadata so the owner can
 * edit them from Medusa admin.
 */
function fromMedusa(p: HttpTypes.StoreProduct, index: number): Product {
  const m = (p.metadata ?? {}) as Record<string, unknown>;
  const variant = p.variants?.[0];
  const price = variant?.calculated_price;
  const images = (p.images ?? []).map((i) => ownPhoto(i.url));
  const managed = variant?.manage_inventory ?? false;
  return {
    id: p.id,
    handle: p.handle ?? p.id,
    title: p.title,
    subtitle: p.subtitle ?? "",
    description: p.description ?? "",
    price: Number(price?.calculated_amount ?? 0),
    compareAtPrice:
      price?.original_amount && price.original_amount > (price.calculated_amount ?? 0) ? Number(price.original_amount) : undefined,
    categories: (p.categories ?? []).map((c) => c.handle),
    recipients: csv(m.recipients) as Recipient[],
    occasions: csv(m.occasions) as Occasion[],
    image: ownPhoto(p.thumbnail) || images[0] || "",
    studio: images[1],
    shelf: images[2],
    tint: typeof m.tint === "string" ? m.tint : "#F4E9D8",
    badge: typeof m.badge === "string" ? m.badge : undefined,
    details: list(m.details, "|"),
    variantId: variant?.id,
    inStock: !managed || (variant?.inventory_quantity ?? 0) > 0,
    rank: m.rank !== undefined && m.rank !== "" && Number.isFinite(Number(m.rank)) ? Number(m.rank) : index + 1,
    isNew: m.is_new === true || m.is_new === "true",
    hidden: m.hidden === true || m.hidden === "true",
  };
}

const publicFile = (src?: string) => (src && fs.existsSync(path.join(process.cwd(), "public", src)) ? src : undefined);

export const getAllProducts = cache(async (): Promise<Product[]> => {
  if (!medusaEnabled || !sdk) {
    // Gallery frames that haven't been photographed yet are left out rather than shown broken.
    return localProducts.map((p) => ({ ...p, studio: publicFile(p.studio), shelf: publicFile(p.shelf) }));
  }
  const { products } = await sdk.client.fetch<HttpTypes.StoreProductListResponse>("/store/products", {
    query: { region_id: regionId, fields: PRODUCT_FIELDS, limit: 200 },
    next: { revalidate: 60, tags: ["products"] },
  });
  return products.map(fromMedusa);
});

/** Everything shoppers can browse (the gift-wrap service product stays out of listings). */
export const getProducts = cache(async () => (await getAllProducts()).filter((p) => !p.hidden).sort((a, b) => a.rank - b.rank));

export const getProduct = cache(async (handle: string) => (await getAllProducts()).find((p) => p.handle === handle));

export const getCategories = cache(async (): Promise<Category[]> => {
  if (!medusaEnabled || !sdk) return localCategories;
  const { product_categories } = await sdk.store.category.list({ fields: "id,name,handle,description,metadata", limit: 100 });
  return product_categories.map((c) => {
    const m = (c.metadata ?? {}) as Record<string, unknown>;
    const local = localCategories.find((l) => l.handle === c.handle);
    return {
      handle: c.handle,
      title: c.name,
      blurb: c.description || local?.blurb || "",
      cover: typeof m.cover === "string" ? m.cover : local?.cover ?? "",
      tint: typeof m.tint === "string" ? m.tint : local?.tint ?? "#F4E9D8",
    };
  });
});

export const getCategory = cache(async (handle: string) => (await getCategories()).find((c) => c.handle === handle));

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
