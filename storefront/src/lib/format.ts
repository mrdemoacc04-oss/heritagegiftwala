import { site } from "./site";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatPrice = (rupees: number) => inr.format(Math.round(rupees));

export const discountPercent = (price: number, compareAt?: number) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

/** JSON for a <script type="application/ld+json"> tag. Escaping "<" stops text like "</script>" in a product description from ending the tag early. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** Photos saved with this site's own address (as an absolute URL) are served straight from /public instead of being fetched over HTTP again. */
export const ownPhoto = (url?: string | null) => (url && url.startsWith(`${site.url}/`) ? url.slice(site.url.length) : (url ?? ""));
