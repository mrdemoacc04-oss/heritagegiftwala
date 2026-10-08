"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HttpTypes } from "@medusajs/types";
import { medusaEnabled, regionId, sdk } from "@/lib/medusa";
import type { CartLine, Product, WrapChoice } from "@/lib/types";

export type CartProduct = Pick<Product, "id" | "handle" | "title" | "image" | "tint" | "price" | "variantId">;

type CartState = {
  lines: CartLine[];
  cartId?: string;
  busy: boolean;
  error?: string;
  add: (product: CartProduct, quantity?: number, wrap?: WrapChoice) => Promise<void>;
  setQuantity: (lineId: string, quantity: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  clear: () => void;
};

const wrapKey = (w?: WrapChoice) => (w ? `${w.paper}|${w.ribbon}|${w.note}` : "");

/** Medusa line items → storefront lines. Shop-only bits ride along in line metadata. */
function linesFrom(cart: HttpTypes.StoreCart): CartLine[] {
  return (cart.items ?? []).map((item) => {
    const m = (item.metadata ?? {}) as Record<string, string>;
    return {
      id: item.id,
      productId: item.product_id ?? "",
      handle: item.product_handle ?? "",
      title: item.product_title ?? item.title,
      image: item.thumbnail ?? "",
      tint: m.tint ?? "#F4E9D8",
      price: Number(item.unit_price),
      quantity: item.quantity,
      variantId: item.variant_id ?? undefined,
      wrap: m.wrap_paper ? { paper: m.wrap_paper, ribbon: m.wrap_ribbon ?? "", note: m.wrap_note ?? "" } : undefined,
    };
  });
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => {
      async function ensureCartId() {
        const existing = get().cartId;
        if (existing) return existing;
        const { cart } = await sdk!.store.cart.create({ region_id: regionId });
        set({ cartId: cart.id });
        return cart.id;
      }

      /** Runs a Medusa cart call, recreating the cart once if the stored one has expired. */
      async function remote(fn: (cartId: string) => Promise<HttpTypes.StoreCart>) {
        set({ busy: true, error: undefined });
        try {
          let cart: HttpTypes.StoreCart;
          try {
            cart = await fn(await ensureCartId());
          } catch {
            set({ cartId: undefined });
            cart = await fn(await ensureCartId());
          }
          set({ lines: linesFrom(cart) });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : "Something went wrong with your bag." });
        } finally {
          set({ busy: false });
        }
      }

      return {
        lines: [],
        busy: false,
        async add(product, quantity = 1, wrap) {
          if (medusaEnabled && product.variantId) {
            await remote(async (cartId) => {
              const metadata: Record<string, string> = { tint: product.tint };
              if (wrap) Object.assign(metadata, { wrap_paper: wrap.paper, wrap_ribbon: wrap.ribbon, wrap_note: wrap.note });
              return (await sdk!.store.cart.createLineItem(cartId, { variant_id: product.variantId!, quantity, metadata })).cart;
            });
            return;
          }
          const lines = get().lines;
          const match = lines.find((l) => l.productId === product.id && wrapKey(l.wrap) === wrapKey(wrap));
          set({
            lines: match
              ? lines.map((l) => (l === match ? { ...l, quantity: l.quantity + quantity } : l))
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
                    quantity,
                    variantId: product.variantId,
                    wrap,
                  },
                ],
          });
        },
        async setQuantity(lineId, quantity) {
          if (quantity < 1) return get().remove(lineId);
          if (medusaEnabled && get().cartId) {
            await remote(async (cartId) => (await sdk!.store.cart.updateLineItem(cartId, lineId, { quantity })).cart);
            return;
          }
          set({ lines: get().lines.map((l) => (l.id === lineId ? { ...l, quantity } : l)) });
        },
        async remove(lineId) {
          if (medusaEnabled && get().cartId) {
            await remote(async (cartId) => {
              const res = await sdk!.store.cart.deleteLineItem(cartId, lineId);
              return res.parent as HttpTypes.StoreCart;
            });
            return;
          }
          set({ lines: get().lines.filter((l) => l.id !== lineId) });
        },
        clear() {
          set({ lines: [], cartId: undefined });
        },
      };
    },
    {
      name: "hgw-bag",
      skipHydration: true,
      partialize: (s) => ({ lines: s.lines, cartId: s.cartId }),
    },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.price * l.quantity, 0);
