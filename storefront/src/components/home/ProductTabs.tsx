"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types";

const tabs: { id: string; label: string; pick: (p: Product) => boolean; href: string }[] = [
  { id: "loved", label: "Most loved", pick: () => true, href: "/shop" },
  { id: "under500", label: "Under ₹500", pick: (p) => p.price <= 500, href: "/shop?max=500" },
  { id: "her", label: "For her", pick: (p) => p.recipients.includes("her"), href: "/shop?for=her" },
  { id: "home", label: "For the home", pick: (p) => p.recipients.includes("home"), href: "/shop?for=home" },
  { id: "kids", label: "For little ones", pick: (p) => p.recipients.includes("kids"), href: "/shop?for=kids" },
];

export function ProductTabs({ products }: { products: Product[] }) {
  const [tab, setTab] = useState(tabs[0]);
  const shown = products.filter(tab.pick).slice(0, 8);

  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-28 sm:px-6 sm:pt-36">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-hand text-3xl text-ribbon">straight from the counter</p>
          <h2 className="mt-1 text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.95] font-extrabold">Flying off the shelves</h2>
        </div>
        <LayoutGroup id="tabs">
          <div role="tablist" aria-label="Filter gifts" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === tab.id}
                onClick={() => setTab(t)}
                className="relative shrink-0 rounded-full px-4 py-2.5 font-bold whitespace-nowrap transition-colors"
              >
                {t.id === tab.id && (
                  <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                <span className={`relative ${t.id === tab.id ? "text-white" : "text-ink-2 hover:text-ink"}`}>{t.label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>

      <motion.ul layout className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4 xl:gap-x-6">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((p, i) => (
            <motion.li
              key={p.handle}
              layout
              initial={{ opacity: 0, y: 30, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 260, damping: 26, delay: i * 0.03 }}
            >
              <ProductCard product={p} index={i} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      <div className="mt-12 flex justify-center">
        <Link href={tab.href} className="group flex items-center gap-2 rounded-full bg-sun px-7 py-3.5 text-lg font-bold shadow-[0_5px_0_var(--color-ink)] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none">
          See all {tab.id === "loved" ? "gifts" : tab.label.toLowerCase()}
          <ArrowRightIcon size={18} weight="bold" className="transition group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
