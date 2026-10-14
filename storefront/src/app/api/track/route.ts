import { sqlOne } from "@/lib/server/db";
import { allow, guard, hashed, ipKey, json, normalizeEmail, readJson, refund, requirePost } from "@/lib/server/security";
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
  // Someone who knows an email address can't walk through order numbers looking for its orders: wrong guesses for
  // one email are limited however many addresses they come from.
  const failKey = `track-fail:email:${hashed(normalizeEmail(parsed.data.email))}`;
  // The guess is counted BEFORE it is checked (so a burst of parallel guesses can't all get through) and handed back if it
  // turns out to be a real order of that email's owner.
  if (!(await allow(failKey, 15, 3600))) return json({ message: "Too many tries for that email. Please wait a while, or call the shop." }, 429);
  const row = await sqlOne<{ t: unknown }>("select shop.track_order($1, $2) as t", [parsed.data.order_number, parsed.data.email]);
  if (!row?.t) return json({ message: NOT_FOUND }, 404);
  await refund(failKey);
  return json({ order: row.t });
});
