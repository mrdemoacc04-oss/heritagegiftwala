"use client";

import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import Lenis from "lenis";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { useUI } from "@/lib/store/ui";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { FlyLayer } from "@/components/cart/FlyLayer";
import { BagToast } from "@/components/cart/BagToast";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { MobileMenuOverlay } from "@/components/layout/Header";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const setSearchOpen = useUI((s) => s.setSearchOpen);

  // Persisted stores hydrate after mount so server and client markup agree.
  useEffect(() => {
    useCart.persist.rehydrate();
    useWishlist.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95 });
    let raf = requestAnimationFrame(function loop(t) {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    });
    // Overlays lock the page; Lenis must stop with them.
    const unsub = useUI.subscribe((s) => (s.cartOpen || s.searchOpen || s.menuOpen ? lenis.stop() : lenis.start()));
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearchOpen]);

  return (
    <MotionConfig reducedMotion="user">
      {children}
      <CartDrawer />
      <SearchOverlay />
      <MobileMenuOverlay />
      <FlyLayer />
      <BagToast />
    </MotionConfig>
  );
}
