"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { PopupCard } from "@/components/promo/PopupCard";
import { useUI } from "@/lib/store/ui";

const KEY = "hgw-popup";
const DAY = 24 * 60 * 60 * 1000;
/** Pages where a popup would get in the way of something the customer is in the middle of. */
const QUIET = ["/checkout"];

type Seen = { v: number; at: number };
const readSeen = (): Seen | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};

/**
 * The sale popup the owner edits under "Sale popup" in the control panel. It waits a few seconds, shows once, and stays
 * away for the number of days the owner chose after it is closed. Saving the popup again (a new offer) shows it to
 * everyone once more.
 */
export function PromoPopup() {
  const popup = useCatalog().settings.popup;
  const path = usePathname();
  const busy = useUI((s) => s.cartOpen || s.searchOpen || s.menuOpen);
  const setPopupOpen = useUI((s) => s.setPopupOpen);
  const [eligible, setEligible] = useState(false);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const version = popup?.version;

  // Has this visitor already seen this version recently? (localStorage only exists in the browser, so it is read after mount.)
  useEffect(() => {
    if (!popup) return;
    const seen = readSeen();
    const fresh = !seen || seen.v !== popup.version || Date.now() - seen.at > popup.reshowDays * DAY;
    const open = !popup.endsAt || Date.now() < Date.parse(popup.endsAt);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEligible(fresh && open);
    setDismissed(false);
    setReady(false);
    // Re-run only for a new version of the popup, not for every re-render of its props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    if (!popup || !eligible) return;
    const t = setTimeout(() => setReady(true), popup.delay * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, eligible]);

  const open = Boolean(popup) && eligible && ready && !dismissed && !busy && !QUIET.some((q) => path === q || path.startsWith(`${q}/`));

  const close = () => {
    if (popup) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ v: popup.version, at: Date.now() } satisfies Seen));
      } catch {}
    }
    setDismissed(true);
  };

  useEffect(() => {
    setPopupOpen(open);
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab") return;
      // Keep Tab inside the popup while it is open.
      const items = dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button");
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      setPopupOpen(false);
      before?.focus?.();
    };
    // close() only reads the popup's version, which is what re-creates this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, setPopupOpen, version]);

  return (
    <AnimatePresence>
      {open && popup && (
        <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="promo-title" ref={dialogRef}>
          <motion.button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="fixed inset-0 bg-ink/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            className="relative my-auto w-full max-w-[440px]"
            initial={{ opacity: 0, scale: 0.8, rotate: -3, y: 30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <PopupCard popup={popup} onClose={close} onButton={close} closeRef={closeRef} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
