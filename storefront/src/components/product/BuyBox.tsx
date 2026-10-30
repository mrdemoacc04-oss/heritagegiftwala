"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { CheckIcon, GiftIcon, HandbagSimpleIcon, MinusIcon, PlusIcon, StorefrontIcon, TagIcon, TruckIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { WishlistButton } from "./WishlistButton";
import { useCart } from "@/lib/store/cart";
import { useAddToBag } from "@/lib/useAddToBag";
import { cx, formatPrice, hasPrice } from "@/lib/format";
import { site } from "@/lib/site";
import type { Product } from "@/lib/types";

export function BuyBox({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const add = useAddToBag();
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const whatsapp = Boolean(site.whatsapp);

  const addToBag = async (silent = false) => {
    const img = document.querySelector<HTMLImageElement>(`img[alt="${CSS.escape(product.title)}"]`);
    await add(product, { from: img ?? buttonRef.current, quantity: qty, silent });
  };

  const onAdd = async () => {
    await addToBag();
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  // "Buy" puts it in the bag and opens the details page, which ends in WhatsApp.
  // If it is already in the bag, the quantity chosen here is what is bought (tapping Buy twice never doubles it).
  const onBuy = async () => {
    const inBag = useCart.getState().lines.find((l) => l.productId === product.id);
    if (inBag) await useCart.getState().setQuantity(inBag.id, qty);
    else await addToBag(true);
    router.push("/checkout");
  };

  return (
    <div>
      {hasPrice(product) ? (
        <>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-4xl font-extrabold">{formatPrice(product.price)}</span>
            {product.compareAtPrice && <span className="text-lg text-ink-3 line-through">{formatPrice(product.compareAtPrice)}</span>}
            <span className="flex items-center gap-1 rounded-full bg-lagoon-100 px-3 py-1 text-xs font-bold text-lagoon-800">
              <TagIcon size={13} weight="bold" /> Fix rate
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-3">Inclusive of all taxes</p>
        </>
      ) : (
        <p className="flex items-start gap-2.5 rounded-2xl bg-lagoon-100 px-4 py-3 font-semibold">
          <WhatsappLogoIcon size={22} weight="fill" className="mt-0.5 shrink-0 text-lagoon-800" />
          Message us for today&apos;s price. We&apos;ll confirm it in the chat before anything is packed.
        </p>
      )}

      {/* quantity + actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex h-14 items-center rounded-full border-2 border-ink bg-white">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One less" className="grid size-12 place-items-center rounded-full hover:bg-cream">
            <MinusIcon size={16} weight="bold" />
          </button>
          <motion.span key={qty} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-8 text-center font-display text-lg font-extrabold" aria-live="polite">
            {qty}
          </motion.span>
          <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="One more" className="grid size-12 place-items-center rounded-full hover:bg-cream">
            <PlusIcon size={16} weight="bold" />
          </button>
        </div>
        <button
          onClick={onBuy}
          disabled={!product.inStock || !whatsapp}
          className="group flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#25d366] px-6 text-lg font-bold text-ink shadow-[0_6px_0_#128c4a] transition hover:bg-[#2fe173] active:translate-y-1 active:shadow-[0_2px_0_#128c4a] disabled:opacity-40"
        >
          <WhatsappLogoIcon size={22} weight="fill" className="transition group-hover:-rotate-12" />
          {product.inStock ? "Buy on WhatsApp" : "Sold out"}
        </button>
        <WishlistButton handle={product.handle} title={product.title} className="relative size-14 border-2 border-ink bg-white" />
      </div>
      <button
        ref={buttonRef}
        onClick={onAdd}
        disabled={!product.inStock}
        className={cx(
          "mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-full border-2 border-ink py-3.5 font-bold transition hover:-translate-y-0.5 hover:shadow-[0_4px_0_var(--color-ink)] disabled:opacity-40",
          added ? "bg-lagoon" : "bg-sun",
        )}
      >
        {added ? <CheckIcon size={18} weight="bold" /> : <HandbagSimpleIcon size={18} weight="bold" />}
        {added ? "Added to bag" : "Add to bag, keep shopping"}
      </button>
      <p className="mt-2 text-center text-sm text-ink-3">Order several things at once: add them to the bag, then send the whole list on WhatsApp.</p>

      <ul className="mt-7 grid gap-3 text-sm font-semibold sm:grid-cols-3">
        <li className="flex items-center gap-2 rounded-2xl bg-white p-3">
          <GiftIcon size={22} weight="duotone" className="shrink-0 text-ribbon" /> Wrapped by hand
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-white p-3">
          <TruckIcon size={22} weight="duotone" className="shrink-0 text-lagoon-600" /> Delivery confirmed in chat
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-white p-3">
          <StorefrontIcon size={22} weight="duotone" className="shrink-0 text-[#c58a00]" /> From a real shop
        </li>
      </ul>

      {/* sticky bar on phones */}
      <div className="pdp-sticky fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-cream/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{product.title}</p>
          <p className="font-display font-extrabold">{hasPrice(product) ? formatPrice(product.price) : "Price on WhatsApp"}</p>
        </div>
        <button onClick={onBuy} disabled={!product.inStock || !whatsapp} className="flex h-12 items-center gap-2 rounded-full bg-[#25d366] px-5 font-bold text-ink disabled:opacity-40">
          <WhatsappLogoIcon size={20} weight="fill" /> {product.inStock ? "Buy" : "Sold out"}
        </button>
      </div>
    </div>
  );
}
