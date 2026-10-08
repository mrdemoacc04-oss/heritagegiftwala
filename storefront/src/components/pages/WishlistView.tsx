"use client";

import Link from "next/link";
import { Panda } from "@/components/brand/Panda";
import { ProductCard } from "@/components/product/ProductCard";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { useWishlist } from "@/lib/store/wishlist";

export function WishlistView() {
  const handles = useWishlist((s) => s.handles);
  const { products } = useCatalog();
  const saved = handles.map((h) => products.find((p) => p.handle === h)).filter((p) => p !== undefined);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-10 sm:px-6">
      <p className="font-hand text-3xl text-ribbon">the someday shelf</p>
      <h1 className="mt-1 text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.95] font-extrabold">Your wishlist</h1>
      {saved.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Panda className="w-32" />
          <h2 className="mt-5 text-2xl font-extrabold">Nothing saved yet</h2>
          <p className="mt-1 text-ink-2">Tap the heart on anything you love and it&apos;ll wait for you here.</p>
          <Link href="/shop" className="mt-6 rounded-full bg-ink px-6 py-3 font-bold text-white hover:bg-ribbon">
            Browse gifts
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 xl:grid-cols-4 xl:gap-x-6">
          {saved.map((p, i) => (
            <li key={p.handle}>
              <ProductCard product={p} index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
