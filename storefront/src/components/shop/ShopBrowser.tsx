"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDownIcon, FadersHorizontalIcon, XIcon } from "@phosphor-icons/react";
import { Panda } from "@/components/brand/Panda";
import { ProductCard } from "@/components/product/ProductCard";
import { cx, hasPrice } from "@/lib/format";
import type { Category, Product, Recipient } from "@/lib/types";

export type ShopFilters = { shelf?: string; for?: Recipient; max?: number; sort?: SortId };
type SortId = "featured" | "price-asc" | "price-desc" | "az";

const sorts: { id: SortId; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "az", label: "A to Z" },
];
const recipientLabels: Record<Recipient, string> = {
  her: "Her",
  him: "Him",
  kids: "Little ones",
  parents: "Parents",
  colleague: "Colleagues",
  home: "The home",
};
const budgets = [300, 500, 1000, 2000];

export function ShopBrowser({
  products,
  categories,
  initial,
  lockShelf,
}: {
  products: Product[];
  categories: Category[];
  initial: ShopFilters;
  /** On a collection page the shelf is fixed. */
  lockShelf?: string;
}) {
  // Budget filters and price sorting only make sense once some products carry a price. An old link that asks for them
  // (a bookmarked "under ₹500") is read as "everything" rather than landing on an empty shelf with no way to see why.
  const anyPriced = useMemo(() => products.some(hasPrice), [products]);
  const [f, setF] = useState<ShopFilters>(() => ({
    sort: "featured",
    ...initial,
    ...(anyPriced ? {} : { max: undefined, sort: initial.sort?.startsWith("price") ? "featured" : initial.sort }),
    shelf: lockShelf ?? initial.shelf,
  }));
  const [panel, setPanel] = useState(false);
  const sortOptions = anyPriced ? sorts : sorts.filter((s) => !s.id.startsWith("price"));

  // Keep the URL shareable without a server round trip.
  useEffect(() => {
    const q = new URLSearchParams();
    if (f.shelf && !lockShelf) q.set("shelf", f.shelf);
    if (f.for) q.set("for", f.for);
    if (f.max) q.set("max", String(f.max));
    if (f.sort && f.sort !== "featured") q.set("sort", f.sort);
    const qs = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [f, lockShelf]);

  const shown = useMemo(() => {
    const list = products.filter(
      (p) => (!f.shelf || p.categories.includes(f.shelf)) && (!f.for || p.recipients.includes(f.for)) && (!f.max || (hasPrice(p) && p.price <= f.max)),
    );
    const by: Record<SortId, (a: Product, b: Product) => number> = {
      featured: (a, b) => a.rank - b.rank,
      // Unpriced products always sit after the priced ones.
      "price-asc": (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.rank - b.rank,
      "price-desc": (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity) || a.rank - b.rank,
      az: (a, b) => a.title.localeCompare(b.title),
    };
    return list.sort(by[f.sort ?? "featured"]);
  }, [products, f]);

  const active = [
    !lockShelf && f.shelf && { key: "shelf", label: categories.find((c) => c.handle === f.shelf)?.title ?? f.shelf },
    f.for && { key: "for", label: `For ${recipientLabels[f.for].toLowerCase()}` },
    f.max && { key: "max", label: `Under ₹${f.max.toLocaleString("en-IN")}` },
  ].filter(Boolean) as { key: keyof ShopFilters; label: string }[];

  const clear = () => setF((cur) => ({ sort: cur.sort, shelf: lockShelf }));

  const filters = (
    <div className="space-y-7">
      {!lockShelf && (
        <FilterGroup title="Shelf">
          <Chip on={!f.shelf} onClick={() => setF({ ...f, shelf: undefined })}>
            Everything
          </Chip>
          {categories.map((c) => (
            <Chip key={c.handle} on={f.shelf === c.handle} onClick={() => setF({ ...f, shelf: f.shelf === c.handle ? undefined : c.handle })} tint={c.tint}>
              {c.title}
            </Chip>
          ))}
        </FilterGroup>
      )}
      <FilterGroup title="Gift for">
        {(Object.keys(recipientLabels) as Recipient[]).map((r) => (
          <Chip key={r} on={f.for === r} onClick={() => setF({ ...f, for: f.for === r ? undefined : r })}>
            {recipientLabels[r]}
          </Chip>
        ))}
      </FilterGroup>
      {anyPriced && (
        <FilterGroup title="Budget">
          {budgets.map((b) => (
            <Chip key={b} on={f.max === b} onClick={() => setF({ ...f, max: f.max === b ? undefined : b })}>
              Under ₹{b.toLocaleString("en-IN")}
            </Chip>
          ))}
        </FilterGroup>
      )}
    </div>
  );

  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-4 pb-10 sm:px-6 lg:grid-cols-[260px_1fr] lg:gap-12">
      <aside className="hidden lg:block">
        <div className="sticky top-28">{filters}</div>
      </aside>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setPanel((p) => !p)}
            aria-expanded={panel}
            className="flex items-center gap-2 rounded-full border-2 border-ink px-4 py-2 font-bold lg:hidden"
          >
            <FadersHorizontalIcon size={18} weight="bold" /> Filters
            {active.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-ribbon text-xs text-white">{active.length}</span>}
          </button>
          <p className="font-semibold text-ink-2">
            <span className="font-display text-xl font-extrabold text-ink">{shown.length}</span> {shown.length === 1 ? "gift" : "gifts"}
          </p>
          <AnimatePresence>
            {active.map((a) => (
              <motion.button
                key={a.key}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setF({ ...f, [a.key]: undefined })}
                className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-sm font-bold text-white"
              >
                {a.label} <XIcon size={12} weight="bold" />
              </motion.button>
            ))}
          </AnimatePresence>
          {active.length > 1 && (
            <button onClick={clear} className="text-sm font-bold underline underline-offset-4">
              Clear all
            </button>
          )}
          <label className="relative ml-auto">
            <span className="sr-only">Sort by</span>
            <select
              value={f.sort}
              onChange={(e) => setF({ ...f, sort: e.target.value as SortId })}
              className="appearance-none rounded-full border-2 border-ink bg-white py-2 pr-10 pl-4 font-bold outline-none"
            >
              {sortOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <CaretDownIcon size={14} weight="bold" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2" />
          </label>
        </div>

        <AnimatePresence initial={false}>
          {panel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden lg:hidden"
            >
              <div className="mt-5 rounded-3xl bg-white p-5">{filters}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <Panda className="w-32" />
            <h2 className="mt-5 text-2xl font-extrabold">Nothing on this shelf matches</h2>
            <p className="mt-1 text-ink-2">Loosen a filter and we&apos;ll find something lovely.</p>
            <button onClick={clear} className="mt-5 rounded-full bg-ink px-5 py-2.5 font-bold text-white hover:bg-ribbon">
              Clear filters
            </button>
          </div>
        ) : (
          <motion.ul layout className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 xl:gap-x-6">
            <AnimatePresence mode="popLayout" initial={false}>
              {shown.map((p, i) => (
                <motion.li
                  key={p.handle}
                  layout
                  initial={{ opacity: 0, scale: 0.92, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 260, damping: 26 }}
                >
                  <ProductCard product={p} index={i} priority={i < 3} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-sm font-bold tracking-[0.14em] uppercase">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children, tint }: { on: boolean; onClick: () => void; children: React.ReactNode; tint?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        "rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5",
        on ? "border-ink bg-ink text-white" : "border-transparent bg-white hover:border-ink",
      )}
      style={!on && tint ? { background: tint } : undefined}
    >
      {children}
    </button>
  );
}
