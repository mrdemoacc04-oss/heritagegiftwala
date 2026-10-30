import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRightIcon, PlusIcon } from "@phosphor-icons/react/ssr";
import { ProductGallery } from "@/components/product/ProductGallery";
import { BuyBox } from "@/components/product/BuyBox";
import { ProductCard } from "@/components/product/ProductCard";
import { getCategories, getPairings, getProduct, getProducts } from "@/lib/catalog";
import { hasPrice, jsonLdString } from "@/lib/format";
import { site } from "@/lib/site";

type Props = { params: Promise<{ handle: string }> };

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).handle);
  if (!p || p.hidden) return {};
  // WhatsApp, Instagram and Google build their link cards from these, so a product link shows its photo and name.
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/products/${p.handle}` },
    openGraph: { type: "website", title: p.title, description: p.subtitle || p.description, url: `/products/${p.handle}`, images: [p.studio || p.image || "/brand/og.jpg"] },
  };
}

const occasionLabel: Record<string, string> = {
  birthday: "Birthdays",
  anniversary: "Anniversaries",
  festive: "Diwali & festivals",
  housewarming: "Housewarmings",
  "thank-you": "Saying thank you",
  "just-because": "Just because",
};

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product || product.hidden) notFound();
  const [pairings, categories] = await Promise.all([getPairings(product), getCategories()]);
  const shelf = categories.find((c) => product.categories.includes(c.handle));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: [product.studio, product.image].filter(Boolean).map((src) => (/^https?:\/\//.test(src!) ? src : `${site.url}${src}`)),
    brand: { "@type": "Brand", name: site.name },
    // Only products with a price carry an offer: the rest are quoted on WhatsApp.
    ...(hasPrice(product)
      ? {
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "INR",
            availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `${site.url}/products/${product.handle}`,
          },
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <div className="mx-auto max-w-[1400px] px-4 pt-4 pb-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-1 text-sm font-semibold text-ink-2">
          <Link href="/" className="hover:text-ink">Home</Link>
          <CaretRightIcon size={12} weight="bold" />
          <Link href="/shop" className="hover:text-ink">Shop</Link>
          {shelf && (
            <>
              <CaretRightIcon size={12} weight="bold" />
              <Link href={`/collections/${shelf.handle}`} className="hover:text-ink">{shelf.title}</Link>
            </>
          )}
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductGallery product={product} />
          </div>

          <div>
            {shelf && (
              <Link href={`/collections/${shelf.handle}`} className="inline-block rounded-full px-3 py-1 text-sm font-bold" style={{ background: shelf.tint }}>
                {shelf.title}
              </Link>
            )}
            <h1 className="mt-3 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[0.98] font-extrabold">{product.title}</h1>
            <p className="mt-2 text-lg font-semibold text-ink-2">{product.subtitle}</p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">{product.description}</p>
            {product.occasions.length > 0 && (
              <p className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-hand text-2xl text-ribbon">perfect for</span>
                {product.occasions.map((o) => (
                  <span key={o} className="rounded-full border-2 border-ink/15 bg-white px-3 py-1 font-semibold">
                    {occasionLabel[o] ?? o}
                  </span>
                ))}
              </p>
            )}

            <div className="mt-8">
              <BuyBox product={product} />
            </div>

            <div className="mt-10 divide-y-2 divide-dashed divide-line border-y-2 border-dashed border-line">
              {product.details.length > 0 && (
                <Accordion title="The details" open>
                  <ul className="list-inside list-disc space-y-1.5 marker:text-ribbon">
                    {product.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </Accordion>
              )}
              <Accordion title="Delivery">
                <p>{site.dispatchTime}.</p>
                <p className="mt-2">We confirm the delivery charge with you on WhatsApp before anything is sent. You can also pick it up from our shop in {site.address.city}.</p>
              </Accordion>
              <Accordion title="Returns">
                <p>{site.returnsNote}</p>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {pairings.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 pt-16 pb-24 sm:px-6 lg:pb-10">
          <p className="font-hand text-3xl text-ribbon">make it a bundle</p>
          <h2 className="mt-1 text-[clamp(2rem,4vw,3.2rem)] leading-none font-extrabold">Complete the gift</h2>
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 xl:gap-x-6">
            {pairings.map((p, i) => (
              <li key={p.handle}>
                <ProductCard product={p} index={i + 1} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Accordion({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group py-1">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-display text-xl font-extrabold [&::-webkit-details-marker]:hidden">
        {title}
        <span className="grid size-8 place-items-center rounded-full border-2 border-ink transition group-open:rotate-45 group-open:bg-ink group-open:text-white">
          <PlusIcon size={14} weight="bold" />
        </span>
      </summary>
      <div className="pb-5 text-ink-2">{children}</div>
    </details>
  );
}
