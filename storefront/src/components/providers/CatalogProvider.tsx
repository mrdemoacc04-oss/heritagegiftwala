"use client";

import { createContext, useContext } from "react";
import type { Category, Product } from "@/lib/types";

type Catalog = { products: Product[]; categories: Category[]; giftWrap?: Product };

const CatalogContext = createContext<Catalog>({ products: [], categories: [] });

export function CatalogProvider({ value, children }: { value: Catalog; children: React.ReactNode }) {
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
