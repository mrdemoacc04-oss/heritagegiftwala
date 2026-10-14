import { PageTitle } from "@/components/admin/ui";
import { ProductForm, blankProduct } from "@/components/admin/ProductForm";
import { sql } from "@/lib/server/db";
import { createProductAction } from "../../../_actions/products";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Add a product" };

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await sql<{ handle: string; title: string }>("select handle, title from shop.categories order by sort, title");
  return (
    <>
      <PageTitle title="Add a product" hint="Fill in the name, price and a photo. Everything else is optional and can be changed later." />
      <ProductForm action={createProductAction} initial={blankProduct} categories={categories} submitLabel="Add product" />
    </>
  );
}
