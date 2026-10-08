"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import type { Category, Product } from "@/lib/types";

const tilt = [-6, 4, -3, 7, -5, 3, -7, 5, -2, 6, -4];

export function CategoryStickers({ categories, products }: { categories: Category[]; products: Product[] }) {
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-20 sm:px-6 sm:pt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-hand text-3xl text-ribbon">{categories.length} shelves, one happy shop</p>
          <h2 className="mt-1 text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.95] font-extrabold">Pick a shelf, any shelf.</h2>
        </div>
        <Link href="/shop" className="group flex items-center gap-2 rounded-full border-2 border-ink px-5 py-2.5 font-bold transition hover:bg-ink hover:text-white">
          Browse everything <ArrowRightIcon size={18} weight="bold" className="transition group-hover:translate-x-1" />
        </Link>
      </div>

      <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-6">
        {categories.map((c, i) => {
          const cover = byHandle.get(c.cover);
          const count = products.filter((p) => p.categories.includes(c.handle)).length;
          return (
            <motion.li
              key={c.handle}
              initial={{ opacity: 0, scale: 0.6, rotate: tilt[i % tilt.length] * 3 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ type: "spring", stiffness: 220, damping: 15, delay: (i % 6) * 0.06 }}
              className={i % 2 ? "lg:translate-y-10" : ""}
            >
              <Link href={`/collections/${c.handle}`} className="group flex flex-col items-center text-center">
                <span
                  className="stitch relative grid aspect-square w-full max-w-[200px] place-items-center rounded-full transition duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-[1.04]"
                  style={{ background: c.tint, rotate: `${tilt[i % tilt.length]}deg` }}
                >
                  <span className="dots absolute inset-0 rounded-full opacity-60 [--dot-gap:16px] [--dot-size:1.6px]" />
                  {cover && (
                    <span className="relative -mt-[18%] block w-[92%]" style={{ rotate: `${-tilt[i % tilt.length]}deg` }}>
                      <Image
                        src={cover.image}
                        alt=""
                        width={240}
                        height={240}
                        sizes="(min-width: 1024px) 200px, 45vw"
                        className="product-shadow w-full transition duration-500 [transition-timing-function:var(--ease-spring)] group-hover:-translate-y-4 group-hover:rotate-[8deg] group-hover:scale-110"
                      />
                    </span>
                  )}
                </span>
                <span className="mt-4 rounded-full bg-paper px-4 py-1.5 font-display text-lg leading-tight font-extrabold shadow-[0_3px_0_var(--color-line)] transition group-hover:-rotate-2 group-hover:bg-sun">
                  {c.title}
                </span>
                <span className="mt-1 text-sm text-ink-3">
                  {count} {count === 1 ? "gift" : "gifts"}
                </span>
              </Link>
            </motion.li>
          );
        })}
        <motion.li
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 220, damping: 15, delay: 0.3 }}
          className="lg:translate-y-10"
        >
          <Link href="/shop" className="group flex flex-col items-center text-center">
            <span className="grid aspect-square w-full max-w-[200px] place-items-center rounded-full border-[3px] border-dashed border-ink/30 transition group-hover:rotate-12 group-hover:border-ink group-hover:bg-sun">
              <span className="font-hand text-3xl leading-none">
                see it
                <br />
                all
              </span>
            </span>
            <span className="mt-4 px-4 py-1.5 font-display text-lg font-extrabold">The whole shop</span>
          </Link>
        </motion.li>
      </ul>
    </section>
  );
}
