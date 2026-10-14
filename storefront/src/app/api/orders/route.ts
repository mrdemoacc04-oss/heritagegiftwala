import { after } from "next/server";
import { sql, shopError, friendlyOrderError } from "@/lib/server/db";
import { currentCustomer } from "@/lib/server/customer-auth";
import { alertNewOrder } from "@/lib/server/notify";
import { allow, guard, hashed, ipKey, json, readJson, requirePost } from "@/lib/server/security";
import { orderInput } from "@/lib/server/schemas";

/** Places a cash-on-delivery order. The browser only names products and quantities; everything else is decided in the database. */
export const POST = guard(async (req) => {
  requirePost(req);
  const ip = ipKey(req.headers);
  const parsed = orderInput.safeParse(await readJson(req));
  if (!parsed.success) return json({ message: "Please check your details and try again.", fields: parsed.error.issues.map((i) => i.path.join(".")) }, 400);
  const { items, shipping, coupon, contact } = parsed.data;

  // A real household places a handful of orders; a script places thousands.
  if (!(await allow(`order:ip:${ip}`, 10, 3600)) || !(await allow(`order:email:${hashed(contact.email)}`, 6, 3600))) {
    return json({ message: "You've placed several orders in a short time. Please wait a little, or call the shop." }, 429);
  }

  // Only a valid sign-in cookie can attach an order to an account. The browser never says who it is.
  const customer = await currentCustomer();

  try {
    const [row] = await sql<{ r: { id: string; number: string; total: number; lines: { title: string; quantity: number }[] } }>("select shop.place_order($1::jsonb) as r", [
      JSON.stringify({ items, shipping, coupon, ...contact, customer_id: customer?.id ?? null, source: "web" }),
    ]);
    const { number, total, lines } = row.r;
    after(() => alertNewOrder({ number: Number(number), name: contact.name, city: contact.city, total, items: lines }));
    return json({ order: { number: Number(number), total } }, 201);
  } catch (e) {
    const err = shopError(e);
    if (!err) throw e;
    return json({ code: err.code, message: friendlyOrderError(err.code, err.detail) }, 409);
  }
});
