"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckIcon, PlusIcon } from "@phosphor-icons/react";
import { WishlistButton } from "./WishlistButton";
import { useAddToBag } from "@/lib/useAddToBag";
import { cx, discountPercent, formatPrice, hasPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

const badgeTones = ["bg-sun text-ink", "bg-ribbon text-white", "bg-ink text-white", "bg-white text-ink"];

export function ProductCard({ product, priority, index = 0 }: { product: Product; priority?: boolean; index?: number }) {
  const tileRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [added, setAdded] = useState(false);
  const add = useAddToBag();

  // A gentle 3D lean toward the pointer, written straight to CSS variables.
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = tileRef.current!;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`);
    el.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 14}deg`);
  };
  const onLeave = () => {
    tileRef.current?.style.setProperty("--rx", "0deg");
    tileRef.current?.style.setProperty("--ry", "0deg");
  };

  const onAdd = async () => {
    await add(product, { from: imgRef.current });
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <article className="group">
      <div
        ref={tileRef}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] [perspective:900px]"
        style={{ background: product.tint }}
      >
        <span aria-hidden className="dots absolute inset-0 opacity-50 [--dot-gap:20px] [--dot-size:1.8px]" />
        <Link href={`/products/${product.handle}`} className="absolute inset-0" aria-label={product.title}>
          <span
            aria-hidden
            className="absolute bottom-[11%] left-1/2 h-5 w-1/2 -translate-x-1/2 rounded-[50%] bg-ink/20 blur-md transition duration-500 group-hover:w-[38%] group-hover:opacity-60"
          />
          <span className="absolute inset-[9%] block transition-transform duration-500 [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] [transform-style:preserve-3d]">
            <Image
              ref={imgRef}
              src={product.image}
              alt={product.title}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
              className="product-shadow object-contain transition duration-500 [transition-timing-function:var(--ease-spring)] group-hover:-translate-y-3 group-hover:-rotate-3 group-hover:scale-[1.06]"
            />
          </span>
        </Link>

        {product.badge && (
          <span
            className={cx(
              "pointer-events-none absolute top-3 left-3 -rotate-6 rounded-full px-3 py-1 font-display text-xs font-bold shadow-[0_3px_0_rgb(30_27_46/0.15)] transition group-hover:rotate-0",
              badgeTones[index % badgeTones.length],
            )}
          >
            {product.badge}
          </span>
        )}
        <WishlistButton handle={product.handle} title={product.title} className="absolute top-3 right-3" />

        {product.inStock ? (
          <button
            onClick={onAdd}
            aria-label={`Add ${product.title} to bag`}
            className={cx(
              "absolute right-3 bottom-3 flex h-11 items-center justify-center overflow-hidden rounded-full font-bold whitespace-nowrap text-white shadow-[0_4px_0_rgb(30_27_46/0.25)] transition-all duration-300 [transition-timing-function:var(--ease-spring)]",
              added ? "w-11 bg-lagoon-600" : "w-11 bg-ink hover:bg-ribbon md:group-hover:w-[8.5rem]",
            )}
          >
            {added ? (
              <CheckIcon size={20} weight="bold" />
            ) : (
              <span className="flex items-center gap-1.5 px-3">
                <PlusIcon size={18} weight="bold" className="shrink-0" />
                <span className="hidden text-sm md:group-hover:inline">Add to bag</span>
              </span>
            )}
          </button>
        ) : (
          <span className="absolute right-3 bottom-3 rounded-full bg-white px-3 py-1.5 text-xs font-bold">Sold out</span>
        )}
      </div>

      <div className="mt-3 px-1">
        <h3 className="text-[15px] leading-snug font-bold">
          <Link href={`/products/${product.handle}`} className="decoration-ribbon decoration-2 underline-offset-4 hover:underline">
            {product.title}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-1 text-sm text-ink-2">{product.subtitle}</p>
        {hasPrice(product) && (
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-lg font-extrabold">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <>
                <span className="text-sm text-ink-3 line-through decoration-ribbon/70">
                  <span className="sr-only">MRP </span>
                  {formatPrice(product.compareAtPrice)}
                </span>
                <span className="rounded-full bg-lagoon-100 px-2 py-0.5 text-xs font-bold text-lagoon-800">{discountPercent(product.price, product.compareAtPrice)}% off</span>
              </>
            )}
          </p>
        )}
      </div>
    </article>
  );
}
