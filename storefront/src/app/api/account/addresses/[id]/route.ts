import { z } from "zod";
import { currentCustomer } from "@/lib/server/customer-auth";
import { pool, sql } from "@/lib/server/db";
import { guard, json, readJson, requirePost, sameOrigin, HttpError } from "@/lib/server/security";
import { addressInput } from "@/lib/server/schemas";

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (ctx: Ctx) => {
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) throw new HttpError(404, "Address not found.");
  return id.data;
};
const handler = (fn: (req: Request, id: string, customerId: string) => Promise<Response>) => (req: Request, ctx: Ctx) =>
  guard(async (r) => {
    const c = await currentCustomer();
    if (!c) throw new HttpError(401, "Please sign in again.");
    return fn(r, await idOf(ctx), c.id);
  })(req);

// Every query below filters on BOTH the address id and the signed-in customer's id, so one customer can never touch another's addresses.
export const POST = handler(async (req, id, customerId) => {
  requirePost(req);
  const parsed = addressInput.safeParse(await readJson(req));
  if (!parsed.success) return json({ message: "Please check the address and try again." }, 400);
  const a = parsed.data;
  const db = await pool().connect();
  try {
    await db.query("begin");
    if (a.is_default) await db.query("update shop.customer_addresses set is_default = false where customer_id = $1", [customerId]);
    const res = await db.query(
      `update shop.customer_addresses set first_name=$3, last_name=$4, phone=$5, address_1=$6, address_2=$7, city=$8, province=$9, postal_code=$10, is_default=$11
        where id = $1 and customer_id = $2`,
      [id, customerId, a.first_name, a.last_name, a.phone, a.address_1, a.address_2, a.city, a.province, a.postal_code, a.is_default],
    );
    if (!res.rowCount) {
      await db.query("rollback");
      return json({ message: "Address not found." }, 404);
    }
    await db.query("commit");
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
  return json({ ok: true });
});

export const DELETE = handler(async (req, id, customerId) => {
  if (!sameOrigin(req)) throw new HttpError(403, "That request wasn't allowed.");
  await sql("delete from shop.customer_addresses where id = $1 and customer_id = $2", [id, customerId]);
  return json({ ok: true });
});
