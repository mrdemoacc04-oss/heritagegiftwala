import { Hero } from "@/components/home/Hero";
import { RibbonCross } from "@/components/home/RibbonCross";
import { CategoryStickers } from "@/components/home/CategoryStickers";
import { ProductTabs } from "@/components/home/ProductTabs";
import { ShopVisit } from "@/components/home/ShopVisit";
import { ShopMap } from "@/components/brand/ShopMap";
import { GiftFinder } from "@/components/gifting/GiftFinder";
import { WrapStudio } from "@/components/gifting/WrapStudio";
import { HamperBuilder } from "@/components/gifting/HamperBuilder";
import { getCategories, getProducts } from "@/lib/catalog";
import { site } from "@/lib/site";

export default async function Home() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: site.name,
    url: site.url,
    logo: `${site.url}/brand/logo.png`,
    description: site.description,
    slogan: site.tagline,
    telephone: site.phone.tel,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${site.address.street}, ${site.address.landmark}`,
      addressLocality: site.address.city,
      addressRegion: site.address.state,
      postalCode: site.address.pincode,
      addressCountry: "IN",
    },
    geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
    hasMap: site.mapsUrl,
    priceRange: "₹₹",
    sameAs: [`https://instagram.com/${site.instagram}`],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero products={products} />
      <RibbonCross />
      <CategoryStickers categories={categories} products={products} />
      <ProductTabs products={products} />
      <section className="mx-auto max-w-[1400px] px-4 pt-28 sm:px-6 sm:pt-36">
        <GiftFinder />
      </section>
      <WrapStudio />
      <HamperBuilder />
      <ShopVisit>
        <ShopMap className="mt-24" />
      </ShopVisit>
    </>
  );
}
