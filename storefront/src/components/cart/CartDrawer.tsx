"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { MinusIcon, PlusIcon, TrashIcon, WhatsappLogoIcon, XIcon } from "@phosphor-icons/react";
import { Panda } from "@/components/brand/Panda";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { cartCount, cartSubtotal, useCart } from "@/lib/store/cart";
import { useUI } from "@/lib/store/ui";
import { formatPrice, hasPrice } from "@/lib/format";
import { useAddToBag } from "@/lib/useAddToBag";
import type { CartLine } from "@/lib/types";

export function CartDrawer() {
  const open = useUI((s) => s.cartOpen);
  const setOpen = useUI((s) => s.setCartOpen);
  const lines = useCart((s) => s.lines);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = cartCount(lines);
  const subtotal = cartSubtotal(lines);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Your bag">
          <motion.button
            aria-label="Close bag"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            initial={{ x: "105%", rotate: 2 }}
            animate={{ x: 0, rotate: 0 }}
            exit={{ x: "105%", rotate: 2 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-paper shadow-2xl sm:inset-y-3 sm:right-3 sm:rounded-[2rem] sm:border-2 sm:border-ink"
          >
            <header className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="text-2xl font-extrabold">
                Your bag <span className="ml-1 rounded-full bg-sun px-2.5 py-0.5 align-middle text-sm font-bold">{count}</span>
              </h2>
              <button
                ref={closeRef}
                onClick={() => setOpen(false)}
                aria-label="Close bag"
                className="grid size-10 place-items-center rounded-full border-2 border-ink transition hover:rotate-90 hover:bg-ink hover:text-white"
              >
                <XIcon size={18} weight="bold" />
              </button>
            </header>

            {lines.length === 0 ? (
              <EmptyBag onClose={() => setOpen(false)} />
            ) : (
              <>
                <div data-lenis-prevent className="flex-1 overflow-y-auto overscroll-contain px-6 pb-4">
                  <ul className="space-y-3">
                    <AnimatePresence initial={false}>
                      {lines.map((line) => (
                        <LineRow key={line.id} line={line} />
                      ))}
                    </AnimatePresence>
                  </ul>
                  <AddOns />
                </div>
                <footer className="border-t-2 border-dashed border-line px-6 pt-4 pb-6">
                  {subtotal !== null && (
                    <div className="flex items-baseline justify-between">
                      <span className="text-ink-2">Items</span>
                      <span className="font-display text-2xl font-extrabold">{formatPrice(subtotal)}</span>
                    </div>
                  )}
                  <p className="mt-0.5 text-xs text-ink-3">{subtotal !== null ? "Delivery is worked out in the chat." : "We'll confirm the price and delivery in the chat."}</p>
                  <Link
                    href="/checkout"
                    onClick={() => setOpen(false)}
                    className="group mt-4 flex h-14 items-center justify-center gap-2 rounded-full bg-[#25d366] text-lg font-bold text-ink shadow-[0_6px_0_#128c4a] transition hover:bg-[#2fe173] active:translate-y-1 active:shadow-[0_2px_0_#128c4a]"
                  >
                    <WhatsappLogoIcon size={22} weight="fill" className="transition group-hover:-rotate-12" />
                    Order on WhatsApp
                  </Link>
                </footer>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function LineRow({ line }: { line: CartLine }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const setOpen = useUI((s) => s.setCartOpen);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60, height: 0, marginTop: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="flex gap-3 rounded-3xl border border-line bg-white p-2.5"
    >
      <Link
        href={`/products/${line.handle}`}
        onClick={() => setOpen(false)}
        className="grid size-20 shrink-0 place-items-center rounded-2xl"
        style={{ background: line.tint }}
      >
        {line.image && <Image src={line.image} alt="" width={80} height={80} className="product-shadow size-16 object-contain" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-snug font-bold">{line.title}</p>
          <button onClick={() => remove(line.id)} aria-label={`Remove ${line.title}`} className="-mt-0.5 -mr-0.5 rounded-full p-1.5 text-ink-3 hover:bg-ribbon-100 hover:text-ribbon">
            <TrashIcon size={16} />
          </button>
        </div>
        <div className="mt-auto flex items-center justify-between pt-1.5">
          <div className="flex items-center rounded-full border-2 border-ink">
            <button onClick={() => setQuantity(line.id, line.quantity - 1)} aria-label="One less" className="grid size-7 place-items-center rounded-full hover:bg-cream">
              <MinusIcon size={13} weight="bold" />
            </button>
            <motion.span key={line.quantity} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-6 text-center text-sm font-bold">
              {line.quantity}
            </motion.span>
            <button onClick={() => setQuantity(line.id, line.quantity + 1)} aria-label="One more" className="grid size-7 place-items-center rounded-full hover:bg-cream">
              <PlusIcon size={13} weight="bold" />
            </button>
          </div>
          {hasPrice(line) && <span className="font-display font-extrabold">{formatPrice(line.price * line.quantity)}</span>}
        </div>
      </div>
    </motion.li>
  );
}

function AddOns() {
  const { products } = useCatalog();
  const lines = useCart((s) => s.lines);
  const add = useAddToBag();
  const inBag = new Set(lines.map((l) => l.handle));
  // Small, easy extras first: the cheapest priced items, then the rest in shop order.
  const picks = products
    .filter((p) => !inBag.has(p.handle))
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.rank - b.rank)
    .slice(0, 4);
  if (!picks.length) return null;
  return (
    <section className="mt-6">
      <h3 className="font-hand text-2xl text-ribbon">Little add-ons they&apos;ll love</h3>
      <div className="no-scrollbar -mx-6 mt-2 flex gap-3 overflow-x-auto px-6 pb-1">
        {picks.map((p) => (
          <div key={p.handle} className="w-32 shrink-0 rounded-2xl border border-line bg-white p-2">
            <div className="grid aspect-square place-items-center rounded-xl" style={{ background: p.tint }}>
              <Image src={p.image} alt={p.title} width={96} height={96} className="product-shadow size-20 object-contain" />
            </div>
            <p className="mt-1.5 line-clamp-1 text-xs font-semibold">{p.title}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-extrabold">{hasPrice(p) ? formatPrice(p.price) : ""}</span>
              <button
                onClick={(e) => add(p, { from: e.currentTarget.closest("div")?.parentElement?.querySelector("img"), silent: true })}
                aria-label={`Add ${p.title}`}
                className="grid size-7 place-items-center rounded-full bg-ink text-white transition hover:scale-110 hover:bg-ribbon"
              >
                <PlusIcon size={14} weight="bold" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyBag({ onClose }: { onClose: () => void }) {
  const anyPriced = useCatalog().products.some(hasPrice);
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
      <div className="relative">
        <Panda className="w-40" />
        <span className="absolute -right-6 -top-2 rotate-12 font-hand text-2xl text-ribbon">hmm…</span>
      </div>
      <h3 className="mt-6 text-2xl font-extrabold">Your bag is feeling light</h3>
      <p className="mt-2 text-ink-2">Our panda checked twice. Nothing in here yet.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {[
          ["Gift hampers", "/collections/gift-hampers"],
          ["Soft toys", "/collections/soft-toys"],
          ...(anyPriced ? [["Under ₹500", "/shop?max=500"]] : []),
        ].map(([label, href]) => (
          <Link key={href} href={href} onClick={onClose} className="rounded-full border-2 border-ink px-4 py-2 text-sm font-bold transition hover:-rotate-2 hover:bg-sun">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
