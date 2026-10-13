import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * Guest order tracking for the storefront's /track page.
 *
 *   POST /store/track-order   { "order_number": "1042", "email": "asha@example.com" }
 *
 * Medusa only lets signed-in customers read their orders, but this shop sells to guests, so
 * the order number plus the email used at checkout acts as the key. Only what a customer
 * needs to follow their parcel is returned: no phone number or street address.
 * A wrong number and a wrong email give the same answer, so nobody can probe for orders.
 */

type Hit = { count: number; resetAt: number };
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 20;
const hits = new Map<string, Hit>();

function tooMany(key: string) {
  const now = Date.now();
  const hit = hits.get(key);
  if (!hit || hit.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 5000) for (const [k, h] of hits) if (h.resetAt < now) hits.delete(k);
    return false;
  }
  hit.count += 1;
  return hit.count > MAX_TRIES;
}

const NOT_FOUND = { message: "We couldn't find an order with that number and email. Please check both and try again." };

const sum = (rows: Array<number | null | undefined>) => rows.reduce<number>((n, v) => n + Number(v ?? 0), 0);
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body ?? {}) as { order_number?: unknown; email?: unknown };
  const displayId = Number(String(body.order_number ?? "").replace(/[^\d]/g, ""));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!Number.isSafeInteger(displayId) || displayId < 1 || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: "Enter your order number and the email you used at checkout." });
  }
  if (tooMany(req.ip ?? "unknown")) {
    return res.status(429).json({ message: "Too many tries. Please wait a few minutes and try again." });
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "status",
      "created_at",
      "canceled_at",
      "currency_code",
      "subtotal",
      "shipping_total",
      "total",
      "shipping_address.first_name",
      "shipping_address.city",
      "shipping_methods.name",
      "items.id",
      "items.title",
      "items.product_title",
      "items.thumbnail",
      "items.quantity",
      "items.unit_price",
      "items.metadata",
      "items.detail.fulfilled_quantity",
      "items.detail.shipped_quantity",
      "items.detail.delivered_quantity",
      "fulfillments.created_at",
      "fulfillments.packed_at",
      "fulfillments.shipped_at",
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "fulfillments.labels.tracking_number",
      "fulfillments.labels.tracking_url",
      "payment_collections.status",
    ],
    // display_id is an integer column; the generated query types call it a string.
    filters: { display_id: displayId as unknown as string },
  });

  const order = orders[0];
  if (!order || order.email?.trim().toLowerCase() !== email) {
    return res.status(404).json(NOT_FOUND);
  }

  const items = (order.items ?? []).filter((i): i is NonNullable<typeof i> => Boolean(i));
  const fulfillments = (order.fulfillments ?? []).filter((f): f is NonNullable<typeof f> => Boolean(f) && !f!.canceled_at);

  const total = sum(items.map((i) => i.quantity));
  const fulfilled = sum(items.map((i) => i.detail?.fulfilled_quantity));
  const shipped = sum(items.map((i) => i.detail?.shipped_quantity));
  const delivered = sum(items.map((i) => i.detail?.delivered_quantity));

  const cancelled = Boolean(order.canceled_at) || order.status === "canceled";
  const stage = cancelled
    ? "cancelled"
    : total > 0 && delivered >= total
      ? "delivered"
      : shipped > 0
        ? "shipped"
        : fulfilled > 0
          ? "packed"
          : "placed";

  const latest = (pick: (f: (typeof fulfillments)[number]) => unknown) =>
    fulfillments
      .map(pick)
      .filter(Boolean)
      .map((d) => new Date(d as string).getTime())
      .sort((a, b) => b - a)[0];

  const tracking = fulfillments.flatMap((f) =>
    (f.labels ?? [])
      .filter((l): l is NonNullable<typeof l> => Boolean(l?.tracking_number || l?.tracking_url))
      .map((l) => ({ number: l.tracking_number || null, url: l.tracking_url || null })),
  );

  return res.json({
    order: {
      number: order.display_id,
      placed_at: iso(order.created_at),
      stage,
      packed_at: iso(latest((f) => f.packed_at ?? f.created_at)),
      shipped_at: iso(latest((f) => f.shipped_at)),
      delivered_at: iso(latest((f) => f.delivered_at)),
      cancelled_at: iso(order.canceled_at),
      first_name: order.shipping_address?.first_name ?? null,
      city: order.shipping_address?.city ?? null,
      delivery: order.shipping_methods?.[0]?.name ?? null,
      tracking,
      paid: (order.payment_collections ?? []).some((p) => p?.status === "completed"),
      items: items.map((i) => ({
        title: i.product_title || i.title,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        thumbnail: i.thumbnail ?? null,
        tint: (i.metadata as Record<string, string> | null)?.tint ?? null,
        gift_wrapped: Boolean((i.metadata as Record<string, string> | null)?.wrap_paper),
      })),
      subtotal: Number(order.subtotal),
      shipping_total: Number(order.shipping_total),
      total: Number(order.total),
    },
  });
}
