"use client";

import { useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, GiftIcon, XIcon } from "@phosphor-icons/react";
import { useUI } from "@/lib/store/ui";

export function BagToast() {
  const toast = useUI((s) => s.toast);
  const hide = useUI((s) => s.hideToast);
  const openCart = useUI((s) => s.setCartOpen);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, 3600);
    return () => clearTimeout(t);
  }, [toast, hide]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4 sm:inset-x-auto sm:right-6 sm:bottom-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ y: 40, opacity: 0, rotate: -3, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-3xl border-2 border-ink bg-paper p-2.5 pr-3 shadow-[6px_6px_0_var(--color-ink)]"
          >
            <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl" style={{ background: toast.tint }}>
              {toast.image ? (
                <Image src={toast.image} alt="" width={56} height={56} className="size-12 object-contain" />
              ) : (
                <GiftIcon size={28} weight="duotone" className="text-ribbon" />
              )}
              <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-lagoon-600 text-white ring-2 ring-paper">
                <CheckIcon size={13} weight="bold" />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-hand text-xl leading-none text-ribbon">In the bag!</span>
              <span className="block truncate text-sm font-semibold">{toast.title}</span>
            </span>
            <button
              onClick={() => {
                hide();
                openCart(true);
              }}
              className="rounded-full bg-ink px-3.5 py-2 text-xs font-bold text-white transition hover:bg-ribbon"
            >
              View bag
            </button>
            <button onClick={hide} aria-label="Dismiss" className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-cream hover:text-ink">
              <XIcon size={16} weight="bold" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
