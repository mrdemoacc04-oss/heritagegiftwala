import { currentCustomer } from "@/lib/server/customer-auth";
import { sql } from "@/lib/server/db";
import { guard, json, HttpError } from "@/lib/server/security";

export const GET = guard(async () => {
  const c = await currentCustomer();
  if (!c) throw new HttpError(401, "Please sign in again.");
  const orders = await sql(
    `select o.number, o.placed_at, o.status as stage, o.total,
            coalesce((select jsonb_agg(jsonb_build_object('title', i.title, 'quantity', i.quantity, 'image', i.image, 'tint', i.tint) order by i.title)
                        from shop.order_items i where i.order_id = o.id), '[]'::jsonb) as items
       from shop.orders o where o.customer_id = $1 order by o.placed_at desc limit 50`,
    [c.id],
  );
  return json({ orders });
});
