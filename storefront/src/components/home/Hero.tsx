"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRightIcon, GiftIcon, StorefrontIcon, TagIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { Panda } from "@/components/brand/Panda";
import { Ribbon } from "@/components/ui/Ribbon";
import { formatPrice, hasPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Where each product lands around the box: centre x/y and width, all in % of the stage. */
const orbit: Record<string, { x: number; y: number; w: number; r: number; depth: number }> = {
  "bouquet-crochet-sunflower": { x: 50, y: 16, w: 27, r: 4, depth: 10 },
  "tumbler-butterfly": { x: 17, y: 27, w: 24, r: -9, depth: 18 },
  "lamp-kitty-camera": { x: 83, y: 23, w: 23, r: 9, depth: 22 },
  "keychain-bunny-hood": { x: 31, y: 48, w: 15, r: -14, depth: 30 },
  "lamp-brass-mushroom": { x: 72, y: 50, w: 13, r: 6, depth: 28 },
  "plush-sunflower-bunny": { x: 12, y: 63, w: 25, r: -5, depth: 14 },
  "cup-bow-kitty": { x: 88, y: 60, w: 22, r: 8, depth: 16 },
  "pot-love-basket": { x: 13, y: 89, w: 20, r: 4, depth: 8 },
  "kids-dino-box": { x: 87, y: 88, w: 19, r: -7, depth: 8 },
};

const confetti = Array.from({ length: 16 }, (_, i) => ({
  a: -Math.PI / 2 + ((i / 15) - 0.5) * 2.4,
  d: 120 + (i % 4) * 40,
  c: ["var(--color-ribbon)", "var(--color-sun)", "#fff", "var(--color-pink)"][i % 4],
  sq: i % 3 === 0,
}));

export function Hero({ products }: { products: Product[] }) {
  const [run, setRun] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const items = Object.keys(orbit)
    .map((h) => products.find((p) => p.handle === h))
    .filter((p): p is Product => Boolean(p));

  const onPointerMove = (e: React.PointerEvent) => {
    const el = stageRef.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", String(((e.clientX - r.left) / r.width - 0.5) * 2));
    el.style.setProperty("--my", String(((e.clientY - r.top) / r.height - 0.5) * 2));
  };

  return (
    <section className="relative overflow-hidden" onPointerMove={onPointerMove}>
      {/* the lagoon disc from the logo, with its dotted ring */}
      <div aria-hidden className="absolute top-[52%] -right-[8vw] hidden size-[52vw] -translate-y-1/2 rounded-full bg-lagoon lg:block">
        <div className="absolute inset-[4.5%] animate-spin-slow rounded-full border-[5px] border-dotted border-white/90" />
        <div className="dots absolute inset-0 rounded-full opacity-30 [--dot-gap:26px]" />
      </div>
      <Doodles />

      <div className="relative mx-auto grid max-w-[1400px] items-center gap-6 px-4 pt-6 pb-16 sm:px-6 lg:min-h-[calc(100svh-110px)] lg:grid-cols-[1.02fr_1fr] lg:pt-2 lg:pb-10">
        <div className="relative z-10 max-w-2xl pt-6 lg:pt-0">
          <motion.div initial={{ opacity: 0, y: 12, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: -2 }} transition={{ delay: 0.1, type: "spring" }}>
            <Ribbon className="ml-4">Making a new gift</Ribbon>
          </motion.div>
          <h1 className="mt-7 text-[clamp(2.75rem,5.7vw,5.3rem)] leading-[0.92] font-extrabold tracking-[-0.045em]">
            <motion.span className="block" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: "spring", stiffness: 160, damping: 18 }}>
              Gifts that make
            </motion.span>
            <motion.span className="block" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, type: "spring", stiffness: 160, damping: 18 }}>
              hearts do a
            </motion.span>
            <span className="relative inline-block text-ribbon">
              <DancingWords text="little dance." />
              <motion.svg aria-hidden viewBox="0 0 400 24" className="absolute -bottom-3 left-0 w-full" preserveAspectRatio="none">
                <motion.path
                  d="M4 15 C 60 3, 110 22, 170 12 S 280 4, 396 14"
                  fill="none"
                  stroke="var(--color-sun)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 1, duration: 0.9, ease: "easeInOut" }}
                />
              </motion.svg>
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-7 max-w-[34rem] text-lg leading-relaxed text-ink-2 sm:text-xl"
          >
            Plushies, crochet bouquets, brass lamps, hampers and a thousand tiny surprises, picked off our shop shelves and wrapped by hand.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/shop"
              className="group flex h-14 items-center gap-2 rounded-full bg-ink pr-3 pl-7 text-lg font-bold text-white shadow-[0_6px_0_var(--color-ribbon)] transition hover:bg-ribbon hover:shadow-[0_6px_0_var(--color-ink)] active:translate-y-1 active:shadow-none"
            >
              Shop all gifts
              <span className="grid size-9 place-items-center rounded-full bg-white/15 transition group-hover:translate-x-1 group-hover:bg-white/25">
                <ArrowRightIcon size={18} weight="bold" />
              </span>
            </Link>
            <Link
              href="/gift-finder"
              className="group flex h-14 items-center gap-2 rounded-full border-2 border-ink bg-white px-6 text-lg font-bold transition hover:-rotate-1 hover:bg-sun"
            >
              <GiftIcon size={22} weight="bold" className="transition duration-500 group-hover:rotate-[20deg]" />
              Find a gift in 30 sec
            </Link>
          </motion.div>
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink-2">
            <li className="flex items-center gap-2">
              <GiftIcon size={18} weight="duotone" className="text-ribbon" /> Wrapped by hand
            </li>
            <li className="flex items-center gap-2">
              <TagIcon size={18} weight="duotone" className="text-lagoon-600" /> Fix rate, always
            </li>
            <li className="flex items-center gap-2">
              <StorefrontIcon size={18} weight="duotone" className="text-[#c58a00]" /> A real shop, real shelves
            </li>
          </motion.ul>
        </div>

        <div ref={stageRef} className="relative mx-auto aspect-square w-full max-w-[640px] [--mx:0] [--my:0]">
          {/* on small screens the disc sits behind the stage instead of the page edge */}
          <div aria-hidden className="absolute inset-[-6%] rounded-full bg-lagoon lg:hidden">
            <div className="absolute inset-[4.5%] animate-spin-slow rounded-full border-4 border-dotted border-white/90" />
            <div className="dots absolute inset-0 rounded-full opacity-30 [--dot-gap:22px]" />
          </div>
          <GiftStage key={run} items={items} stageRef={stageRef} />
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.4 }}
            onClick={() => setRun((n) => n + 1)}
            className="absolute bottom-[1%] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3.5 py-1.5 text-sm font-bold shadow-[3px_3px_0_var(--color-ink)] transition hover:bg-sun active:translate-y-0.5 active:shadow-none"
          >
            <ArrowCounterClockwiseIcon size={15} weight="bold" /> Pack it again
          </motion.button>
        </div>
      </div>
    </section>
  );
}

function DancingWords({ text }: { text: string }) {
  return (
    <span aria-label={text} className="inline-flex">
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, y: 40, rotate: -20 }}
          animate={{ opacity: 1, y: [0, -9, 0], rotate: 0 }}
          transition={{
            opacity: { delay: 0.35 + i * 0.04 },
            rotate: { delay: 0.35 + i * 0.04, type: "spring", stiffness: 300, damping: 12 },
            y: { delay: 1.4 + i * 0.07, duration: 0.9, repeat: Infinity, repeatDelay: 2.6, ease: "easeInOut" },
          }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}

function GiftStage({ items, stageRef }: { items: Product[]; stageRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <>
      {/* panda peeking out from behind the box */}
      <motion.div
        className="absolute bottom-[34%] left-[25%] z-[5] w-[19%] -rotate-[14deg]"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.7, type: "spring", stiffness: 200, damping: 14 }}
      >
        <Panda className="w-full" />
      </motion.div>

      {/* the box */}
      <motion.div
        className="absolute bottom-[8%] left-1/2 z-10 h-[30%] w-[40%] -translate-x-1/2"
        initial={{ y: -260, opacity: 0 }}
        animate={{ y: 0, opacity: 1, rotate: [0, 0, -4, 4, -3, 2, 0] }}
        transition={{ y: { type: "spring", stiffness: 260, damping: 16 }, opacity: { duration: 0.2 }, rotate: { delay: 0.55, duration: 0.5 } }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[14px] border-[3px] border-ink bg-lagoon">
          <div className="dots absolute inset-0 [--dot-gap:20px] [--dot-size:3px]" />
          <div className="absolute inset-x-0 top-0 h-[16%] bg-[#0e7f89]" />
          <div className="absolute inset-y-0 left-1/2 w-[17%] -translate-x-1/2 border-x-[3px] border-ink bg-ribbon" />
        </div>
        {confetti.map((c, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute top-0 left-1/2 z-20 size-2.5"
            style={{ background: c.c, borderRadius: c.sq ? 2 : 999 }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: Math.cos(c.a) * c.d, y: [0, Math.sin(c.a) * c.d, Math.sin(c.a) * c.d + 90], opacity: [0, 1, 0], rotate: 360 }}
            transition={{ delay: 1.05, duration: 1.4, ease: "easeOut" }}
          />
        ))}
      </motion.div>

      {/* the lid pops off and hovers above */}
      <motion.div
        className="absolute bottom-[36%] left-1/2 z-20 h-[10%] w-[45%]"
        style={{ x: "-50%" }}
        initial={{ y: "-400%", opacity: 0 }}
        animate={{ y: ["-400%", "0%", "0%", "-175%", "-140%"], opacity: 1, rotate: [0, 0, 0, -16, -11], x: ["-50%", "-50%", "-50%", "-56%", "-55%"] }}
        transition={{ duration: 1.5, times: [0, 0.3, 0.6, 0.78, 1], ease: "easeOut" }}
      >
        <motion.div className="relative h-full w-full" animate={{ y: [0, -8, 0] }} transition={{ delay: 1.6, duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
          <Bow className="absolute bottom-[78%] left-1/2 w-[46%] -translate-x-1/2" />
          <div className="absolute inset-0 overflow-hidden rounded-[12px] border-[3px] border-ink bg-[#3ccad3]">
            <div className="dots absolute inset-0 [--dot-gap:20px] [--dot-size:3px]" />
            <div className="absolute inset-x-0 bottom-0 h-[22%] bg-ink/15" />
            <div className="absolute inset-y-0 left-1/2 w-[15.5%] -translate-x-1/2 border-x-[3px] border-ink bg-ribbon" />
          </div>
        </motion.div>
      </motion.div>

      {/* products burst out of the box and orbit it */}
      {items.map((p, i) => (
        <OrbitItem key={p.handle} product={p} index={i} stageRef={stageRef} />
      ))}

      <motion.p
        aria-hidden
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.6 }}
        className="pointer-events-none absolute top-[-2%] right-[2%] z-30 hidden rotate-[8deg] font-hand text-2xl text-ink sm:block"
      >
        psst… drag them around
        <svg viewBox="0 0 60 40" className="ml-auto h-8 w-12 rotate-[60deg]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M4 6c18 2 34 12 44 28" />
          <path d="M38 30l10 4 1-11" />
        </svg>
      </motion.p>
    </>
  );
}

function OrbitItem({ product, index, stageRef }: { product: Product; index: number; stageRef: React.RefObject<HTMLDivElement | null> }) {
  const o = orbit[product.handle];
  const router = useRouter();
  const dragged = useRef(false);
  const [hover, setHover] = useState(false);

  return (
    <div
      className="absolute z-20"
      style={{
        left: `${o.x}%`,
        top: `${o.y}%`,
        width: `${o.w}%`,
        transform: `translate(-50%, -50%) translate(calc(var(--mx) * ${-o.depth}px), calc(var(--my) * ${-o.depth}px))`,
        transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <motion.div
        initial={{ x: `${(50 - o.x) * 4}%`, y: `${(70 - o.y) * 4}%`, scale: 0.1, opacity: 0, rotate: 0 }}
        animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: o.r }}
        transition={{ delay: 1.05 + index * 0.07, type: "spring", stiffness: 140, damping: 13 }}
        drag
        dragConstraints={stageRef}
        dragElastic={0.25}
        dragTransition={{ bounceStiffness: 300, bounceDamping: 18 }}
        whileHover={{ scale: 1.1, rotate: 0 }}
        whileDrag={{ scale: 1.18, rotate: o.r * -1, zIndex: 50, cursor: "grabbing" }}
        onDragStart={() => (dragged.current = true)}
        onPointerDown={() => (dragged.current = false)}
        onTap={() => !dragged.current && router.push(`/products/${product.handle}`)}
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        className="relative cursor-grab touch-none select-none"
      >
        <div className="animate-bob" style={{ animationDelay: `${index * -0.7}s`, ["--r" as string]: "0deg" }}>
          <Image
            src={product.image}
            alt={product.title}
            width={360}
            height={360}
            priority={index < 4}
            draggable={false}
            sizes="(min-width: 1024px) 160px, 25vw"
            className="product-shadow pointer-events-none h-auto w-full"
          />
        </div>
        <motion.span
          className="pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 rounded-xl border-2 border-ink bg-white px-2.5 py-1 text-center whitespace-nowrap shadow-[3px_3px_0_var(--color-ink)]"
          initial={false}
          animate={{ opacity: hover ? 1 : 0, y: hover ? 0 : -6, rotate: hover ? -3 : 0 }}
        >
          <span className="block text-xs font-bold">{product.title}</span>
          {hasPrice(product) && <span className="block font-display text-sm font-extrabold text-ribbon">{formatPrice(product.price)}</span>}
        </motion.span>
      </motion.div>
    </div>
  );
}

function Bow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 90" className={className} aria-hidden>
      <path d="M80 62 C 52 20, 6 18, 14 52 C 20 76, 58 74, 80 62Z" fill="var(--color-ribbon)" stroke="var(--color-ink)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M80 62 C 108 20, 154 18, 146 52 C 140 76, 102 74, 80 62Z" fill="var(--color-ribbon)" stroke="var(--color-ink)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M36 44c10-4 22 0 30 10M124 44c-10-4-22 0-30 10" fill="none" stroke="var(--color-ribbon-700)" strokeWidth="4" strokeLinecap="round" />
      <rect x="66" y="50" width="28" height="26" rx="8" fill="var(--color-ribbon)" stroke="var(--color-ink)" strokeWidth="5" />
    </svg>
  );
}

function Doodles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <svg viewBox="0 0 40 40" className="absolute top-[12%] left-[46%] hidden w-8 animate-bob text-sun lg:block" style={{ animationDelay: "-1s" }}>
        <path d="M20 2l4.6 11.6L37 15l-9.6 8 3.2 12.4L20 28.6 9.4 35.4 12.6 23 3 15l12.4-1.4z" fill="currentColor" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 40 36" className="absolute bottom-[9%] left-[44%] w-9 animate-bob text-pink" style={{ animationDelay: "-2.4s" }}>
        <path d="M20 33S3 23 3 12A8.5 8.5 0 0 1 20 8a8.5 8.5 0 0 1 17 4c0 11-17 21-17 21z" fill="currentColor" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <svg viewBox="0 0 80 20" className="absolute top-[64%] left-[40%] hidden w-20 text-lagoon-600 lg:block">
        <path d="M2 10c8-10 14 10 22 0s14 10 22 0 14 10 22 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
