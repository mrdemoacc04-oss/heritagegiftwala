import Link from "next/link";
import { Badge, EmptyState, PageTitle, TabLink, buttonClass, inputClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/forms";
import { sql } from "@/lib/server/db";
import { quickEditAction } from "../../_actions/products";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Products" };

type Row = { id: string; title: string; handle: string; price: number | null; stock: number; track_stock: boolean; status: string; image: string; tint: string; categories: string[] };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; stockchanged?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const show = ["low", "draft"].includes(sp.show ?? "") ? sp.show! : "";
  const like = `%${q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await sql<Row>(
    `select id, title, handle, price, stock, track_stock, status, image, tint, categories from shop.products
      where ($1 = '' or lower(title) like $2 or handle like $2)
        and ($3 = '' or ($3 = 'draft' and status = 'draft') or ($3 = 'low' and track_stock and stock <= 3 and status = 'active'))
      order by status, rank, title`,
    [q, like, show],
  );

  return (
    <>
      <PageTitle
        title="Products"
        hint="Change a price or the stock right in the list and press Save on that row. Leave a price empty to show no price: customers then ask for it on WhatsApp. Click a name to edit everything else."
        actions={<Link href="/admin/products/new" className={buttonClass("primary")}>Add a product</Link>}
      />
      {sp.stockchanged && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          The price was saved, but the stock number was not: customers bought some while this page was open, so the figures below are now up to date. Check the stock and save again if you still want to change it.
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TabLink href="/admin/products" active={!show}>All</TabLink>
        <TabLink href="/admin/products?show=low" active={show === "low"}>Running low</TabLink>
        <TabLink href="/admin/products?show=draft" active={show === "draft"}>Drafts</TabLink>
        <form className="ml-auto flex gap-2" action="/admin/products">
          {show && <input type="hidden" name="show" value={show} />}
          <input name="q" defaultValue={q} placeholder="Search products" maxLength={60} className="w-56 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-stone-900" />
          <button className={buttonClass("secondary", "sm")}>Search</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState>Nothing here.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
              <tr>
                <th className="px-4 py-2.5">Product</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Price (₹)</th>
                <th className="px-4 py-2.5">In stock</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((p) => (
                <tr key={p.id} className="align-middle hover:bg-stone-50">
                  <td className="px-4 py-2">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: p.tint }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.image && <img src={p.image} alt="" className="size-9 object-contain" referrerPolicy="no-referrer" loading="lazy" />}
                      </span>
                      <span className="font-semibold underline-offset-4 hover:underline">{p.title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {p.status === "draft" ? <Badge tone="gray">Draft</Badge> : p.track_stock && p.stock === 0 ? <Badge tone="red">Sold out</Badge> : p.track_stock && p.stock <= 3 ? <Badge tone="amber">Low</Badge> : <Badge tone="green">Live</Badge>}
                  </td>
                  <td colSpan={3} className="p-0">
                    <form action={quickEditAction} className="flex items-center gap-3 px-4 py-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="stock_was" value={p.stock} />
                      <input name="price" type="number" inputMode="numeric" min={0} max={1000000} defaultValue={p.price ?? ""} placeholder="no price" aria-label={`Price of ${p.title} (empty means no price is shown)`} className={`${inputClass} w-28`} />
                      {p.track_stock ? (
                        <input name="stock" type="number" inputMode="numeric" min={0} max={100000} defaultValue={p.stock} aria-label={`Stock of ${p.title}`} className={`${inputClass} w-24`} />
                      ) : (
                        <>
                          <input type="hidden" name="stock" value={p.stock} />
                          <span className="w-24 text-stone-500">not counted</span>
                        </>
                      )}
                      <SubmitButton kind="secondary" size="sm" pending="…">Save</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
