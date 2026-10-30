"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, Product } from "@/lib/types";

export type CartProduct = Pick<Product, "id" | "handle" | "title" | "image" | "tint" | "price">;

type CartState = {
  lines: CartLine[];
  add: (product: CartProduct, quantity?: number) => Promise<void>;
  setQuantity: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  clear: () => void;
  /** Brings every line up to date with the shop (names, photos, prices) and drops products that are gone, so a bag kept for days never shows a price the owner has since changed. */
  sync: (products: CartProduct[]) => void;
};

const MAX_PER_LINE = 20;
const MISSES_BEFORE_DROP = 3;

/**
 * The bag lives in the shopper's browser. It is a list of what the shopper wants: the order itself is
 * agreed with the shop on WhatsApp, so a price kept here is only a convenience.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      async add(product, quantity = 1) {
        const lines = get().lines;
        const match = lines.find((l) => l.productId === product.id);
        set({
          lines: match
            ? lines.map((l) => (l === match ? { ...l, quantity: Math.min(MAX_PER_LINE, l.quantity + quantity) } : l))
            : [
                ...lines,
                {
                  id: `${product.id}-${Date.now().toString(36)}`,
                  productId: product.id,
                  handle: product.handle,
                  title: product.title,
                  image: product.image,
                  tint: product.tint,
                  price: product.price,
                  quantity: Math.min(MAX_PER_LINE, quantity),
                },
              ],
        });
      },
      async setQuantity(lineId, quantity) {
        if (quantity < 1) return get().remove(lineId);
        set({ lines: get().lines.map((l) => (l.id === lineId ? { ...l, quantity: Math.min(MAX_PER_LINE, quantity) } : l)) });
      },
      async remove(lineId) {
        set({ lines: get().lines.filter((l) => l.id !== lineId) });
      },
      clear() {
        set({ lines: [] });
      },
      sync(products) {
        // An empty catalog means "couldn't load it", never "everything was removed".
        if (!products.length) return;
        const byId = new Map(products.map((p) => [p.id, p]));
        const before = get().lines;
        const after = before.flatMap<CartLine>((l) => {
          const p = byId.get(l.productId);
          if (p) return [{ ...l, handle: p.handle, title: p.title, image: p.image, tint: p.tint, price: p.price, missed: undefined }];
          const missed = (l.missed ?? 0) + 1;
          return missed >= MISSES_BEFORE_DROP ? [] : [{ ...l, missed }];
        });
        if (JSON.stringify(after) !== JSON.stringify(before)) set({ lines: after });
      },
    }),
    {
      name: "hgw-bag-v2",
      // Version 1 drops the gift-wrap lines (and their wrap details) that bags saved before the gift-wrap service was removed may hold.
      version: 1,
      migrate: (stored) => {
        const lines = ((stored as { lines?: (CartLine & { wrap?: unknown })[] } | null)?.lines ?? [])
          .filter((l) => l.handle !== "gift-wrap")
          .map((l) => {
            const kept = { ...l };
            delete kept.wrap;
            return kept;
          });
        return { lines };
      },
      skipHydration: true,
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
/** The bag's total, or null while any item has no price (the shop quotes those on WhatsApp). */
export const cartSubtotal = (lines: CartLine[]): number | null =>
  lines.every((l) => l.price !== null) ? lines.reduce((n, l) => n + (l.price ?? 0) * l.quantity, 0) : null;
