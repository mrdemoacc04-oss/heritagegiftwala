"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-auth";
import { trackingForm } from "@/lib/server/admin-schemas";
import { friendlyOrderError, shopError, sql } from "@/lib/server/db";
import { orderInput } from "@/lib/server/schemas";
import { clean } from "@/lib/server/schemas";
import { CATALOG_TAG } from "@/lib/catalog";
import { updateTag } from "next/cache";
import type { FormState } from "./auth";

const uuid = z.uuid();
const STATUSES = z.enum(["placed", "packed", "shipped", "delivered", "cancelled"]);

function done(id: string) {
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function setStatusAction(formData: FormData) {
  await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const status = STATUSES.safeParse(formData.get("status"));
  if (!id.success || !status.success) return;
  try {
    await sql("select shop.set_order_status($1, $2)", [id.data, status.data]);
  } catch (e) {
    if (!shopError(e)) throw e;
  }
  // Cancelling puts stock back, so the storefront needs to hear about it.
  if (status.data === "cancelled") updateTag(CATALOG_TAG);
  done(id.data);
}

export async function setPaymentAction(formData: FormData) {
  await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const status = z.enum(["pending", "paid", "refunded"]).safeParse(formData.get("payment_status"));
  if (!id.success || !status.success) return;
  await sql("update shop.orders set payment_status = $2 where id = $1", [id.data, status.data]);
  done(id.data);
}

export async function saveTrackingAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const p = trackingForm.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Please check the courier details." };
  await sql("update shop.orders set courier = $2, tracking_number = $3, tracking_url = $4 where id = $1", [p.data.id, p.data.courier, p.data.tracking_number, p.data.tracking_url]);
  done(p.data.id);
  return { ok: "Saved. Customers see this when they track the order." };
}

export async function saveNoteAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "Order not found." };
  const note = clean(String(formData.get("note") ?? ""), true).slice(0, 1000);
  await sql("update shop.orders set admin_note = $2 where id = $1", [id.data, note]);
  done(id.data);
  return { ok: "Note saved." };
}

/** An order the owner takes by phone, WhatsApp or in the shop. It goes through the same pricing and stock rules as a web order. */
export async function createOrderAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const items = formData
    .getAll("product_id")
    .map((id, i) => ({ product_id: String(id), quantity: Number(formData.getAll("quantity")[i]) }))
    .filter((l) => l.product_id !== "");
  const parsed = orderInput.safeParse({
    items,
    shipping: formData.get("shipping"),
    coupon: String(formData.get("coupon") ?? "").trim() || null,
    contact: {
      email: formData.get("email"),
      phone: formData.get("phone"),
      name: formData.get("name"),
      address1: formData.get("address1"),
      address2: formData.get("address2") ?? "",
      city: formData.get("city"),
      state: formData.get("state") ?? "",
      pincode: formData.get("pincode"),
    },
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: i.path[0] === "items" ? "Add at least one product, with a quantity from 1 to 20." : `Please check the ${String(i.path.at(-1) ?? "details").replace(/_/g, " ")}.` };
  }
  const { items: lines, shipping, coupon, contact } = parsed.data;
  let number: string;
  let id: string;
  try {
    const [row] = await sql<{ r: { id: string; number: string } }>("select shop.place_order($1::jsonb) as r", [JSON.stringify({ items: lines, shipping, coupon, ...contact, source: "admin" })]);
    ({ number, id } = row.r);
  } catch (e) {
    const err = shopError(e);
    if (!err) throw e;
    return { error: friendlyOrderError(err.code, err.detail) };
  }
  if (formData.get("paid") === "on") await sql("update shop.orders set payment_status = 'paid' where id = $1", [id]);
  updateTag(CATALOG_TAG);
  done(id);
  redirect(`/admin/orders/${id}?created=${number}`);
}
