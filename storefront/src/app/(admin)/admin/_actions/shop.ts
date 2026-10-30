"use server";

import { revalidatePath, updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { requireAdmin } from "@/lib/server/admin-auth";
import { categoryForm, couponForm, popupForm, settingsForm, showPricesForm } from "@/lib/server/admin-schemas";
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

/** One switch for the whole shop: off hides every price and MRP, whatever each product's own switch says. */
export async function saveShowPricesAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const p = showPricesForm.safeParse({ show_prices: formData.get("show_prices") });
  if (!p.success) return { error: problem(p.error) };
  await sql("update shop.settings set show_prices = $1, updated_at = now() where id = 1", [p.data.show_prices]);
  refresh();
  revalidatePath("/admin/settings");
  return { ok: p.data.show_prices ? "Prices are shown on the shop (each product's own switch still applies)." : "No prices are shown anywhere on the shop. Customers ask on WhatsApp." };
}

// ── Sale popup ──────────────────────────────────────────────────────────────

export async function savePopupAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const p = popupForm.safeParse({
    enabled: formData.get("enabled"),
    label: formData.get("label") ?? "",
    title: formData.get("title") ?? "",
    text: formData.get("text") ?? "",
    button_text: formData.get("button_text") ?? "",
    button_url: formData.get("button_url") ?? "",
    image: formData.get("image") ?? "",
    tint: formData.get("tint") ?? "",
    delay: formData.get("delay") ?? "4",
    reshow_days: formData.get("reshow_days") ?? "1",
    ends_on: formData.get("ends_on") ?? "",
  });
  if (!p.success) return { error: problem(p.error) };
  const v = p.data;
  // popup_updated_at changes on every save: people who closed an older popup get to see this one.
  await sql(
    `update shop.settings set popup_enabled=$1, popup_label=$2, popup_title=$3, popup_text=$4, popup_button_text=$5, popup_button_url=$6, popup_image=$7,
            popup_tint=$8, popup_delay=$9, popup_reshow_days=$10, popup_ends_on=$11::date, popup_updated_at=now(), updated_at=now() where id = 1`,
    [v.enabled, v.label, v.title, v.text, v.button_text, v.button_url, v.image, v.tint, v.delay, v.reshow_days, v.ends_on],
  );
  refresh();
  revalidatePath("/admin/popup");
  return { ok: v.enabled ? "Saved. The popup is ON: visitors see it on the shop within a minute." : "Saved. The popup is OFF." };
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
  const was = String(formData.get("old_handle") ?? c.handle);
  if (!creating && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(was)) return { error: "Shelf not found." };
  if (c.cover && !(await sql("select 1 from shop.products where handle = $1", [c.cover])).length) return { error: "That cover product doesn't exist." };
  try {
    if (creating) {
      await sql("insert into shop.categories (handle, title, blurb, cover, tint, sort) values ($1,$2,$3,$4,$5,$6)", [c.handle, c.title, c.blurb, c.cover, c.tint, c.sort]);
    } else {
      // Changing the web address moves the products on this shelf over to the new address in the same step, so none are left behind.
      const [row] = await sql<{ n: number }>(
        `with moved as (update shop.categories set handle=$2, title=$3, blurb=$4, cover=$5, tint=$6, sort=$7 where handle=$1 returning handle),
              fixed as (update shop.products set categories = array_replace(categories, $1, $2) where $1 <> $2 and $1 = any(categories) and exists (select 1 from moved) returning 1)
         select (select count(*) from moved)::int as n`,
        [was, c.handle, c.title, c.blurb, c.cover, c.tint, c.sort],
      );
      if (!row.n) return { error: "Shelf not found." };
    }
  } catch (e) {
    if (isUnique(e)) return { error: "A shelf with that web address already exists." };
    throw e;
  }
  refresh();
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  return { ok: creating ? "Shelf added." : was !== c.handle ? "Saved. The shelf has a new web address; its products moved with it." : "Saved." };
}

/** Deletes a shelf. Products on it stay in the shop; they just lose this shelf. */
export async function deleteCategoryAction(formData: FormData) {
  await requireAdmin();
  const handle = String(formData.get("handle") ?? "");
  if (!/^[a-z0-9-]{1,60}$/.test(handle)) return;
  await sql(
    `with gone as (delete from shop.categories where handle = $1 returning handle)
     update shop.products set categories = array_remove(categories, $1) where $1 = any(categories) and exists (select 1 from gone)`,
    [handle],
  );
  refresh();
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
}
