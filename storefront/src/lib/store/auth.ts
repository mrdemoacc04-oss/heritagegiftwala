"use client";

import { create } from "zustand";
import { useCart } from "@/lib/store/cart";

export type Address = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  address_1: string;
  address_2: string;
  city: string;
  province: string;
  postal_code: string;
  is_default_shipping: boolean;
};

export type Customer = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  created_at: string;
  addresses: Address[];
};

export type RegisterInput = { firstName: string; lastName: string; email: string; phone?: string; password: string };

type AuthState = {
  customer: Customer | null;
  /** True once the first "am I signed in?" check has finished, so screens don't flash the wrong state. */
  ready: boolean;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setCustomer: (customer: Customer) => void;
};

/** The server also drops a harmless, readable "hgw_in" hint when someone signs in, so signed-out visitors cost no request. */
const likelySignedIn = () => typeof document !== "undefined" && /(?:^|;\s*)hgw_in=1/.test(document.cookie);

async function fetchCustomer(): Promise<Customer | null> {
  try {
    const res = await fetch("/api/account/me", { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { customer: Customer | null }).customer;
  } catch {
    return null;
  }
}

async function send(url: string, body: unknown, fallback: string) {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("We couldn't reach the shop right now. Please check your connection and try again.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.message === "string" ? data.message : fallback);
  }
}

export const useAuth = create<AuthState>()((set, get) => ({
  customer: null,
  ready: false,

  async init() {
    if (get().ready) return;
    set({ customer: likelySignedIn() ? await fetchCustomer() : null, ready: true });
  },

  async refresh() {
    set({ customer: await fetchCustomer() });
  },

  async login(email, password) {
    await send("/api/account/login", { email, password }, "We couldn't sign you in. Please try again.");
    const customer = await fetchCustomer();
    if (!customer) throw new Error("We couldn't sign you in. Please try again.");
    set({ customer, ready: true });
  },

  async register({ firstName, lastName, email, phone, password }) {
    await send("/api/account/register", { first_name: firstName, last_name: lastName, email, phone: phone ?? "", password }, "We couldn't create your account. Please try again.");
    const customer = await fetchCustomer();
    if (!customer) throw new Error("We couldn't create your account. Please try again.");
    set({ customer, ready: true });
  },

  async logout() {
    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {}
    set({ customer: null });
    // The bag stays on this device for the next shopper only if they were signed out.
    useCart.getState().clear();
  },

  setCustomer(customer) {
    set({ customer });
  },
}));
