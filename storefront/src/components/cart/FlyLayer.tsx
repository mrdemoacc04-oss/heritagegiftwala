"use client";

import { motion } from "motion/react";
import { bagTarget, useUI, type Flight } from "@/lib/store/ui";

/** Product images arc from where they were clicked into the bag icon. */
export function FlyLayer() {
  const flights = useUI((s) => s.flights);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[90]">
      {flights.map((f) => (
        <Flyer key={f.id} flight={f} />
      ))}
    </div>
  );
}

function Flyer({ flight }: { flight: Flight }) {
  const land = useUI((s) => s.land);
  const size = Math.min(flight.from.width, flight.from.height, 220);
  const startX = flight.from.left + flight.from.width / 2 - size / 2;
  const startY = flight.from.top + flight.from.height / 2 - size / 2;
  const t = bagTarget.el?.getBoundingClientRect();
  const endX = t ? t.left + t.width / 2 - size / 2 : window.innerWidth - 60;
  const endY = t ? t.top + t.height / 2 - size / 2 : 20;
  const peakY = Math.min(startY, endY) - 120;

  return (
    <motion.img
      src={flight.src}
      alt=""
      className="product-shadow absolute left-0 top-0 object-contain"
      style={{ width: size, height: size }}
      initial={{ x: startX, y: startY, scale: 1, rotate: 0, opacity: 1 }}
      animate={{
        x: [startX, (startX + endX) / 2, endX],
        y: [startY, peakY, endY],
        scale: [1, 0.7, 0.12],
        rotate: [0, -18, 20],
        opacity: [1, 1, 0.6],
      }}
      transition={{ duration: 0.85, ease: [0.45, 0, 0.2, 1], times: [0, 0.45, 1] }}
      onAnimationComplete={() => land(flight.id)}
    />
  );
}
