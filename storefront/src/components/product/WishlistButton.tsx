"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HeartIcon } from "@phosphor-icons/react";
import { useWishlist } from "@/lib/store/wishlist";
import { cx } from "@/lib/format";

const burst = Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2);

export function WishlistButton({ handle, title, className }: { handle: string; title: string; className?: string }) {
  const saved = useWishlist((s) => s.handles.includes(handle));
  const toggle = useWishlist((s) => s.toggle);
  const [pop, setPop] = useState(0);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (toggle(handle)) setPop((n) => n + 1);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
      className={cx(
        "grid size-10 place-items-center rounded-full bg-white/90 backdrop-blur transition hover:scale-110 active:scale-90",
        className,
      )}
    >
      <motion.span key={pop} initial={pop ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 12 }}>
        <HeartIcon size={20} weight={saved ? "fill" : "bold"} className={saved ? "text-ribbon" : "text-ink"} />
      </motion.span>
      <AnimatePresence>
        {pop > 0 &&
          burst.map((a, i) => (
            <motion.span
              key={`${pop}-${i}`}
              aria-hidden
              className="absolute size-1.5 rounded-full"
              style={{ background: i % 2 ? "var(--color-ribbon)" : "var(--color-sun)" }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: Math.cos(a) * 22, y: Math.sin(a) * 22, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
          ))}
      </AnimatePresence>
    </button>
  );
}
