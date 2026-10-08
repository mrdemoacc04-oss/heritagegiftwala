"use client";

import { useCallback } from "react";
import { useCart, type CartProduct } from "@/lib/store/cart";
import { useUI } from "@/lib/store/ui";
import type { WrapChoice } from "@/lib/types";

/**
 * Adds a product and plays the "fly into the bag" moment from whatever element
 * the shopper clicked (usually the product image).
 */
export function useAddToBag() {
  const add = useCart((s) => s.add);
  const fly = useUI((s) => s.fly);
  const showToast = useUI((s) => s.showToast);

  return useCallback(
    async (product: CartProduct, opts: { from?: Element | null; quantity?: number; wrap?: WrapChoice; silent?: boolean } = {}) => {
      if (opts.from && product.image) fly(product.image, opts.from.getBoundingClientRect());
      await add(product, opts.quantity ?? 1, opts.wrap);
      if (!opts.silent) showToast({ title: product.title, image: product.image, tint: product.tint });
    },
    [add, fly, showToast],
  );
}
