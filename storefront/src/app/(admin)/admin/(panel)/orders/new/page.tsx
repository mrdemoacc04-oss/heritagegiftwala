import { NewOrderForm } from "@/components/admin/NewOrderForm";
import { PageTitle } from "@/components/admin/ui";
import { sql } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Take an order" };

export default async function NewOrderPage() {
  await requireAdmin();
  const products = await sql<{ id: string; title: string; price: number | null; stock: number; track_stock: boolean }>(
    "select id, title, price, stock, track_stock from shop.products where status = 'active' order by title",
  );
  return (
    <>
      <PageTitle title="Take an order" hint="For orders that come by phone, WhatsApp or in the shop. It follows the same rules as a website order: stock comes off and the customer can track it." />
      <NewOrderForm products={products} />
    </>
  );
}
