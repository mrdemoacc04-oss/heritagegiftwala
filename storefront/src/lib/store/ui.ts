"use client";

import { create } from "zustand";

export type Flight = { id: number; src: string; from: DOMRect };
export type Toast = { id: number; title: string; image: string; tint: string };

type UIState = {
  cartOpen: boolean;
  searchOpen: boolean;
  menuOpen: boolean;
  flights: Flight[];
  toast?: Toast;
  /** Increments every time something lands in the bag, so the bag icon can wiggle. */
  bump: number;
  setCartOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  fly: (src: string, from: DOMRect) => void;
  land: (id: number) => void;
  showToast: (t: Omit<Toast, "id">) => void;
  hideToast: () => void;
};

let seq = 0;

export const useUI = create<UIState>()((set, get) => ({
  cartOpen: false,
  searchOpen: false,
  menuOpen: false,
  flights: [],
  bump: 0,
  setCartOpen: (cartOpen) => set(cartOpen ? { cartOpen, menuOpen: false, toast: undefined } : { cartOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen, menuOpen: false }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  fly: (src, from) => set({ flights: [...get().flights, { id: ++seq, src, from }] }),
  land: (id) => set({ flights: get().flights.filter((f) => f.id !== id), bump: get().bump + 1 }),
  showToast: (t) => set({ toast: { ...t, id: ++seq } }),
  hideToast: () => set({ toast: undefined }),
}));

/** The bag icon in the header registers itself here so flying products know where to land. */
export const bagTarget: { el: HTMLElement | null } = { el: null };
