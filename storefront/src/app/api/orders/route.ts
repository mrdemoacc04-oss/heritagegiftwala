import { after } from "next/server";
import { callInTransaction, shopError, friendlyOrderError, isBusy } from "@/lib/server/db";
import { captchaOk } from "@/lib/server/captcha";
import { currentCustomer } from "@/lib/server/customer-auth";
import { alertNewOrder } from "@/lib/server/notify";
import { allow, guard, hashed, ipKey, json, normalizeEmail, rawIp, readJson, refund, requirePost } from "@/lib/server/security";
import { orderInput } from "@/lib/server/schemas";

/** Places a cash-on-delivery order. The browser only names products and quantities; everything else is decided in the database. */
export const POST = guard(async (req) => {
  requirePost(req);
  const ip = ipKey(req.headers);
  // Every attempt is counted first: even a refused order briefly holds product rows.
  if (!(await allow(`order-try:ip:${ip}`, 40, 3600))) return json({ message: "Too many attempts. Please wait a little, or call the shop." }, 429);

  const parsed = orderInput.safeParse(await readJson(req));
  if (!parsed.success) return json({ message: "Please check your details and try again.", fields: parsed.error.issues.map((i) => i.path.join(".")) }, 400);
  const { items, shipping, coupon, contact, idem_key, expected_total, captcha } = parsed.data;

  if (!(await captchaOk(captcha, rawIp(req.headers)))) return json({ code: "CAPTCHA", message: "Please confirm you're not a robot, then place the order again." }, 400);

  // A real household places a handful of orders; a script places thousands. One slot is reserved BEFORE the order is
  // attempted (so a burst of parallel requests can't all get through) and handed back if the order doesn't happen.
  const slots = [`order-ok:ip:${ip}`, `order-ok:email:${hashed(normalizeEmail(contact.email))}`];
  const within = [await allow(slots[0], 10, 3600), await allow(slots[1], 6, 3600)];
  if (within.includes(false)) return json({ message: "You've placed several orders in a short time. Please wait a little, or call the shop." }, 429);

  // Only a valid sign-in cookie can attach an order to an account. The browser never says who it is.
  const customer = await currentCustomer();

  try {
    const [row] = await callInTransaction<{ r: { id: string; number: string; total: number; duplicate?: boolean; lines?: { title: string; quantity: number }[] } }>("select shop.place_order($1::jsonb) as r", [
      JSON.stringify({ items, shipping, coupon, ...contact, customer_id: customer?.id ?? null, source: "web", idem_key, expected_total }),
    ]);
    const { number, total, duplicate, lines } = row.r;
    if (duplicate) await refund(...slots);
    else after(() => alertNewOrder({ number: Number(number), name: contact.name, city: contact.city, total, items: lines ?? [] }));
    return json({ order: { number: Number(number), total } }, 201);
  } catch (e) {
    await refund(...slots);
    if (isBusy(e)) return json({ code: "BUSY", message: "The shop is busy for a moment. Please try placing the order again." }, 503);
    const err = shopError(e);
    if (!err) throw e;
    return json({ code: err.code, message: friendlyOrderError(err.code, err.detail), ...(err.code === "PRICE_CHANGED" ? { new_total: Number(err.detail) } : {}) }, 409);
  }
});
