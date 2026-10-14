import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmButton } from "@/components/admin/forms";
import { PageTitle, buttonClass } from "@/components/admin/ui";
import { ProductForm, type ProductValues } from "@/components/admin/ProductForm";
import { sql } from "@/lib/server/db";
import { deleteProductAction, updateProductAction } from "../../../_actions/products";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [p] = await sql<ProductValues & { id: string; compare_at: number | null }>("select * from shop.products where id = $1", [id]);
  if (!p) notFound();
  const categories = await sql<{ handle: string; title: string }>("select handle, title from shop.categories order by sort, title");
  const saved = (await searchParams).saved;

  return (
    <>
      <PageTitle
        title={p.title}
        actions={
          <>
            {p.status === "active" && !p.hidden && <Link href={`/products/${p.handle}`} target="_blank" className={buttonClass("secondary", "sm")}>View on shop ↗</Link>}
            <Link href="/admin/products" className={buttonClass("secondary", "sm")}>All products</Link>
          </>
        }
      />
      {saved && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Product added. It&apos;s live on the shop within moments.</p>}
      <ProductForm action={updateProductAction.bind(null, id)} initial={p} categories={categories} submitLabel="Save changes" stockWas={p.stock} />
      {!p.hidden && (
        <form action={deleteProductAction} className="mt-10 border-t border-stone-300 pt-6">
          <input type="hidden" name="id" value={p.id} />
          <p className="mb-2 text-sm text-stone-600">Deleting removes the product from the shop for good. Past orders keep their details. To hide it for now, set it to Draft instead.</p>
          <ConfirmButton message={`Delete “${p.title}” for good?`}>Delete this product</ConfirmButton>
        </form>
      )}
    </>
  );
}
