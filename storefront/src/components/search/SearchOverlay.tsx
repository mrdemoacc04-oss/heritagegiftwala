"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MagnifyingGlassIcon, XIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { useUI } from "@/lib/store/ui";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/types";

const popular = ["hamper", "plush", "crochet", "lamp", "tumbler", "krishna", "clock", "pendant"];

export function SearchOverlay() {
  const open = useUI((s) => s.searchOpen);
  const setOpen = useUI((s) => s.setSearchOpen);
  return <AnimatePresence>{open && <SearchPanel onClose={() => setOpen(false)} />}</AnimatePresence>;
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const { products, categories } = useCatalog();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => search(products, categories, q), [products, categories, q]);

  useEffect(() => {
    inputRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const go = (p: Product) => {
    onClose();
    router.push(`/products/${p.handle}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === "Enter" && results[active]) go(results[active]);
  };

  return (
    <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label="Search the shop" onKeyDown={onKey}>
      <motion.button
        aria-label="Close search"
        className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: -30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -20, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative mx-auto mt-4 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-[2rem] border-2 border-ink bg-paper shadow-[8px_8px_0_var(--color-ink)] sm:mt-[10vh]"
      >
        <label className="flex items-center gap-3 border-b-2 border-dashed border-line px-5 py-4">
          <MagnifyingGlassIcon size={24} weight="bold" className="text-lagoon-600" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Search plushies, hampers, lamps…"
            className="min-w-0 flex-1 bg-transparent font-display text-xl font-semibold outline-none placeholder:text-ink-3"
            aria-label="Search products"
          />
          <button onClick={onClose} aria-label="Close search" className="grid size-9 place-items-center rounded-full hover:bg-cream">
            <XIcon size={18} weight="bold" />
          </button>
        </label>

        <div data-lenis-prevent className="overflow-y-auto p-3">
          {!q && (
            <div className="px-2 pt-1 pb-3">
              <p className="font-hand text-xl text-ribbon">People are looking for…</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {popular.map((term) => (
                  <button
                    key={term}
                    onClick={() => setQ(term)}
                    className="rounded-full border-2 border-ink/80 px-3.5 py-1.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-sun"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
          {q && results.length === 0 && (
            <p className="px-3 py-10 text-center text-ink-2">
              Nothing called &ldquo;{q}&rdquo; on our shelves yet. Try &ldquo;gift&rdquo; or &ldquo;plush&rdquo;.
            </p>
          )}
          <ul className="grid gap-1.5">
            {results.map((p, i) => (
              <li key={p.handle}>
                <button
                  onClick={() => go(p)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${i === active ? "bg-lagoon-100" : ""}`}
                >
                  <span className="grid size-14 shrink-0 place-items-center rounded-xl" style={{ background: p.tint }}>
                    <Image src={p.image} alt="" width={56} height={56} className="size-12 object-contain" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.title}</span>
                    <span className="block truncate text-sm text-ink-2">{p.subtitle}</span>
                  </span>
                  <span className="font-display font-extrabold">{formatPrice(p.price)}</span>
                  <ArrowUpRightIcon size={18} className={i === active ? "text-ink" : "text-transparent"} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden border-t border-line px-5 py-2.5 text-xs text-ink-3 sm:block">
          <kbd className="rounded border border-line bg-white px-1.5">↑</kbd> <kbd className="rounded border border-line bg-white px-1.5">↓</kbd> to move ·{" "}
          <kbd className="rounded border border-line bg-white px-1.5">Enter</kbd> to open · <kbd className="rounded border border-line bg-white px-1.5">Esc</kbd> to close
        </p>
      </motion.div>
    </div>
  );
}

function search(products: Product[], categories: { handle: string; title: string }[], q: string) {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return products.slice(0, 6);
  const catTitle = new Map(categories.map((c) => [c.handle, c.title.toLowerCase()]));
  return products
    .map((p) => {
      const hay = [p.title, p.subtitle, p.description, ...p.categories.map((c) => catTitle.get(c) ?? c), ...p.recipients, ...p.occasions]
        .join(" ")
        .toLowerCase();
      const title = p.title.toLowerCase();
      const score = terms.reduce((s, t) => s + (title.includes(t) ? 3 : hay.includes(t) ? 1 : -99), 0);
      return { p, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.p.rank - b.p.rank)
    .slice(0, 8)
    .map((r) => r.p);
}
