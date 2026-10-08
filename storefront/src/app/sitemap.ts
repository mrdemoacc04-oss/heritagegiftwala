import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/catalog";
import { site } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const now = new Date();
  return [
    { url: site.url, lastModified: now, priority: 1 },
    { url: `${site.url}/shop`, lastModified: now, priority: 0.9 },
    { url: `${site.url}/gift-finder`, lastModified: now, priority: 0.6 },
    { url: `${site.url}/help`, lastModified: now, priority: 0.3 },
    ...categories.map((c) => ({ url: `${site.url}/collections/${c.handle}`, lastModified: now, priority: 0.8 })),
    ...products.map((p) => ({ url: `${site.url}/products/${p.handle}`, lastModified: now, priority: 0.7 })),
  ];
}
