"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BabyIcon,
  BriefcaseIcon,
  CakeIcon,
  CoinsIcon,
  FlowerIcon,
  HandHeartIcon,
  HeartIcon,
  HouseIcon,
  HouseLineIcon,
  SmileyIcon,
  SparkleIcon,
  UserIcon,
  UsersThreeIcon,
  type Icon,
} from "@phosphor-icons/react";
import { ProductCard } from "@/components/product/ProductCard";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { cx, hasPrice } from "@/lib/format";
import type { Occasion, Product, Recipient } from "@/lib/types";

type Option<T> = { id: T; label: string; icon: Icon; tint: string };

const recipients: Option<Recipient>[] = [
  { id: "her", label: "Her", icon: FlowerIcon, tint: "#ffd6de" },
  { id: "him", label: "Him", icon: UserIcon, tint: "#d6eeff" },
  { id: "kids", label: "A little one", icon: BabyIcon, tint: "#fff0a8" },
  { id: "parents", label: "Mummy & Papa", icon: UsersThreeIcon, tint: "#d3f3ea" },
  { id: "colleague", label: "A colleague", icon: BriefcaseIcon, tint: "#e6deff" },
  { id: "home", label: "A new home", icon: HouseIcon, tint: "#f4e9d8" },
];
const occasions: Option<Occasion>[] = [
  { id: "birthday", label: "Birthday", icon: CakeIcon, tint: "#ffd6de" },
  { id: "anniversary", label: "Anniversary", icon: HeartIcon, tint: "#ffe3e0" },
  { id: "festive", label: "Diwali & festive", icon: SparkleIcon, tint: "#ffe9b8" },
  { id: "housewarming", label: "Housewarming", icon: HouseLineIcon, tint: "#d3f3ea" },
  { id: "thank-you", label: "Thank you", icon: HandHeartIcon, tint: "#e6deff" },
  { id: "just-because", label: "Just because", icon: SmileyIcon, tint: "#fff0a8" },
];
const budgets: (Option<string> & { min: number; max: number })[] = [
  { id: "u500", label: "Under ₹500", icon: CoinsIcon, tint: "#d3f3ea", min: 0, max: 500 },
  { id: "500-1000", label: "₹500 – ₹1,000", icon: CoinsIcon, tint: "#fff0a8", min: 500, max: 1000 },
  { id: "1000-2000", label: "₹1,000 – ₹2,000", icon: CoinsIcon, tint: "#ffe3cc", min: 1000, max: 2000 },
  { id: "2000+", label: "₹2,000 and up", icon: CoinsIcon, tint: "#ffd6de", min: 2000, max: Infinity },
];

const steps = ["Who's it for?", "What's the occasion?", "How much would you like to spend?"];

function rank(products: Product[], who?: Recipient, why?: Occasion, budget?: (typeof budgets)[number]) {
  return products
    .map((p) => {
      let s = 0;
      if (who && p.recipients.includes(who)) s += 4;
      if (why && p.occasions.includes(why)) s += 3;
      // Products without a price are neither rewarded nor penalised for a budget.
      if (budget && hasPrice(p)) s += p.price >= budget.min && p.price <= budget.max ? 4 : p.price <= budget.max * 1.15 && p.price >= budget.min * 0.85 ? 1 : -6;
      return { p, s };
    })
    .sort((a, b) => b.s - a.s || a.p.rank - b.p.rank);
}

export function GiftFinder({ variant = "section" }: { variant?: "section" | "page" }) {
  const { products } = useCatalog();
  const [step, setStep] = useState(0);
  const [who, setWho] = useState<Recipient>();
  const [why, setWhy] = useState<Occasion>();
  const [budget, setBudget] = useState<(typeof budgets)[number]>();

  // The budget question only makes sense once some products carry a price.
  const askBudget = products.some(hasPrice);
  const stepList = askBudget ? steps : steps.slice(0, 2);

  const results = useMemo(() => rank(products, who, why, budget), [products, who, why, budget]);
  const best = results[0]?.s ?? 1;
  const picks = results.slice(0, variant === "page" ? 8 : 4);
  const done = step === stepList.length;

  const choose = (fn: () => void) => {
    fn();
    setStep((s) => s + 1);
  };
  const reset = () => {
    setWho(undefined);
    setWhy(undefined);
    setBudget(undefined);
    setStep(0);
  };

  const options = [recipients, occasions, budgets][step] as Option<string>[] | undefined;
  const selected = [who, why, budget?.id][step];

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border-[3px] border-ink bg-sun p-5 sm:rounded-[3.5rem] sm:p-10 lg:p-14">
      <div aria-hidden className="dots absolute inset-0 opacity-50 [--dot-gap:24px]" />
      <div className="relative grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div>
          <p className="font-hand text-3xl text-ribbon">stuck on what to gift?</p>
          <h2 className="mt-1 text-[clamp(2.3rem,4.6vw,4rem)] leading-[0.95] font-extrabold">The 30-second Gift Finder</h2>
          <p className="mt-4 max-w-md text-lg text-ink/75">{askBudget ? "Three" : "Two"} tiny questions and we&apos;ll pull the best picks off the shelf for you.</p>

          <ol className="mt-8 flex flex-col gap-3">
            {stepList.map((label, i) => {
              const answer = [recipients.find((r) => r.id === who)?.label, occasions.find((o) => o.id === why)?.label, budget?.label][i];
              return (
                <li key={label}>
                  <button
                    onClick={() => i <= step && setStep(i)}
                    disabled={i > step}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition",
                      i === step ? "bg-white shadow-[4px_4px_0_var(--color-ink)]" : i < step ? "bg-white/50 hover:bg-white" : "opacity-50",
                    )}
                  >
                    <span className={cx("grid size-8 shrink-0 place-items-center rounded-full font-display font-extrabold", i < step ? "bg-ink text-white" : "border-2 border-ink")}>
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink/70">{label}</span>
                      {answer && <span className="block truncate font-display font-extrabold">{answer}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {step > 0 && (
            <button onClick={reset} className="mt-5 flex items-center gap-1.5 text-sm font-bold underline-offset-4 hover:underline">
              <ArrowCounterClockwiseIcon size={15} weight="bold" /> Start over
            </button>
          )}
        </div>

        <div className="min-h-[360px]">
          <AnimatePresence mode="wait">
            {!done && options ? (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-extrabold sm:text-3xl">{steps[step]}</h3>
                  {step > 0 && (
                    <button onClick={() => setStep((s) => s - 1)} aria-label="Back" className="grid size-10 place-items-center rounded-full border-2 border-ink bg-white hover:bg-cream">
                      <ArrowLeftIcon size={18} weight="bold" />
                    </button>
                  )}
                </div>
                <div className={cx("mt-6 grid gap-3", step === 2 ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
                  {options.map((o, i) => {
                    const I = o.icon;
                    return (
                      <motion.button
                        key={o.id}
                        initial={{ opacity: 0, y: 20, rotate: i % 2 ? 3 : -3 }}
                        animate={{ opacity: 1, y: 0, rotate: 0 }}
                        transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 20 }}
                        whileHover={{ y: -4, rotate: i % 2 ? 1.5 : -1.5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() =>
                          choose(() => {
                            if (step === 0) setWho(o.id as Recipient);
                            if (step === 1) setWhy(o.id as Occasion);
                            if (step === 2) setBudget(budgets.find((b) => b.id === o.id));
                          })
                        }
                        className={cx(
                          "flex flex-col items-start gap-3 rounded-3xl border-[3px] border-ink p-4 text-left shadow-[4px_4px_0_var(--color-ink)] transition-shadow hover:shadow-[6px_6px_0_var(--color-ink)] sm:p-5",
                          selected === o.id && "ring-4 ring-white",
                        )}
                        style={{ background: o.tint }}
                      >
                        <span className="grid size-11 place-items-center rounded-2xl bg-white">
                          <I size={24} weight="duotone" />
                        </span>
                        <span className="font-display text-lg leading-tight font-extrabold sm:text-xl">{o.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div key="results" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 240, damping: 26 }}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h3 className="text-2xl font-extrabold sm:text-3xl">Here&apos;s what we&apos;d wrap</h3>
                  <Link
                    href={`/shop?${new URLSearchParams({ ...(who ? { for: who } : {}), ...(budget && budget.max !== Infinity ? { max: String(budget.max) } : {}) })}`}
                    className="group flex items-center gap-1.5 font-bold underline-offset-4 hover:underline"
                  >
                    More like these <ArrowRightIcon size={16} weight="bold" className="transition group-hover:translate-x-1" />
                  </Link>
                </div>
                <ul className={cx("mt-6 grid grid-cols-2 gap-4", variant === "page" ? "md:grid-cols-4" : "")}>
                  {picks.map(({ p, s }, i) => (
                    <motion.li
                      key={p.handle}
                      initial={{ opacity: 0, y: 40, rotate: i % 2 ? 4 : -4 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 220, damping: 18 }}
                      className="rounded-[2rem] bg-white p-2.5 shadow-[4px_4px_0_var(--color-ink)]"
                    >
                      <ProductCard product={p} index={i} />
                      <Match score={Math.max(0, s) / Math.max(best, 1)} />
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Match({ score }: { score: number }) {
  const hearts = Math.max(1, Math.round(score * 5));
  return (
    <p className="mt-2 flex items-center gap-1 px-1 pb-1 text-xs font-bold text-ink-2" aria-label={`Match: ${hearts} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <HeartIcon key={i} size={14} weight="fill" className={i < hearts ? "text-ribbon" : "text-line"} />
      ))}
      <span className="ml-1">{hearts >= 5 ? "Perfect match" : hearts >= 3 ? "Great match" : "Worth a look"}</span>
    </p>
  );
}
