"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type WishlistState = {
  handles: string[];
  toggle: (handle: string) => boolean;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      handles: [],
      toggle(handle) {
        const has = get().handles.includes(handle);
        set({ handles: has ? get().handles.filter((h) => h !== handle) : [handle, ...get().handles] });
        return !has;
      },
    }),
    { name: "hgw-wishlist", skipHydration: true },
  ),
);
