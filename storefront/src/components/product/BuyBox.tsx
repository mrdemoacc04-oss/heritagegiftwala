"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, GiftIcon, HandbagSimpleIcon, LightningIcon, MinusIcon, PlusIcon, TruckIcon, TagIcon, StorefrontIcon } from "@phosphor-icons/react";
import { WishlistButton } from "./WishlistButton";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { useAddToBag } from "@/lib/useAddToBag";
import { cx, formatPrice } from "@/lib/format";
import { papers, ribbons } from "@/lib/wrap";
import type { Product } from "@/lib/types";

export function BuyBox({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const [wrapOn, setWrapOn] = useState(false);
  const [paper, setPaper] = useState(papers[0].id);
  const [ribbon, setRibbon] = useState(ribbons[0].id);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);
  const { giftWrap, settings } = useCatalog();
  const freeFrom = settings.freeShippingFrom;
  const add = useAddToBag();
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const addAll = async () => {
    const img = document.querySelector<HTMLImageElement>(`img[alt="${CSS.escape(product.title)}"]`);
    await add(product, { from: img ?? buttonRef.current, quantity: qty });
    if (wrapOn && giftWrap) await add(giftWrap, { quantity: qty, wrap: { paper, ribbon, note: note.trim() }, silent: true });
  };

  const onAdd = async () => {
    await addAll();
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const onBuyNow = async () => {
    await addAll();
    router.push("/checkout");
  };

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-4xl font-extrabold">{formatPrice(product.price)}</span>
        {product.compareAtPrice && <span className="text-lg text-ink-3 line-through">{formatPrice(product.compareAtPrice)}</span>}
        <span className="flex items-center gap-1 rounded-full bg-lagoon-100 px-3 py-1 text-xs font-bold text-lagoon-800">
          <TagIcon size={13} weight="bold" /> Fix rate
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-3">Inclusive of all taxes</p>

      {/* gift wrap */}
      {giftWrap && (
        <div className={cx("mt-7 rounded-3xl border-2 transition", wrapOn ? "border-ink bg-white" : "border-dashed border-ink/25")}>
          <label className="flex cursor-pointer items-center gap-3 p-4">
            <input type="checkbox" checked={wrapOn} onChange={(e) => setWrapOn(e.target.checked)} className="peer sr-only" />
            <span className={cx("grid size-7 shrink-0 place-items-center rounded-lg border-2 border-ink transition peer-focus-visible:ring-4 peer-focus-visible:ring-lagoon", wrapOn && "bg-ink text-white")}>
              {wrapOn && <CheckIcon size={15} weight="bold" />}
            </span>
            <GiftIcon size={22} weight="duotone" className="text-ribbon" />
            <span className="flex-1 font-bold">
              Gift wrap it <span className="font-normal text-ink-2">with a handwritten tag</span>
            </span>
            <span className="font-display font-extrabold">+{formatPrice(giftWrap.price)}</span>
          </label>
          <AnimatePresence initial={false}>
            {wrapOn && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="space-y-4 px-4 pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {papers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPaper(p.id)}
                        aria-label={p.name}
                        aria-pressed={paper === p.id}
                        title={p.name}
                        className={cx("size-10 rounded-xl border-[3px] transition", paper === p.id ? "scale-110 border-ink" : "border-white shadow-sm")}
                        style={p.style}
                      />
                    ))}
                    <span className="mx-1 h-6 w-px bg-line" />
                    {ribbons.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRibbon(r.id)}
                        aria-label={`${r.name} ribbon`}
                        aria-pressed={ribbon === r.id}
                        title={r.name}
                        className={cx("size-7 rounded-full border-[3px] transition", ribbon === r.id ? "scale-110 border-ink" : "border-ink/15")}
                        style={{ background: r.color }}
                      />
                    ))}
                  </div>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 90))}
                    placeholder="Write the tag: Happy birthday, Didi!"
                    aria-label="Message for the gift tag"
                    className="w-full rounded-2xl border-2 border-ink/20 bg-cream px-4 py-2.5 font-hand text-xl outline-none focus:border-ink"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
          ref={buttonRef}
          onClick={onAdd}
          disabled={!product.inStock}
          className={cx(
            "group flex h-14 flex-1 items-center justify-center gap-2 rounded-full px-6 text-lg font-bold text-white transition active:translate-y-1 disabled:opacity-40",
            added ? "bg-lagoon-600 shadow-[0_6px_0_var(--color-lagoon-800)]" : "bg-ribbon shadow-[0_6px_0_var(--color-ribbon-700)] hover:bg-ribbon-700",
          )}
        >
          {added ? <CheckIcon size={20} weight="bold" /> : <HandbagSimpleIcon size={20} weight="bold" className="transition group-hover:-rotate-12" />}
          {!product.inStock ? "Sold out" : added ? "Added to bag" : "Add to bag"}
        </button>
        <WishlistButton handle={product.handle} title={product.title} className="relative size-14 border-2 border-ink bg-white" />
      </div>
      <button
        onClick={onBuyNow}
        disabled={!product.inStock}
        className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-sun py-3.5 font-bold transition hover:-translate-y-0.5 hover:shadow-[0_4px_0_var(--color-ink)] disabled:opacity-40"
      >
        <LightningIcon size={18} weight="fill" /> Buy it now
      </button>

      <ul className="mt-7 grid gap-3 text-sm font-semibold sm:grid-cols-3">
        <li className="flex items-center gap-2 rounded-2xl bg-white p-3">
          <GiftIcon size={22} weight="duotone" className="shrink-0 text-ribbon" /> Wrapped by hand
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-white p-3">
          <TruckIcon size={22} weight="duotone" className="shrink-0 text-lagoon-600" />
          {freeFrom > 0 ? `Free delivery over ${formatPrice(freeFrom)}` : "Delivered to your door"}
        </li>
        <li className="flex items-center gap-2 rounded-2xl bg-white p-3">
          <StorefrontIcon size={22} weight="duotone" className="shrink-0 text-[#c58a00]" /> From a real shop
        </li>
      </ul>

      {/* sticky bar on phones */}
      <div className="pdp-sticky fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-cream/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{product.title}</p>
          <p className="font-display font-extrabold">{formatPrice(product.price)}</p>
        </div>
        <button onClick={onAdd} disabled={!product.inStock} className="flex h-12 items-center gap-2 rounded-full bg-ribbon px-5 font-bold text-white disabled:opacity-40">
          {added ? <CheckIcon size={18} weight="bold" /> : <HandbagSimpleIcon size={18} weight="bold" />}
          {added ? "Added" : "Add to bag"}
        </button>
      </div>
    </div>
  );
}
