"use client";

import { createContext, useContext } from "react";
import { site } from "@/lib/site";
import type { Category, Product, ShopSettings } from "@/lib/types";

type Catalog = { products: Product[]; categories: Category[]; giftWrap?: Product; settings: ShopSettings; /** True once the shop is connected to its database; false means the built-in preview catalog. */ live: boolean };

const defaults: ShopSettings = { shippingFlat: site.shippingFlat, shippingExpress: site.expressShipping, freeShippingFrom: site.freeShippingThreshold };

const CatalogContext = createContext<Catalog>({ products: [], categories: [], settings: defaults, live: false });

export function CatalogProvider({ value, children }: { value: Catalog; children: React.ReactNode }) {
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
