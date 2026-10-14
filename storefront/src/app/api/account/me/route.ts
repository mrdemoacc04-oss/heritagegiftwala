import { currentCustomer } from "@/lib/server/customer-auth";
import { dbEnabled, sql } from "@/lib/server/db";
import { guard, json } from "@/lib/server/security";

/** Who is signed in on this browser (read-only, so no origin check is needed). */
export const GET = guard(async () => {
  if (!dbEnabled()) return json({ customer: null });
  const c = await currentCustomer();
  if (!c) return json({ customer: null });
  const addresses = await sql(
    `select id, first_name, last_name, phone, address_1, address_2, city, province, postal_code, is_default as is_default_shipping
       from shop.customer_addresses where customer_id = $1 order by is_default desc, created_at`,
    [c.id],
  );
  return json({ customer: { ...c, addresses } });
});
