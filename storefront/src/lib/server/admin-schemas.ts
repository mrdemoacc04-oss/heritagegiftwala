import "server-only";
import { z } from "zod";
import { clean } from "./schemas";
import { isOwnImage } from "./storage";

export const RECIPIENTS = ["her", "him", "kids", "parents", "colleague", "home"] as const;
export const OCCASIONS = ["birthday", "anniversary", "festive", "housewarming", "thank-you", "just-because"] as const;

const slug = z.string().trim().toLowerCase().pipe(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letters, numbers and dashes only").max(80));
const money = (max = 1_000_000) => z.coerce.number().int("Whole rupees only").min(0).max(max);
const optionalMoney = z
  .union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000)])
  .transform((v) => (v === "" ? null : v));
const text = (max: number, multiline = false) => z.string().transform((s) => clean(s, multiline)).pipe(z.string().max(max));
const image = z.string().trim().refine(isOwnImage, "That photo address isn't one of ours. Upload the photo again.");
const hex = z.string().trim().pipe(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a colour"));
const checkbox = z.union([z.literal("on"), z.literal("true"), z.undefined(), z.null()]).transform((v) => v === "on" || v === "true");

export const slugify = (title: string) =>
  title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export const productForm = z
  .object({
    title: text(120).pipe(z.string().min(1, "Give the product a name")),
    handle: z.string().trim().toLowerCase().max(80),
    subtitle: text(160),
    description: text(4000, true),
    price: money(),
    compare_at: optionalMoney,
    categories: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(6),
    recipients: z.array(z.enum(RECIPIENTS)).max(6),
    occasions: z.array(z.enum(OCCASIONS)).max(6),
    details: z.string().transform((s) => s.split(/\r?\n/).map((l) => clean(l)).filter(Boolean)).pipe(z.array(z.string().max(200)).max(12)),
    tint: hex,
    badge: text(24),
    rank: z.coerce.number().int().min(0).max(100000),
    is_new: checkbox,
    status: z.enum(["active", "draft"]),
    track_stock: checkbox,
    stock: z.coerce.number().int().min(0).max(100000),
    image,
    studio: image,
    shelf: image,
    image_fit: z.enum(["contain", "cover"]),
  })
  .superRefine((p, ctx) => {
    if (p.compare_at !== null && p.compare_at <= p.price) ctx.addIssue({ code: "custom", path: ["compare_at"], message: "The 'was' price must be higher than the price" });
  })
  .transform((p) => ({ ...p, handle: slug.safeParse(p.handle || slugify(p.title)).data ?? "" }));

export const quickEdit = z.object({ id: z.uuid(), price: money(), stock: z.coerce.number().int().min(0).max(100000) });

export const couponForm = z
  .object({
    code: z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z0-9_-]{3,24}$/, "Use 3–24 letters, numbers, dashes or underscores")),
    kind: z.enum(["percent", "fixed"]),
    value: z.coerce.number().int().min(1).max(1_000_000),
    min_subtotal: money(),
    max_uses: z.union([z.literal(""), z.coerce.number().int().min(1).max(1_000_000)]).transform((v) => (v === "" ? null : v)),
    expires_on: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).transform((v) => (v === "" ? null : v)),
  })
  .superRefine((c, ctx) => {
    if (c.kind === "percent" && c.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage can't be more than 100" });
  });

export const settingsForm = z.object({ shipping_flat: money(100_000), shipping_express: money(100_000), free_shipping_from: money() });

export const categoryForm = z.object({
  handle: slug,
  title: text(80).pipe(z.string().min(1, "Give the shelf a name")),
  blurb: text(200),
  cover: z.string().trim().max(80),
  tint: hex,
  sort: z.coerce.number().int().min(0).max(10000),
});

export const trackingForm = z.object({
  id: z.uuid(),
  courier: text(80),
  tracking_number: text(80),
  tracking_url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u === "" || /^https?:\/\/[^\s]+$/i.test(u), "The tracking link must start with http:// or https://"),
});

export const passwordForm = z.object({ current: z.string().max(200), next: z.string().max(200), confirm: z.string().max(200) });
