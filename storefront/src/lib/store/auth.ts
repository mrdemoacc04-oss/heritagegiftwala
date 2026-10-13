"use client";

import { create } from "zustand";
import type { HttpTypes } from "@medusajs/types";
import { medusaEnabled, sdk } from "@/lib/medusa";
import { useCart } from "@/lib/store/cart";

export type Customer = HttpTypes.StoreCustomer;

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

/** The SDK keeps the sign-in token here (JWT mode), so we can skip the network call when nobody is signed in. */
const hasToken = () => {
  try {
    return Boolean(window.localStorage.getItem("medusa_auth_token"));
  } catch {
    return false;
  }
};

const CUSTOMER_FIELDS = "+addresses";

async function fetchCustomer(): Promise<Customer | null> {
  if (!sdk || !hasToken()) return null;
  try {
    const { customer } = await sdk.store.customer.retrieve({ fields: CUSTOMER_FIELDS });
    return customer;
  } catch {
    // Expired or invalid token: treat as signed out.
    try {
      await sdk.auth.logout();
    } catch {}
    return null;
  }
}

/** Turns the backend's technical errors into something a shopper can act on. */
function friendly(e: unknown, fallback: string) {
  const msg = e instanceof Error ? e.message : "";
  if (/invalid email or password|unauthorized/i.test(msg)) return "That email and password don't match. Please try again.";
  if (/already exists|already registered|duplicate/i.test(msg)) return "An account with this email already exists. Try signing in instead.";
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return "We couldn't reach the shop right now. Please check your connection and try again.";
  return msg && msg.length < 140 ? msg : fallback;
}

export const useAuth = create<AuthState>()((set, get) => ({
  customer: null,
  ready: !medusaEnabled,

  async init() {
    if (!medusaEnabled || get().ready) return;
    set({ customer: await fetchCustomer(), ready: true });
  },

  async refresh() {
    set({ customer: await fetchCustomer() });
  },

  async login(email, password) {
    if (!sdk) throw new Error("Accounts are available once the shop's backend is connected.");
    try {
      await sdk.auth.login("customer", "emailpass", { email: email.trim().toLowerCase(), password });
    } catch (e) {
      throw new Error(friendly(e, "We couldn't sign you in. Please try again."));
    }
    const customer = await fetchCustomer();
    if (!customer) throw new Error("We couldn't sign you in. Please try again.");
    // A bag started as a guest follows the shopper into their account.
    const cartId = useCart.getState().cartId;
    if (cartId) {
      try {
        await sdk.store.cart.transferCart(cartId);
      } catch {
        // The bag may already belong to this customer, or have been completed; nothing to do.
      }
    }
    set({ customer, ready: true });
  },

  async register({ firstName, lastName, email, phone, password }) {
    if (!sdk) throw new Error("Accounts are available once the shop's backend is connected.");
    const address = email.trim().toLowerCase();
    try {
      const token = await sdk.auth.register("customer", "emailpass", { email: address, password });
      if (typeof token !== "string") throw new Error("We couldn't create your account. Please try again.");
      // The registration token only proves the email and password. It creates the customer record;
      // signing in afterwards gives the token that actually belongs to the new customer.
      await sdk.store.customer.create(
        { email: address, first_name: firstName.trim(), last_name: lastName.trim(), phone: phone?.trim() || undefined },
        {},
        { Authorization: `Bearer ${token}` },
      );
    } catch (e) {
      throw new Error(friendly(e, "We couldn't create your account. Please try again."));
    }
    await get().login(address, password);
  },

  async logout() {
    try {
      await sdk?.auth.logout();
    } catch {}
    set({ customer: null });
    // The bag belongs to the signed-in customer; the next shopper on this browser starts fresh.
    useCart.getState().clear();
  },

  setCustomer(customer) {
    set({ customer });
  },
}));
