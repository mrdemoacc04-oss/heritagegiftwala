import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/admin/forms";
import { Badge, Card, Field, PageTitle, StatusBadge, buttonClass, inputClass, rupees, when } from "@/components/admin/ui";
import { sql } from "@/lib/server/db";
import { saveNoteAction, saveTrackingAction, setPaymentAction, setStatusAction } from "../../../_actions/orders";
import { requireAdmin } from "@/lib/server/admin-auth";

type Order = {
  id: string; number: string; source: string; email: string; phone: string; name: string; address1: string; address2: string; city: string; state: string; pincode: string;
  shipping_method: string; shipping_fee: number; subtotal: number; discount: number; total: number; coupon_code: string | null; payment_status: string; status: string;
  courier: string; tracking_number: string; tracking_url: string; admin_note: string; placed_at: string; packed_at: string | null; shipped_at: string | null; delivered_at: string | null; cancelled_at: string | null;
  customer_id: string | null;
};
type Item = { title: string; quantity: number; unit_price: number; image: string; tint: string; wrap: { paper?: string; ribbon?: string; note?: string } | null };

const NEXT: Record<string, { to: string; label: string } | undefined> = {
  placed: { to: "packed", label: "Mark as packed" },
  packed: { to: "shipped", label: "Mark as shipped" },
  shipped: { to: "delivered", label: "Mark as delivered" },
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [order] = await sql<Order>("select * from shop.orders where id = $1", [id]);
  if (!order) notFound();
  const items = await sql<Item>("select title, quantity, unit_price, image, tint, wrap from shop.order_items where order_id = $1 order by title", [id]);
  const created = (await searchParams).created;
  const next = NEXT[order.status];
  const open = order.status !== "cancelled" && order.status !== "delivered";
  const phone10 = order.phone.replace(/\D/g, "").slice(-10);

  return (
    <>
      <PageTitle
        title={`Order #${order.number}`}
        hint={`Placed ${when(order.placed_at)}${order.source === "admin" ? " · taken by hand" : ""}${order.customer_id ? " · signed-in customer" : ""}`}
        actions={<><StatusBadge status={order.status} /><Link href="/admin/orders" className={buttonClass("secondary", "sm")}>All orders</Link></>}
      />
      {created && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Order #{created} is in. Stock has been taken off.</p>}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="Items">
            <ul className="divide-y divide-stone-100">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ background: it.tint }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.image && <img src={it.image} alt="" className="size-10 object-contain" referrerPolicy="no-referrer" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{it.title}</span> <span className="text-stone-500">× {it.quantity}</span>
                    {it.wrap && (
                      <span className="block text-xs text-stone-600">
                        Gift wrap: {it.wrap.paper}, {it.wrap.ribbon} ribbon{it.wrap.note ? ` · note: “${it.wrap.note}”` : ""}
                      </span>
                    )}
                  </span>
                  <span className="font-semibold">{rupees(it.unit_price * it.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-stone-600">Subtotal</dt><dd>{rupees(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="flex justify-between"><dt className="text-stone-600">Coupon {order.coupon_code}</dt><dd>−{rupees(order.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-stone-600">{order.shipping_method === "express" ? "Express delivery" : "Standard delivery"}</dt><dd>{order.shipping_fee ? rupees(order.shipping_fee) : "Free"}</dd></div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-bold"><dt>Total (cash on delivery)</dt><dd>{rupees(order.total)}</dd></div>
            </dl>
          </Card>

          <Card title="Courier & tracking">
            <p className="mb-3 text-sm text-stone-600">What you enter here shows on the customer&apos;s tracking page.</p>
            <ActionForm action={saveTrackingAction} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={order.id} />
              <Field label="Courier"><input name="courier" defaultValue={order.courier} maxLength={80} placeholder="e.g. DTDC, India Post" className={inputClass} /></Field>
              <Field label="Tracking number"><input name="tracking_number" defaultValue={order.tracking_number} maxLength={80} className={inputClass} /></Field>
              <Field label="Tracking link (optional)" className="sm:col-span-2" hint="Must start with https://"><input name="tracking_url" defaultValue={order.tracking_url} maxLength={500} placeholder="https://" className={inputClass} /></Field>
              <div className="sm:col-span-2"><SubmitButton kind="secondary">Save courier details</SubmitButton></div>
            </ActionForm>
          </Card>

          <Card title="Your note (private)">
            <ActionForm action={saveNoteAction}>
              <input type="hidden" name="id" value={order.id} />
              <textarea name="note" defaultValue={order.admin_note} rows={3} maxLength={1000} className={inputClass} placeholder="Anything to remember about this order. Customers never see this." />
              <div className="mt-3"><SubmitButton kind="secondary">Save note</SubmitButton></div>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Progress">
            <ol className="mb-4 space-y-1.5 text-sm">
              <li>Placed <span className="text-stone-500">{when(order.placed_at)}</span></li>
              <li className={order.packed_at ? "" : "text-stone-400"}>Packed {order.packed_at && <span className="text-stone-500">{when(order.packed_at)}</span>}</li>
              <li className={order.shipped_at ? "" : "text-stone-400"}>Shipped {order.shipped_at && <span className="text-stone-500">{when(order.shipped_at)}</span>}</li>
              <li className={order.delivered_at ? "" : "text-stone-400"}>Delivered {order.delivered_at && <span className="text-stone-500">{when(order.delivered_at)}</span>}</li>
              {order.cancelled_at && <li className="text-red-700">Cancelled <span>{when(order.cancelled_at)}</span></li>}
            </ol>
            {open && (
              <div className="flex flex-wrap gap-2">
                {next && (
                  <form action={setStatusAction}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="status" value={next.to} />
                    <SubmitButton pending="Updating…">{next.label}</SubmitButton>
                  </form>
                )}
                <form action={setStatusAction}>
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <ConfirmButton message="Cancel this order? The items go back into stock.">Cancel order</ConfirmButton>
                </form>
              </div>
            )}
          </Card>

          <Card title="Payment">
            <p className="mb-3 text-sm">
              {order.payment_status === "paid" ? <Badge tone="green">Paid</Badge> : order.payment_status === "refunded" ? <Badge>Refunded</Badge> : <Badge tone="amber">Collect {rupees(order.total)} on delivery</Badge>}
            </p>
            <form action={setPaymentAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={order.id} />
              {order.payment_status !== "paid" && <button name="payment_status" value="paid" className={buttonClass("secondary", "sm")}>Mark as paid</button>}
              {order.payment_status === "paid" && <button name="payment_status" value="pending" className={buttonClass("secondary", "sm")}>Mark as not paid</button>}
              {order.payment_status === "paid" && <button name="payment_status" value="refunded" className={buttonClass("secondary", "sm")}>Mark as refunded</button>}
            </form>
          </Card>

          <Card title="Customer">
            <p className="font-semibold">{order.name}</p>
            <address className="mt-1 text-sm leading-relaxed text-stone-700 not-italic">
              {order.address1}{order.address2 ? `, ${order.address2}` : ""}<br />
              {order.city}, {order.state} {order.pincode}
            </address>
            <p className="mt-3 text-sm">
              <a className="underline underline-offset-4" href={`tel:+91${phone10}`}>{order.phone}</a>{" · "}
              <a className="underline underline-offset-4" href={`https://wa.me/91${phone10}`} target="_blank" rel="noreferrer noopener">WhatsApp</a>
            </p>
            <p className="mt-1 text-sm"><a className="underline underline-offset-4" href={`mailto:${order.email}`}>{order.email}</a></p>
          </Card>
        </div>
      </div>
    </>
  );
}
