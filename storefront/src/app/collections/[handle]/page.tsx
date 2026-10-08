import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBanner } from "@/components/shop/PageBanner";
import { ShopBrowser } from "@/components/shop/ShopBrowser";
import { getCategories, getCategory, getProducts, getProductsInCategory } from "@/lib/catalog";

type Props = { params: Promise<{ handle: string }> };

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCategory((await params).handle);
  if (!c) return {};
  return { title: c.title, description: c.blurb, alternates: { canonical: `/collections/${c.handle}` } };
}

export default async function CollectionPage({ params }: Props) {
  const { handle } = await params;
  const [category, inShelf, products, categories] = await Promise.all([getCategory(handle), getProductsInCategory(handle), getProducts(), getCategories()]);
  if (!category) notFound();
  const cover = products.find((p) => p.handle === category.cover);
  const cutouts = [cover, ...inShelf.filter((p) => p.handle !== category.cover)].filter((p) => p !== undefined);

  return (
    <>
      <PageBanner
        eyebrow={`${inShelf.length} ${inShelf.length === 1 ? "gift" : "gifts"} on this shelf`}
        title={category.title}
        blurb={category.blurb}
        tint={category.tint}
        cutouts={cutouts}
        crumbs={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
          { href: `/collections/${category.handle}`, label: category.title },
        ]}
      />
      <ShopBrowser products={products} categories={categories} initial={{}} lockShelf={category.handle} />
    </>
  );
}
