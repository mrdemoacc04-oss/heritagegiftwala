import "server-only";
import { z } from "zod";
import { papers, ribbons } from "@/lib/wrap";

/** Removes control characters (tabs and newlines included unless `multiline`), then trims. */
export const clean = (s: string, multiline = false) =>
  s.replace(multiline ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "").trim();

const text = (min: number, max: number, multiline = false) => z.string().transform((s) => clean(s, multiline)).pipe(z.string().min(min).max(max));

export const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** Indian mobile numbers: accepts +91 or spaces, stores the plain 10 digits. */
export const mobile = z
  .string()
  .transform((s) => s.replace(/\D/g, "").slice(-10))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"));

export const pincode = z.string().trim().pipe(z.string().regex(/^\d{6}$/, "Enter a 6-digit PIN code"));

const couponCode = z.string().trim().toUpperCase().pipe(z.string().regex(/^[A-Z0-9_-]{3,24}$/));

const paperIds = papers.map((p) => p.id);
const ribbonIds = ribbons.map((r) => r.id);

export const cartItem = z.object({
  product_id: z.uuid(),
  quantity: z.number().int().min(1).max(20),
  wrap: z
    .object({
      paper: z.string().refine((v) => paperIds.includes(v)),
      ribbon: z.string().refine((v) => ribbonIds.includes(v)),
      note: z.string().max(200).transform((s) => clean(s, true)),
    })
    .nullish()
    .transform((w) => w ?? null),
});

export const quoteInput = z.object({
  items: z.array(cartItem).min(1).max(40),
  shipping: z.enum(["standard", "express"]),
  coupon: couponCode.nullish().transform((c) => c ?? null),
});

export const contact = z.object({
  email,
  phone: mobile,
  name: text(1, 120),
  address1: text(1, 200),
  address2: text(0, 200),
  city: text(1, 80),
  state: text(0, 80),
  pincode,
});

export const orderInput = quoteInput.extend({ contact });

export const trackInput = z.object({
  order_number: z.union([z.string(), z.number()]).transform((v) => Number(String(v).replace(/\D/g, ""))).pipe(z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)),
  email,
});

export const registerInput = z.object({
  first_name: text(1, 60),
  last_name: text(1, 60),
  email,
  phone: z.union([z.literal(""), mobile]).default(""),
  password: z.string().min(1).max(128),
});

export const loginInput = z.object({ email, password: z.string().min(1).max(200) });

export const profileInput = z.object({
  first_name: text(1, 60),
  last_name: text(0, 60),
  phone: z.union([z.literal(""), mobile]).default(""),
});

export const addressInput = z.object({
  first_name: text(1, 60),
  last_name: text(0, 60),
  phone: z.union([z.literal(""), mobile]).default(""),
  address_1: text(1, 200),
  address_2: text(0, 200),
  city: text(1, 80),
  province: text(0, 80),
  postal_code: pincode,
  is_default: z.boolean().default(false),
});
