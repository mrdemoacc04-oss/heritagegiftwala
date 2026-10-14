"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, Product, WrapChoice } from "@/lib/types";

export type CartProduct = Pick<Product, "id" | "handle" | "title" | "image" | "tint" | "price">;

type CartState = {
  lines: CartLine[];
  add: (product: CartProduct, quantity?: number, wrap?: WrapChoice) => Promise<void>;
  setQuantity: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  clear: () => void;
  /** Updates prices and names after checkout has re-priced the bag from the shop's database. */
  reprice: (prices: Record<string, { unit_price: number; title: string }>) => void;
};

const MAX_PER_LINE = 20;
const wrapKey = (w?: WrapChoice) => (w ? `${w.paper}|${w.ribbon}|${w.note}` : "");

/**
 * The bag lives in the shopper's browser. Prices shown here are a convenience: at checkout the server
 * re-prices every line from the database, so a stale or edited price never reaches an order.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      async add(product, quantity = 1, wrap) {
        const lines = get().lines;
        const match = lines.find((l) => l.productId === product.id && wrapKey(l.wrap) === wrapKey(wrap));
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
                  wrap,
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
      reprice(prices) {
        set({ lines: get().lines.map((l) => (prices[l.productId] ? { ...l, price: prices[l.productId].unit_price, title: prices[l.productId].title } : l)) });
      },
    }),
    {
      name: "hgw-bag-v2",
      skipHydration: true,
      partialize: (s) => ({ lines: s.lines }),
    },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.price * l.quantity, 0);
