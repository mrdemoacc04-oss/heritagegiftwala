"use server";

import { revalidatePath, updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { requireAdmin } from "@/lib/server/admin-auth";
import { categoryForm, couponForm, settingsForm } from "@/lib/server/admin-schemas";
import { sql } from "@/lib/server/db";
import type { FormState } from "./auth";

const refresh = () => {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
};
const isUnique = (e: unknown) => e instanceof Error && "code" in e && (e as { code?: string }).code === "23505";
const problem = (e: { issues: { path: PropertyKey[]; message: string }[] }) => {
  const i = e.issues[0];
  const field = String(i.path[0] ?? "").replace(/_/g, " ");
  return field ? `${field[0].toUpperCase()}${field.slice(1)}: ${i.message}` : i.message;
};

// ── Delivery fees ───────────────────────────────────────────────────────────

export async function saveSettingsAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const p = settingsForm.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: problem(p.error) };
  await sql("update shop.settings set shipping_flat = $1, shipping_express = $2, free_shipping_from = $3, updated_at = now() where id = 1", [p.data.shipping_flat, p.data.shipping_express, p.data.free_shipping_from]);
  refresh();
  return { ok: "Saved. New orders use these fees straight away." };
}

// ── Coupons ─────────────────────────────────────────────────────────────────

export async function createCouponAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const p = couponForm.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: problem(p.error) };
  const c = p.data;
  try {
    // An expiry date means "valid through the end of that day" in India.
    await sql(
      `insert into shop.coupons (code, kind, value, min_subtotal, max_uses, expires_at, once_per_email)
       values ($1,$2,$3,$4,$5, case when $6::text is null then null else ((($6::text)::date + 1)::timestamp at time zone 'Asia/Kolkata') end, $7)`,
      [c.code, c.kind, c.value, c.min_subtotal, c.max_uses, c.expires_on, c.once_per_email],
    );
  } catch (e) {
    if (isUnique(e)) return { error: "A coupon with that code already exists." };
    throw e;
  }
  revalidatePath("/admin/coupons");
  return { ok: `Coupon ${c.code} is live.` };
}

export async function toggleCouponAction(formData: FormData) {
  await requireAdmin();
  const code = String(formData.get("code") ?? "");
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return;
  await sql("update shop.coupons set active = not active where code = $1", [code]);
  revalidatePath("/admin/coupons");
}

export async function deleteCouponAction(formData: FormData) {
  await requireAdmin();
  const code = String(formData.get("code") ?? "");
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return;
  await sql("delete from shop.coupons where code = $1", [code]);
  revalidatePath("/admin/coupons");
}

// ── Shelves (categories) ────────────────────────────────────────────────────

export async function saveCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const p = categoryForm.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: problem(p.error) };
  const c = p.data;
  const creating = formData.get("mode") === "create";
  try {
    if (creating) {
      await sql("insert into shop.categories (handle, title, blurb, cover, tint, sort) values ($1,$2,$3,$4,$5,$6)", [c.handle, c.title, c.blurb, c.cover, c.tint, c.sort]);
    } else {
      const res = await sql("update shop.categories set title=$2, blurb=$3, cover=$4, tint=$5, sort=$6 where handle=$1 returning handle", [c.handle, c.title, c.blurb, c.cover, c.tint, c.sort]);
      if (!res.length) return { error: "Shelf not found." };
    }
  } catch (e) {
    if (isUnique(e)) return { error: "A shelf with that web address already exists." };
    throw e;
  }
  refresh();
  revalidatePath("/admin/categories");
  return { ok: creating ? "Shelf added." : "Saved." };
}

export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const handle = String(formData.get("handle") ?? "");
  if (!/^[a-z0-9-]{1,60}$/.test(handle)) return;
  const used = await sql<{ n: number }>("select count(*)::int as n from shop.products where $1 = any(categories)", [handle]);
  if (used[0].n > 0) return; // the page hides the button for shelves in use
  await sql("delete from shop.categories where handle = $1", [handle]);
  refresh();
  revalidatePath("/admin/categories");
}
