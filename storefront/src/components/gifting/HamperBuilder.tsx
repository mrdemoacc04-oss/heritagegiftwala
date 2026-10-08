"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, LayoutGroup, motion, useSpring, useTransform } from "motion/react";
import { CheckIcon, GiftIcon, PlusIcon } from "@phosphor-icons/react";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { useAddToBag } from "@/lib/useAddToBag";
import { useUI } from "@/lib/store/ui";
import { cx, formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

const CANDIDATES = [
  "keychain-bunny-hood",
  "crochet-snowman",
  "pendant-ruby-heart",
  "cup-bow-kitty",
  "plush-sunflower-bunny",
  "bottle-butter-yellow",
  "pendant-emerald-drop",
  "lamp-kitty-camera",
  "pot-love-basket",
];
const BASKET = "basket-bunny-ear";
const MAX = 6;

/** Where things settle in the basket: centre x, bottom edge and width in % of the stage. */
const slots = [
  { x: 36, b: 30, w: 30, r: -8 },
  { x: 64, b: 31, w: 29, r: 9 },
  { x: 50, b: 38, w: 27, r: 2 },
  { x: 25, b: 14, w: 24, r: -14 },
  { x: 75, b: 14, w: 24, r: 12 },
  { x: 50, b: 10, w: 25, r: -4 },
];

export function HamperBuilder() {
  const { products } = useCatalog();
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  const basket = byHandle.get(BASKET);
  const items = CANDIDATES.map((h) => byHandle.get(h)).filter((p): p is Product => Boolean(p));
  const [picked, setPicked] = useState<string[]>(["plush-sunflower-bunny", "cup-bow-kitty"]);
  const [packed, setPacked] = useState(false);
  const add = useAddToBag();
  const showToast = useUI((s) => s.showToast);

  const chosen = picked.map((h) => byHandle.get(h)).filter((p): p is Product => Boolean(p));
  const total = (basket?.price ?? 0) + chosen.reduce((n, p) => n + p.price, 0);

  const toggle = (h: string) => setPicked((cur) => (cur.includes(h) ? cur.filter((x) => x !== h) : cur.length >= MAX ? cur : [...cur, h]));

  const addHamper = async () => {
    if (!basket || chosen.length < 2) return;
    for (const p of [basket, ...chosen]) await add(p, { silent: true });
    showToast({ title: `Hamper with ${chosen.length} goodies`, image: basket.image, tint: basket.tint });
    setPacked(true);
    setTimeout(() => setPacked(false), 2200);
  };

  if (!basket) return null;

  return (
    <section id="hamper-builder" className="mx-auto max-w-[1400px] scroll-mt-24 px-4 pt-28 sm:px-6 sm:pt-36">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-[#ffe3ea] p-5 sm:rounded-[3.5rem] sm:p-10 lg:p-14">
        <div aria-hidden className="dots absolute inset-0 opacity-70 [--dot-gap:22px]" />
        <LayoutGroup id="hamper">
          <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
            <div>
              <p className="font-hand text-3xl text-ribbon">tap, tap, tap… done</p>
              <h2 className="mt-1 text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.95] font-extrabold">Build-a-Hamper</h2>
              <p className="mt-4 max-w-lg text-lg text-ink-2">
                {`Toss up to ${MAX} goodies into our bunny basket. We'll pack them together, fill the gaps with paper shred and tie a bow on top.`}
              </p>

              <ul className="mt-8 grid grid-cols-3 gap-3">
                {items.map((p) => {
                  const on = picked.includes(p.handle);
                  const full = !on && picked.length >= MAX;
                  return (
                    <li key={p.handle}>
                      <button
                        onClick={() => toggle(p.handle)}
                        disabled={full}
                        aria-pressed={on}
                        aria-label={on ? `Take ${p.title} out of the hamper` : `Add ${p.title} to the hamper`}
                        className={cx(
                          "group relative flex w-full flex-col items-center rounded-3xl p-2 pb-3 text-center transition",
                          on ? "bg-white/40 outline-2 outline-dashed outline-ink/30" : "bg-white hover:-translate-y-1 hover:shadow-[4px_4px_0_var(--color-ink)]",
                          full && "opacity-40",
                        )}
                      >
                        <span className="relative grid aspect-square w-full place-items-center rounded-2xl" style={{ background: on ? "transparent" : p.tint }}>
                          {!on && (
                            <motion.span layoutId={`hamper-${p.handle}`} className="relative block size-[78%]" transition={{ type: "spring", stiffness: 260, damping: 22 }}>
                              <Image src={p.image} alt="" fill sizes="120px" className="product-shadow object-contain" />
                            </motion.span>
                          )}
                          {on && <span className="font-hand text-xl text-ink-2">in the basket!</span>}
                        </span>
                        <span className="mt-2 line-clamp-1 text-xs font-bold sm:text-sm">{p.title}</span>
                        <span className="text-xs font-semibold text-ink-2">{formatPrice(p.price)}</span>
                        <span
                          className={cx(
                            "absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full transition",
                            on ? "bg-lagoon-600 text-white" : "bg-ink text-white group-hover:rotate-90",
                          )}
                        >
                          {on ? <CheckIcon size={14} weight="bold" /> : <PlusIcon size={14} weight="bold" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-col">
              <div className="relative mx-auto aspect-square w-full max-w-[520px]">
                <div aria-hidden className="absolute inset-[8%] rounded-full bg-white/70" />
                <AnimatePresence>
                  {chosen.map((p, i) => {
                    const s = slots[i];
                    return (
                      <motion.button
                        key={p.handle}
                        layoutId={`hamper-${p.handle}`}
                        onClick={() => toggle(p.handle)}
                        aria-label={`Take ${p.title} out`}
                        className="absolute aspect-square cursor-pointer"
                        style={{ left: `${s.x - s.w / 2}%`, bottom: `${s.b}%`, width: `${s.w}%`, rotate: s.r, zIndex: 40 + i }}
                        whileHover={{ y: -10, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 22 }}
                      >
                        <Image src={p.image} alt={p.title} fill sizes="160px" className="product-shadow object-contain" />
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
                <Image
                  src={basket.image}
                  alt={basket.title}
                  width={520}
                  height={520}
                  className="pointer-events-none absolute bottom-[4%] left-1/2 z-30 w-[70%] -translate-x-1/2 drop-shadow-[0_24px_24px_rgb(30_27_46/0.2)]"
                />
                {chosen.length === 0 && (
                  <p className="absolute top-[10%] left-1/2 z-50 -translate-x-1/2 -rotate-3 font-hand text-2xl whitespace-nowrap">it&apos;s empty… tap something!</p>
                )}
              </div>

              <div className="mt-4 flex flex-col items-center gap-4 rounded-3xl bg-white p-5 sm:flex-row sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-2">
                    Basket + {chosen.length} {chosen.length === 1 ? "goodie" : "goodies"}
                  </p>
                  <Total value={total} />
                </div>
                <button
                  onClick={addHamper}
                  disabled={chosen.length < 2}
                  className={cx(
                    "flex h-14 items-center gap-2 rounded-full px-7 text-lg font-bold text-white transition active:translate-y-1 disabled:opacity-40",
                    packed ? "bg-lagoon-600" : "bg-ink shadow-[0_6px_0_var(--color-ribbon)] hover:bg-ribbon",
                  )}
                >
                  {packed ? <CheckIcon size={20} weight="bold" /> : <GiftIcon size={20} weight="bold" />}
                  {packed ? "Packed!" : chosen.length < 2 ? "Pick at least 2" : "Add hamper to bag"}
                </button>
              </div>
            </div>
          </div>
        </LayoutGroup>
      </div>
    </section>
  );
}

function Total({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 140, damping: 20 });
  const text = useTransform(spring, (v) => formatPrice(v));
  useEffect(() => spring.set(value), [spring, value]);
  return <motion.p className="font-display text-3xl font-extrabold">{text}</motion.p>;
}
