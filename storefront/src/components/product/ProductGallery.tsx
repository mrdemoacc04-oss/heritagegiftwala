"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "@/lib/format";
import type { Product } from "@/lib/types";

type Frame = { id: string; src: string; label: string; kind: "cutout" | "studio" | "shelf" };

export function ProductGallery({ product }: { product: Product }) {
  const frames: Frame[] = [
    { id: "cutout", src: product.image, label: "Product", kind: "cutout" },
    ...(product.studio ? [{ id: "studio", src: product.studio, label: "Studio shot", kind: "studio" as const }] : []),
    ...(product.shelf ? [{ id: "shelf", src: product.shelf, label: "On our shelf", kind: "shelf" as const }] : []),
  ];
  const [active, setActive] = useState(frames[0]);
  const stageRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || active.kind !== "cutout") return;
    const el = stageRef.current!;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 18}deg`);
    el.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 18}deg`);
  };
  const reset = () => {
    stageRef.current?.style.setProperty("--rx", "0deg");
    stageRef.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row">
      <div className="no-scrollbar flex gap-3 overflow-x-auto lg:flex-col" role="tablist" aria-label="Product photos">
        {frames.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={active.id === f.id}
            onClick={() => setActive(f)}
            className={cx(
              "relative size-20 shrink-0 overflow-hidden rounded-2xl border-[3px] transition sm:size-24",
              active.id === f.id ? "border-ink" : "border-transparent opacity-70 hover:opacity-100",
            )}
            style={{ background: f.kind === "cutout" ? product.tint : "#fff" }}
          >
            <Image src={f.src} alt="" fill sizes="96px" className={f.kind === "cutout" ? "object-contain p-2" : "object-cover"} />
            <span className="sr-only">{f.label}</span>
          </button>
        ))}
      </div>

      <div
        ref={stageRef}
        onPointerMove={onMove}
        onPointerLeave={reset}
        className="relative aspect-square flex-1 overflow-hidden rounded-[2.5rem] [perspective:1000px]"
        style={{ background: product.tint }}
      >
        <div aria-hidden className="dots absolute inset-0 opacity-60 [--dot-gap:24px]" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            initial={{ opacity: 0, scale: 0.92, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="absolute inset-0"
          >
            {active.kind === "cutout" && (
              <>
                <span aria-hidden className="absolute bottom-[10%] left-1/2 h-8 w-1/2 -translate-x-1/2 rounded-[50%] bg-ink/20 blur-xl" />
                <span className="absolute inset-[9%] block transition-transform duration-300 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]">
                  <Image src={active.src} alt={product.title} fill priority sizes="(min-width: 1024px) 45vw, 92vw" className="product-shadow object-contain" />
                </span>
              </>
            )}
            {active.kind === "studio" && <Image src={active.src} alt={`${product.title}, studio photo`} fill sizes="(min-width: 1024px) 45vw, 92vw" className="object-cover" />}
            {active.kind === "shelf" && (
              <div className="absolute inset-0 grid place-items-center p-[8%]">
                <figure className="relative w-[78%] -rotate-3 bg-white p-3 pb-12 shadow-[0_24px_40px_-18px_rgb(30_27_46/0.5)]">
                  <span className="relative block aspect-[4/5] overflow-hidden bg-cream">
                    <Image src={active.src} alt={`${product.title} on the shelf at our shop`} fill sizes="40vw" className="object-cover" />
                  </span>
                  <figcaption className="absolute inset-x-0 bottom-3 text-center font-hand text-2xl">spotted on our shelf!</figcaption>
                  <span aria-hidden className="absolute -top-3 left-1/2 h-7 w-24 -translate-x-1/2 rotate-2 bg-sun/80" />
                </figure>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        {product.badge && (
          <span className="absolute top-5 left-5 -rotate-6 rounded-full bg-sun px-4 py-1.5 font-display text-sm font-bold shadow-[0_3px_0_rgb(30_27_46/0.15)]">{product.badge}</span>
        )}
      </div>
    </div>
  );
}
