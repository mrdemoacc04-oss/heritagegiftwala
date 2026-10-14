import { currentCustomer } from "@/lib/server/customer-auth";
import { pool } from "@/lib/server/db";
import { guard, json, readJson, requirePost, HttpError } from "@/lib/server/security";
import { addressInput } from "@/lib/server/schemas";

const MAX_ADDRESSES = 10;

export const POST = guard(async (req) => {
  requirePost(req);
  const c = await currentCustomer();
  if (!c) throw new HttpError(401, "Please sign in again.");
  const parsed = addressInput.safeParse(await readJson(req));
  if (!parsed.success) return json({ message: "Please check the address and try again." }, 400);
  const a = parsed.data;

  const db = await pool().connect();
  try {
    await db.query("begin");
    const { rows } = await db.query("select count(*)::int as n from shop.customer_addresses where customer_id = $1", [c.id]);
    if (rows[0].n >= MAX_ADDRESSES) {
      await db.query("rollback");
      return json({ message: `You can save up to ${MAX_ADDRESSES} addresses.` }, 409);
    }
    const makeDefault = a.is_default || rows[0].n === 0;
    if (makeDefault) await db.query("update shop.customer_addresses set is_default = false where customer_id = $1", [c.id]);
    await db.query(
      `insert into shop.customer_addresses (customer_id, first_name, last_name, phone, address_1, address_2, city, province, postal_code, is_default)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [c.id, a.first_name, a.last_name, a.phone, a.address_1, a.address_2, a.city, a.province, a.postal_code, makeDefault],
    );
    await db.query("commit");
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    db.release();
  }
  return json({ ok: true }, 201);
});
