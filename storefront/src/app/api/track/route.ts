import { sqlOne } from "@/lib/server/db";
import { allow, guard, ipKey, json, readJson, requirePost } from "@/lib/server/security";
import { trackInput } from "@/lib/server/schemas";

const NOT_FOUND = "We couldn't find an order with that number and email. Please check both and try again.";

/**
 * Guest order tracking: the order number plus the checkout email is the key. A wrong number and a
 * wrong email give the same answer, so nobody can probe for other people's orders.
 */
export const POST = guard(async (req) => {
  requirePost(req);
  if (!(await allow(`track:${ipKey(req.headers)}`, 20, 600))) return json({ message: "Too many tries. Please wait a few minutes and try again." }, 429);
  const parsed = trackInput.safeParse(await readJson(req));
  if (!parsed.success) return json({ message: "Enter your order number and the email you used at checkout." }, 400);
  const row = await sqlOne<{ t: unknown }>("select shop.track_order($1, $2) as t", [parsed.data.order_number, parsed.data.email]);
  if (!row?.t) return json({ message: NOT_FOUND }, 404);
  return json({ order: row.t });
});
