"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CaretDownIcon, HandbagSimpleIcon, HeartIcon, ListIcon, MagnifyingGlassIcon, XIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { cartCount, useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { bagTarget, useUI } from "@/lib/store/ui";
import { cx, formatPrice } from "@/lib/format";

const links = [
  { href: "/collections/gift-hampers", label: "Hampers" },
  { href: "/gift-finder", label: "Gift Finder" },
  { href: "/#visit", label: "Our Shop" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState(false);
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);
  const wish = useWishlist((s) => s.handles.length);
  const { setCartOpen, setSearchOpen, setMenuOpen, menuOpen, bump } = useUI();
  const bagRef = useRef<HTMLButtonElement>(null);
  const count = cartCount(lines);

  useEffect(() => {
    bagTarget.el = bagRef.current;
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mega menu whenever the route changes (menu links also close it on click).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMega(false);
  }

  return (
    <header
      className={cx(
        "sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300",
        scrolled || mega ? "bg-cream/90 shadow-[0_1px_0_var(--color-line)] backdrop-blur-xl" : "bg-transparent",
      )}
      onMouseLeave={() => setMega(false)}
    >
      <div className="mx-auto flex h-[74px] max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <button
          className="grid size-11 place-items-center rounded-full border-2 border-ink lg:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <ListIcon size={20} weight="bold" />
        </button>

        <Link href="/" className="group flex items-center gap-2.5" aria-label="Heritage Gift Wala — home">
          <Image
            src="/brand/logo-sm.png"
            alt=""
            width={56}
            height={56}
            priority
            className="size-12 transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:-rotate-12 group-hover:scale-110 sm:size-14"
          />
          <span className="hidden leading-none sm:block">
            <span className="block font-display text-[1.35rem] font-extrabold tracking-tight">Heritage</span>
            <span className="block font-display text-[1.35rem] font-extrabold tracking-tight text-ribbon">Gift Wala</span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
          <button
            onMouseEnter={() => setMega(true)}
            onClick={() => setMega((m) => !m)}
            aria-expanded={mega}
            className={cx("flex items-center gap-1 rounded-full px-4 py-2 font-semibold transition", mega ? "bg-ink text-white" : "hover:bg-white")}
          >
            Shop
            <CaretDownIcon size={14} weight="bold" className={cx("transition", mega && "rotate-180")} />
          </button>
          {links.map((l) => (
            <Link key={l.href} href={l.href} onMouseEnter={() => setMega(false)} className="rounded-full px-4 py-2 font-semibold transition hover:bg-white">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden h-11 items-center gap-2 rounded-full border-2 border-ink/90 bg-white pr-2 pl-4 text-sm font-semibold text-ink-2 transition hover:shadow-[3px_3px_0_var(--color-ink)] md:flex"
          >
            <MagnifyingGlassIcon size={18} weight="bold" className="text-ink" />
            Search gifts
            <kbd className="ml-3 rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-ink-3">⌘K</kbd>
          </button>
          <button onClick={() => setSearchOpen(true)} aria-label="Search" className="grid size-11 place-items-center rounded-full hover:bg-white md:hidden">
            <MagnifyingGlassIcon size={22} weight="bold" />
          </button>
          <Link href="/wishlist" aria-label={`Wishlist, ${wish} saved`} className="relative grid size-11 place-items-center rounded-full transition hover:bg-white">
            <HeartIcon size={23} weight={wish ? "fill" : "bold"} className={wish ? "text-ribbon" : ""} />
            {wish > 0 && <Badge n={wish} className="bg-ink text-white" />}
          </Link>
          <button
            ref={bagRef}
            onClick={() => setCartOpen(true)}
            aria-label={`Open bag, ${count} items`}
            className="relative grid size-12 place-items-center rounded-full bg-lagoon transition hover:bg-sun"
          >
            <motion.span key={bump} animate={bump ? { rotate: [0, -16, 12, -6, 0], scale: [1, 1.25, 0.95, 1.05, 1] } : {}} transition={{ duration: 0.6 }}>
              <HandbagSimpleIcon size={24} weight="bold" />
            </motion.span>
            {count > 0 && <Badge n={count} className="bg-ribbon text-white" />}
          </button>
        </div>
      </div>

      <AnimatePresence>{mega && <MegaMenu onClose={() => setMega(false)} />}</AnimatePresence>
    </header>
  );
}

function Badge({ n, className }: { n: number; className: string }) {
  return (
    <motion.span
      key={n}
      initial={{ scale: 0.4 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 15 }}
      className={cx("absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ring-2 ring-cream", className)}
    >
      {n}
    </motion.span>
  );
}

function MegaMenu({ onClose }: { onClose: () => void }) {
  const { categories, products } = useCatalog();
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  const hamper = byHandle.get("hamper-just-for-you");
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-x-0 top-full hidden border-t border-line bg-cream/95 pb-8 shadow-[0_30px_60px_-30px_rgb(30_27_46/0.35)] backdrop-blur-xl lg:block"
    >
      <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_340px] gap-10 px-6 pt-6">
        <div>
          <p className="font-hand text-2xl text-ribbon">Pick a shelf</p>
          <ul className="mt-3 grid grid-cols-4 gap-x-4 gap-y-3 xl:grid-cols-4">
            {categories.map((c, i) => {
              const cover = byHandle.get(c.cover);
              return (
                <motion.li key={c.handle} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
                  <Link href={`/collections/${c.handle}`} onClick={onClose} className="group flex items-center gap-3 rounded-2xl p-1.5 pr-3 transition hover:bg-white">
                    <span className="relative grid size-14 shrink-0 place-items-center rounded-full" style={{ background: c.tint }}>
                      {cover && (
                        <Image
                          src={cover.image}
                          alt=""
                          width={64}
                          height={64}
                          className="product-shadow size-14 object-contain transition duration-300 [transition-timing-function:var(--ease-spring)] group-hover:-translate-y-2 group-hover:-rotate-6 group-hover:scale-110"
                        />
                      )}
                    </span>
                    <span className="font-semibold leading-tight">{c.title}</span>
                  </Link>
                </motion.li>
              );
            })}
            <li>
              <Link href="/shop" onClick={onClose} className="flex h-full items-center gap-2 rounded-2xl border-2 border-dashed border-ink/30 px-4 font-bold transition hover:border-ink hover:bg-sun">
                Everything <ArrowRightIcon size={16} weight="bold" />
              </Link>
            </li>
          </ul>
        </div>
        {hamper && (
          <Link
            href={`/products/${hamper.handle}`}
            onClick={onClose}
            className="group relative overflow-hidden rounded-[2rem] p-5"
            style={{ background: hamper.tint }}
          >
            <span className="dots absolute inset-0 opacity-60 [--dot-gap:16px]" />
            <span className="relative block font-hand text-2xl text-ribbon">Our most-gifted hamper</span>
            <span className="relative mt-1 block max-w-[12ch] font-display text-2xl leading-tight font-extrabold">{hamper.title}</span>
            <span className="relative mt-2 inline-block rounded-full bg-ink px-3 py-1 text-sm font-bold text-white">{formatPrice(hamper.price)}</span>
            <Image
              src={hamper.image}
              alt=""
              width={220}
              height={220}
              className="product-shadow absolute -right-4 -bottom-6 w-44 rotate-6 transition duration-500 [transition-timing-function:var(--ease-spring)] group-hover:rotate-0 group-hover:scale-105"
            />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

/** Rendered by ClientShell, outside the header: its backdrop-filter would trap a fixed overlay. */
export function MobileMenuOverlay() {
  const menuOpen = useUI((s) => s.menuOpen);
  const setMenuOpen = useUI((s) => s.setMenuOpen);
  return <AnimatePresence>{menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}</AnimatePresence>;
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const { categories, products } = useCatalog();
  const byHandle = new Map(products.map((p) => [p.handle, p]));
  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <motion.button aria-label="Close menu" className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.nav
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        data-lenis-prevent
        className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-cream"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <Image src="/brand/logo-sm.png" alt="Heritage Gift Wala" width={52} height={52} className="size-12" />
          <button onClick={onClose} aria-label="Close menu" className="grid size-11 place-items-center rounded-full border-2 border-ink">
            <XIcon size={18} weight="bold" />
          </button>
        </div>
        <div className="mt-6 grid gap-1 px-3">
          {[{ href: "/shop", label: "Shop everything" }, ...links].map((l, i) => (
            <motion.div key={l.href} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
              <Link href={l.href} onClick={onClose} className="block rounded-2xl px-3 py-2.5 font-display text-3xl font-extrabold active:bg-white">
                {l.label}
              </Link>
            </motion.div>
          ))}
        </div>
        <p className="mt-6 px-6 font-hand text-2xl text-ribbon">Pick a shelf</p>
        <ul className="grid grid-cols-2 gap-2 px-4 pt-2 pb-8">
          {categories.map((c) => {
            const cover = byHandle.get(c.cover);
            return (
              <li key={c.handle}>
                <Link href={`/collections/${c.handle}`} onClick={onClose} className="flex flex-col items-center gap-1 rounded-2xl p-3 text-center text-sm font-semibold" style={{ background: c.tint }}>
                  {cover && <Image src={cover.image} alt="" width={64} height={64} className="product-shadow size-14 object-contain" />}
                  {c.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </motion.nav>
    </div>
  );
}
