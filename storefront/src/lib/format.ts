import { site } from "./site";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatPrice = (rupees: number) => inr.format(Math.round(rupees));

export const discountPercent = (price: number, compareAt?: number) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/** Photos seeded into Medusa point at this site's own /public folder; serve those directly instead of re-fetching them over HTTP. */
export const ownPhoto = (url?: string | null) => (url && url.startsWith(`${site.url}/`) ? url.slice(site.url.length) : (url ?? ""));
