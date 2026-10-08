"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/lib/format";

type Props = {
  className?: string;
  /** "head" is the face alone; "peek" adds two paws gripping a ledge. */
  pose?: "head" | "peek";
  /** Pupils follow the pointer. */
  track?: boolean;
  title?: string;
};

/**
 * The shop's panda, redrawn from the logo as a flat sticker. Pupils are moved
 * through CSS variables so tracking never re-renders React.
 */
export function Panda({ className, pose = "head", track = true, title }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!track) return;
    const svg = ref.current;
    if (!svg) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = svg.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.5;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const d = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, d / 260);
        svg.style.setProperty("--px", `${(dx / d) * 5 * reach}px`);
        svg.style.setProperty("--py", `${(dy / d) * 5 * reach}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [track]);

  const ink = "var(--color-ink)";
  return (
    <svg
      ref={ref}
      viewBox={pose === "peek" ? "0 0 220 210" : "0 0 220 190"}
      className={cx("overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <style>{`
        .pp { transform: translate(var(--px, 0px), var(--py, 0px)); transition: transform .18s ease-out; }
        .lid { transform-box: fill-box; transform-origin: center; animation: panda-blink 5.5s infinite; }
        @keyframes panda-blink { 0%, 93%, 100% { transform: scaleY(1); } 95.5% { transform: scaleY(0.08); } }
      `}</style>
      {/* ears */}
      <circle cx="50" cy="48" r="27" fill={ink} />
      <circle cx="170" cy="48" r="27" fill={ink} />
      <circle cx="52" cy="50" r="11" fill="#3b3550" />
      <circle cx="168" cy="50" r="11" fill="#3b3550" />
      {/* head */}
      <ellipse cx="110" cy="106" rx="86" ry="74" fill="#fff" stroke={ink} strokeWidth="6" />
      {/* eye patches */}
      <ellipse cx="76" cy="102" rx="23" ry="29" fill={ink} transform="rotate(32 76 102)" />
      <ellipse cx="144" cy="102" rx="23" ry="29" fill={ink} transform="rotate(-32 144 102)" />
      {/* eyes */}
      <g className="lid">
        <circle cx="79" cy="98" r="12.5" fill="#fff" />
        <g className="pp">
          <circle cx="80" cy="99" r="7.5" fill={ink} />
          <circle cx="77.5" cy="95.5" r="2.6" fill="#fff" />
        </g>
      </g>
      <g className="lid">
        <circle cx="141" cy="98" r="12.5" fill="#fff" />
        <g className="pp">
          <circle cx="140" cy="99" r="7.5" fill={ink} />
          <circle cx="137.5" cy="95.5" r="2.6" fill="#fff" />
        </g>
      </g>
      {/* blush */}
      <ellipse cx="52" cy="132" rx="12" ry="6.5" fill="var(--color-pink)" opacity="0.55" />
      <ellipse cx="168" cy="132" rx="12" ry="6.5" fill="var(--color-pink)" opacity="0.55" />
      {/* nose + mouth */}
      <path d="M100 124c6-4 14-4 20 0-2 7-6 10-10 10s-8-3-10-10z" fill={ink} />
      <path d="M99 140c3.5 5 8 5 11 0 3 5 7.5 5 11 0" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
      {pose === "peek" && (
        <g>
          <ellipse cx="58" cy="186" rx="30" ry="20" fill={ink} />
          <ellipse cx="162" cy="186" rx="30" ry="20" fill={ink} />
          <circle cx="46" cy="180" r="4" fill="#4a4460" />
          <circle cx="58" cy="176" r="4" fill="#4a4460" />
          <circle cx="70" cy="180" r="4" fill="#4a4460" />
          <circle cx="150" cy="180" r="4" fill="#4a4460" />
          <circle cx="162" cy="176" r="4" fill="#4a4460" />
          <circle cx="174" cy="180" r="4" fill="#4a4460" />
        </g>
      )}
    </svg>
  );
}
