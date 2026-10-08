"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { InstagramLogoIcon, MapPinIcon, TagIcon, HandPointingIcon } from "@phosphor-icons/react";
import { site } from "@/lib/site";

const photos = [
  { src: "/shop/storefront.jpg", caption: "our front door (and a crochet bouquet)" },
  { src: "/shop/clock-wall.jpg", caption: "the clock wall, ticking away" },
  { src: "/shop/plush-aisle.jpg", caption: "the plushie aisle" },
  { src: "/shop/bag-shelf.jpg", caption: "bags, baskets & perfumes" },
];
const fan = [
  { rotate: -7, x: -26, y: 8 },
  { rotate: 5, x: 22, y: -6 },
  { rotate: -2, x: -6, y: -14 },
  { rotate: 9, x: 30, y: 12 },
];

/** `children` is rendered under the photos and copy (the server page passes the map in). */
export function ShopVisit({ children }: { children?: React.ReactNode }) {
  // The last entry sits on top; tapping it slides it to the bottom of the pile.
  const [order, setOrder] = useState(() => photos.map((_, i) => i).reverse());
  const shuffle = () => setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);

  return (
    <section id="visit" className="mx-auto max-w-[1400px] scroll-mt-24 px-4 pt-28 pb-16 sm:px-6 sm:pt-36">
      <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
        <div className="relative mx-auto h-[440px] w-full max-w-[420px] sm:h-[520px]">
          {order.map((idx, depth) => {
            const p = photos[idx];
            const f = fan[idx];
            const top = depth === order.length - 1;
            return (
              <motion.button
                key={p.src}
                onClick={top ? shuffle : undefined}
                aria-label={top ? "Show the next photo" : undefined}
                tabIndex={top ? 0 : -1}
                className="absolute inset-x-6 top-4 rounded-md bg-white p-3 pb-14 shadow-[0_20px_40px_-18px_rgb(30_27_46/0.45)] sm:inset-x-0"
                style={{ zIndex: depth }}
                animate={{ rotate: f.rotate, x: f.x, y: f.y, scale: top ? 1 : 0.96 }}
                whileHover={top ? { rotate: 0, scale: 1.02 } : undefined}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <span className="relative block aspect-[4/5] overflow-hidden rounded-sm bg-cream">
                  <Image src={p.src} alt={p.caption} fill sizes="420px" className="object-cover" />
                </span>
                <span className="absolute inset-x-0 bottom-3 font-hand text-2xl text-ink">{p.caption}</span>
              </motion.button>
            );
          })}
          <span className="absolute -top-3 left-1/2 z-20 h-8 w-28 -translate-x-1/2 -rotate-3 bg-sun/80 shadow-sm" aria-hidden />
          <p className="absolute -bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-ink-2">
            <HandPointingIcon size={16} weight="bold" /> tap the photo to flip through
          </p>
        </div>

        <div>
          <p className="font-hand text-3xl text-ribbon">come say hi</p>
          <h2 className="mt-1 text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.95] font-extrabold">A real shop, with real shelves.</h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Every gift on this site sits on a shelf in our shop on University Road, Patan. Drop by to pick things up, squeeze the plushies and watch the clocks
            tick, or let us pack your order and send it to your door.
          </p>
          <div className="mt-7 flex max-w-xl items-start gap-4 rounded-3xl border-2 border-dashed border-ink/30 bg-white p-5">
            <span className="grid size-12 shrink-0 -rotate-6 place-items-center rounded-2xl bg-ribbon text-white">
              <TagIcon size={24} weight="bold" />
            </span>
            <div>
              <p className="font-display text-xl font-extrabold">Fix rate. Always.</p>
              <p className="mt-1 text-ink-2">The price on the tag is the price, for everyone. No bargaining, no surprises at the counter or at checkout.</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#map"
              className="flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-bold text-white shadow-[0_5px_0_var(--color-lagoon-600)] transition hover:bg-lagoon-800 active:translate-y-1 active:shadow-none"
            >
              <MapPinIcon size={20} weight="bold" /> {site.address.street.split(",")[0]}, {site.address.city}
            </a>
            <a
              href={`https://instagram.com/${site.instagram}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full border-2 border-ink bg-white px-6 py-3 font-bold transition hover:-rotate-1 hover:bg-pink"
            >
              <InstagramLogoIcon size={20} weight="bold" /> @{site.instagram}
            </a>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
