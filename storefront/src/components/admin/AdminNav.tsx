"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/format";

const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Shelves" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/popup", label: "Sale popup" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/account", label: "My login" },
];

export function AdminNav({ newOrders }: { newOrders: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Control panel" className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((l) => {
        const active = l.exact ? path === l.href : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cx("flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold transition", active ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-200/70")}
          >
            {l.label}
            {l.href === "/admin/orders" && newOrders > 0 && <span className={cx("rounded-full px-2 py-0.5 text-xs font-bold", active ? "bg-white text-stone-900" : "bg-red-600 text-white")}>{newOrders}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
