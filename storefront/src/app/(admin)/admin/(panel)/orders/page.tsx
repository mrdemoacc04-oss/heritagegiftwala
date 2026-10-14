import Link from "next/link";
import { Badge, EmptyState, PageTitle, StatusBadge, TabLink, buttonClass, rupees, when } from "@/components/admin/ui";
import { sql } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Orders" };

const FILTERS = [
  { id: "", label: "All" },
  { id: "placed", label: "New" },
  { id: "packed", label: "Packed" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];
const PAGE = 30;

type Row = { id: string; number: string; name: string; email: string; city: string; total: number; status: string; payment_status: string; placed_at: string; source: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = FILTERS.some((f) => f.id && f.id === sp.status) ? sp.status! : null;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Math.min(500, Number(sp.page) || 1));
  const like = `%${q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;

  const rows = await sql<Row>(
    `select id, number, name, email, city, total, status, payment_status, placed_at, source
       from shop.orders
      where ($1::text is null or status = $1)
        and ($2 = '' or number::text = $2 or lower(name) like $3 or email like $3 or phone like $3)
      order by placed_at desc limit ${PAGE + 1} offset $4`,
    [status, q.replace(/^#/, ""), like, (page - 1) * PAGE],
  );
  const more = rows.length > PAGE;
  const shown = rows.slice(0, PAGE);
  const href = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { status, q: q || null, page: null, ...over };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, String(v));
    const s = p.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageTitle title="Orders" actions={<Link href="/admin/orders/new" className={buttonClass("primary")}>Take an order</Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <TabLink key={f.id} href={href({ status: f.id || null })} active={(status ?? "") === f.id}>{f.label}</TabLink>
        ))}
        <form className="ml-auto flex gap-2" action="/admin/orders">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Order #, name, email or phone" maxLength={60} className="w-64 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-stone-900" />
          <button className={buttonClass("secondary", "sm")}>Search</button>
        </form>
      </div>

      {shown.length === 0 ? (
        <EmptyState>No orders match.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
              <tr>
                <th className="px-4 py-2.5">Order</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5">Placed</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shown.map((o) => (
                <tr key={o.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold underline-offset-4 hover:underline">#{o.number}</Link>
                    {o.source === "admin" && <span className="ml-2 text-xs text-stone-500">by hand</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {o.name}
                    <span className="block text-xs text-stone-500">{o.city}</span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-stone-600">{when(o.placed_at)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-2.5">{o.payment_status === "paid" ? <Badge tone="green">Paid</Badge> : o.payment_status === "refunded" ? <Badge>Refunded</Badge> : <Badge tone="amber">Due on delivery</Badge>}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{rupees(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        {page > 1 && <Link className={buttonClass("secondary", "sm")} href={href({ page: String(page - 1) })}>← Newer</Link>}
        {more && <Link className={buttonClass("secondary", "sm")} href={href({ page: String(page + 1) })}>Older →</Link>}
      </div>
    </>
  );
}
