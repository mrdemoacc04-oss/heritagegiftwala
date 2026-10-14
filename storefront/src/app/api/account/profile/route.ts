import { currentCustomer } from "@/lib/server/customer-auth";
import { sql } from "@/lib/server/db";
import { guard, json, readJson, requirePost, HttpError } from "@/lib/server/security";
import { profileInput } from "@/lib/server/schemas";

export const POST = guard(async (req) => {
  requirePost(req);
  const c = await currentCustomer();
  if (!c) throw new HttpError(401, "Please sign in again.");
  const parsed = profileInput.safeParse(await readJson(req));
  if (!parsed.success) return json({ message: "Please check your details." }, 400);
  const { first_name, last_name, phone } = parsed.data;
  await sql("update shop.customers set first_name = $2, last_name = $3, phone = $4 where id = $1", [c.id, first_name, last_name, phone]);
  return json({ ok: true });
});
