import { sql, shopError, friendlyOrderError } from "@/lib/server/db";
import { allow, guard, ipKey, json, readJson, requirePost } from "@/lib/server/security";
import { quoteInput } from "@/lib/server/schemas";

/** Prices a bag from the database: the figures the shopper sees at checkout and the ones they will be charged. */
export const POST = guard(async (req) => {
  requirePost(req);
  const ip = ipKey(req.headers);
  if (!(await allow(`quote:${ip}`, 120, 600))) return json({ message: "Too many requests. Please wait a moment." }, 429);

  const parsed = quoteInput.safeParse(await readJson(req));
  if (!parsed.success) return json({ message: "Please check the items in your bag." }, 400);
  const { items, shipping, coupon } = parsed.data;
  // Coupon codes can be guessed, so attempts get a tighter limit of their own.
  if (coupon && !(await allow(`coupon:${ip}`, 25, 600))) return json({ message: "Too many coupon attempts. Please wait a few minutes." }, 429);

  try {
    const [row] = await sql<{ r: PricedCart }>("select shop.price_cart($1::jsonb, $2, $3, false) as r", [JSON.stringify(items), shipping, coupon]);
    const r = row.r;
    return json({
      lines: r.lines.map((l) => ({ product_id: l.product_id, title: l.title, unit_price: l.unit_price, quantity: l.quantity, image: l.image, tint: l.tint })),
      subtotal: r.subtotal,
      shipping_fee: r.shipping_fee,
      discount: r.discount,
      total: r.total,
      coupon: r.coupon_code,
    });
  } catch (e) {
    const err = shopError(e);
    if (!err) throw e;
    return json({ code: err.code, product_id: err.code === "UNKNOWN_PRODUCT" ? err.detail : undefined, message: friendlyOrderError(err.code, err.detail) }, 409);
  }
});

type PricedCart = {
  lines: { product_id: string; title: string; unit_price: number; quantity: number; image: string; tint: string }[];
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  coupon_code: string | null;
};
