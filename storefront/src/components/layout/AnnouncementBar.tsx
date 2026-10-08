"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { InstagramLogoIcon, SparkleIcon } from "@phosphor-icons/react";
import { site } from "@/lib/site";

export function AnnouncementBar() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % site.announcements.length), 4200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative z-50 bg-ink text-white">
      <div className="mx-auto flex h-9 max-w-[1400px] items-center justify-center px-4 text-[13px] font-medium sm:justify-between sm:px-6">
        <span className="hidden items-center gap-1.5 text-white/70 sm:flex">
          <SparkleIcon size={14} weight="fill" className="text-sun" /> {site.domain}
        </span>
        <div className="relative h-5 overflow-hidden text-center" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={i}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {site.announcements[i]}
            </motion.p>
          </AnimatePresence>
        </div>
        <a
          href={`https://instagram.com/${site.instagram}`}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 text-white/70 transition hover:text-sun sm:flex"
        >
          <InstagramLogoIcon size={16} /> @{site.instagram}
        </a>
      </div>
    </div>
  );
}
