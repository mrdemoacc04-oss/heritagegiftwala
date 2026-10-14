import Link from "next/link";
import { Badge, Card, EmptyState, PageTitle, StatusBadge, buttonClass, rupees, when } from "@/components/admin/ui";
import { sql } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Dashboard" };

type Stats = { new_orders: number; to_ship: number; today_orders: number; today_sales: number; week_sales: number; month_sales: number };

export default async function Dashboard() {
  await requireAdmin();
  const [stats] = await sql<Stats>(`
    select
      count(*) filter (where status = 'placed')::int as new_orders,
      count(*) filter (where status in ('placed', 'packed'))::int as to_ship,
      count(*) filter (where placed_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' and status <> 'cancelled')::int as today_orders,
      coalesce(sum(total) filter (where placed_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' and status <> 'cancelled'), 0)::int as today_sales,
      coalesce(sum(total) filter (where placed_at >= now() - interval '7 days' and status <> 'cancelled'), 0)::int as week_sales,
      coalesce(sum(total) filter (where placed_at >= now() - interval '30 days' and status <> 'cancelled'), 0)::int as month_sales
    from shop.orders`);
  const low = await sql<{ id: string; title: string; stock: number }>("select id, title, stock from shop.products where status = 'active' and track_stock and stock <= 3 order by stock, title limit 12");
  const recent = await sql<{ id: string; number: string; name: string; total: number; status: string; placed_at: string }>(
    "select id, number, name, total, status, placed_at from shop.orders order by placed_at desc limit 8",
  );

  const tiles = [
    { label: "New orders", value: stats.new_orders, href: "/admin/orders?status=placed", tone: stats.new_orders ? "ring-2 ring-red-500" : "" },
    { label: "To pack or ship", value: stats.to_ship, href: "/admin/orders" },
    { label: "Orders today", value: stats.today_orders, href: "/admin/orders" },
    { label: "Sales today", value: rupees(stats.today_sales), href: "/admin/orders" },
    { label: "Last 7 days", value: rupees(stats.week_sales), href: "/admin/orders" },
    { label: "Last 30 days", value: rupees(stats.month_sales), href: "/admin/orders" },
  ];

  return (
    <>
      <PageTitle
        title="Today at the shop"
        actions={
          <>
            <Link href="/admin/orders/new" className={buttonClass("secondary")}>Take an order</Link>
            <Link href="/admin/products/new" className={buttonClass("primary")}>Add a product</Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={`rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-400 ${t.tone ?? ""}`}>
            <p className="text-sm text-stone-600">{t.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{t.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Latest orders">
          {recent.length === 0 ? (
            <EmptyState>No orders yet. They appear here the moment a customer checks out.</EmptyState>
          ) : (
            <ul className="divide-y divide-stone-100">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-stone-50">
                    <span className="min-w-0">
                      <span className="font-semibold">#{o.number}</span> <span className="text-stone-700">{o.name}</span>
                      <span className="block text-xs text-stone-500">{when(o.placed_at)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="font-semibold">{rupees(o.total)}</span>
                      <StatusBadge status={o.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Running low">
          {low.length === 0 ? (
            <p className="text-sm text-stone-600">Everything has at least 4 in stock.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {low.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-stone-50">
                    <span className="truncate">{p.title}</span>
                    <Badge tone={p.stock === 0 ? "red" : "amber"}>{p.stock === 0 ? "Sold out" : `${p.stock} left`}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
