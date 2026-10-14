"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CATALOG_TAG } from "@/lib/catalog";
import { requireAdmin } from "@/lib/server/admin-auth";
import { productForm, quickEdit } from "@/lib/server/admin-schemas";
import { sql } from "@/lib/server/db";
import type { FormState } from "./auth";

const refresh = () => {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
};

const COLUMNS = "title, handle, subtitle, description, price, compare_at, categories, recipients, occasions, details, tint, badge, rank, is_new, status, track_stock, stock, image, studio, shelf, image_fit";

function fromForm(formData: FormData) {
  return productForm.safeParse({
    title: formData.get("title") ?? "",
    handle: formData.get("handle") ?? "",
    subtitle: formData.get("subtitle") ?? "",
    description: formData.get("description") ?? "",
    price: formData.get("price"),
    compare_at: formData.get("compare_at") ?? "",
    categories: formData.getAll("categories").map(String),
    recipients: formData.getAll("recipients").map(String),
    occasions: formData.getAll("occasions").map(String),
    details: formData.get("details") ?? "",
    tint: formData.get("tint") ?? "",
    badge: formData.get("badge") ?? "",
    rank: formData.get("rank") ?? "100",
    is_new: formData.get("is_new"),
    status: formData.get("status") ?? "active",
    track_stock: formData.get("track_stock"),
    stock: formData.get("stock") ?? "0",
    image: formData.get("image") ?? "",
    studio: formData.get("studio") ?? "",
    shelf: formData.get("shelf") ?? "",
    image_fit: formData.get("image_fit") ?? "cover",
  });
}

const firstProblem = (e: { issues: { path: PropertyKey[]; message: string }[] }) => {
  const i = e.issues[0];
  const field = String(i.path[0] ?? "").replace(/_/g, " ");
  return field ? `${field[0].toUpperCase()}${field.slice(1)}: ${i.message}` : i.message;
};

async function knownCategories(handles: string[]) {
  if (!handles.length) return true;
  const rows = await sql<{ n: number }>("select count(*)::int as n from shop.categories where handle = any($1)", [handles]);
  return rows[0].n === new Set(handles).size;
}

const isUnique = (e: unknown) => e instanceof Error && "code" in e && (e as { code?: string }).code === "23505";

export async function createProductAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const p = fromForm(formData);
  if (!p.success) return { error: firstProblem(p.error) };
  const v = p.data;
  if (!v.handle) return { error: "Give the product a name so it gets a web address." };
  if (!(await knownCategories(v.categories))) return { error: "One of the chosen shelves doesn't exist." };
  let id: string;
  try {
    const [row] = await sql<{ id: string }>(
      `insert into shop.products (${COLUMNS}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) returning id`,
      [v.title, v.handle, v.subtitle, v.description, v.price, v.compare_at, v.categories, v.recipients, v.occasions, v.details, v.tint, v.badge, v.rank, v.is_new, v.status, v.track_stock, v.stock, v.image, v.studio, v.shelf, v.image_fit],
    );
    id = row.id;
  } catch (e) {
    if (isUnique(e)) return { error: "Another product already uses that web address. Change the name or the address." };
    throw e;
  }
  refresh();
  redirect(`/admin/products/${id}?saved=1`);
}

export async function updateProductAction(id: string, _: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: "Product not found." };
  const p = fromForm(formData);
  if (!p.success) return { error: firstProblem(p.error) };
  const v = p.data;
  if (!(await knownCategories(v.categories))) return { error: "One of the chosen shelves doesn't exist." };
  const current = await sql<{ handle: string; hidden: boolean }>("select handle, hidden from shop.products where id = $1", [id]);
  if (!current[0]) return { error: "Product not found." };
  // The gift-wrap service is found by its address, so that address stays put, and it can never be saved as a draft.
  const handle = current[0].hidden ? current[0].handle : v.handle;
  const status = current[0].hidden ? "active" : v.status;
  // The stock the owner SAW when the page opened. If customers have bought some since, saving would silently bring the
  // sold units back, so a stock figure that differs from what is now in the shop is only accepted when it was left alone.
  const was = z.coerce.number().int().min(0).max(100000).safeParse(formData.get("stock_was"));
  const stockWas = was.success ? was.data : null;
  try {
    const rows = await sql(
      `update shop.products set title=$2, handle=$3, subtitle=$4, description=$5, price=$6, compare_at=$7, categories=$8, recipients=$9, occasions=$10,
              details=$11, tint=$12, badge=$13, rank=$14, is_new=$15, status=$16, track_stock=$17,
              stock = case when $23::int is not null and $18 = $23 then stock else $18 end,
              image=$19, studio=$20, shelf=$21, image_fit=$22
        where id = $1 and ($23::int is null or $18 = $23 or stock = $23)
        returning id`,
      [id, v.title, handle, v.subtitle, v.description, v.price, v.compare_at, v.categories, v.recipients, v.occasions, v.details, v.tint, v.badge, v.rank, v.is_new, status, v.track_stock, v.stock, v.image, v.studio, v.shelf, v.image_fit, stockWas],
    );
    if (!rows.length) return { error: "The stock changed while you were editing (customers have bought some). Nothing was saved. Reload this page and try again." };
  } catch (e) {
    if (isUnique(e)) return { error: "Another product already uses that web address." };
    throw e;
  }
  refresh();
  revalidatePath("/admin/products");
  return { ok: "Saved. The shop shows it within moments." };
}

/** Price and stock edited straight from the products list. */
export async function quickEditAction(formData: FormData) {
  await requireAdmin();
  const p = quickEdit.safeParse(Object.fromEntries(formData));
  if (!p.success) return;
  // The price is always saved. The stock figure is only applied if it is still what the owner saw (or was left alone),
  // otherwise it would undo sales made since the page opened.
  const [row] = await sql<{ conflict: boolean }>(
    `with cur as (select stock from shop.products where id = $1 for update)
     update shop.products p
        set price = $2::int,
            stock = case when $3::int = $4::int then p.stock when cur.stock = $4::int then $3::int else p.stock end
       from cur
      where p.id = $1
      returning ($3::int <> $4::int and cur.stock <> $4::int) as conflict`,
    [p.data.id, p.data.price, p.data.stock, p.data.stock_was],
  );
  refresh();
  revalidatePath("/admin/products");
  if (row?.conflict) redirect("/admin/products?stockchanged=1");
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  // Past orders keep their own copy of the name, price and photo, so deleting a product never changes history.
  await sql("delete from shop.products where id = $1 and not hidden", [id]);
  refresh();
  redirect("/admin/products");
}
