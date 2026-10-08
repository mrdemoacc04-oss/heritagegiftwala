"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { CheckIcon, ScissorsIcon } from "@phosphor-icons/react";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { useAddToBag } from "@/lib/useAddToBag";
import { cx, formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { paperById, papers, ribbonById, ribbons } from "@/lib/wrap";
import type { WrapChoice } from "@/lib/types";

export function WrapStudio() {
  const [paper, setPaper] = useState(papers[0].id);
  const [ribbon, setRibbon] = useState(ribbons[0].id);
  const [note, setNote] = useState("");
  const [added, setAdded] = useState(false);
  const { giftWrap } = useCatalog();
  const add = useAddToBag();
  const boxRef = useRef<HTMLDivElement>(null);
  const price = giftWrap?.price ?? site.giftWrapPrice;

  const onAdd = async () => {
    if (!giftWrap) return;
    const wrap: WrapChoice = { paper, ribbon, note: note.trim() };
    await add(giftWrap, { wrap, from: null });
    const r = boxRef.current?.getBoundingClientRect();
    if (r) {
      confetti({
        particleCount: 70,
        spread: 75,
        startVelocity: 32,
        origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 3) / window.innerHeight },
        colors: ["#d72d4d", "#ffc93c", "#5adce3", "#ff8fb1", "#ffffff"],
        disableForReducedMotion: true,
      });
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <section id="wrap-studio" className="mx-auto max-w-[1400px] scroll-mt-24 px-4 pt-28 sm:px-6 sm:pt-36">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <WrapPreview ref={boxRef} paper={paper} ribbon={ribbon} note={note} />

        <div>
          <p className="font-hand text-3xl text-ribbon">our favourite part of the job</p>
          <h2 className="mt-1 text-[clamp(2.4rem,5vw,4.2rem)] leading-[0.95] font-extrabold">Wrap it your way</h2>
          <p className="mt-4 max-w-lg text-lg text-ink-2">
            Pick a paper, pick a ribbon, write the tag. We wrap it by hand at the shop, exactly like this.
          </p>

          <fieldset className="mt-8">
            <legend className="font-display text-sm font-bold tracking-[0.14em] uppercase">1 · Paper</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {papers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPaper(p.id)}
                  aria-pressed={paper === p.id}
                  aria-label={p.name}
                  title={p.name}
                  className={cx(
                    "relative size-14 rounded-2xl border-[3px] transition [transition-timing-function:var(--ease-spring)] hover:-translate-y-1 hover:rotate-3",
                    paper === p.id ? "scale-110 border-ink shadow-[3px_3px_0_var(--color-ink)]" : "border-white shadow-sm",
                  )}
                  style={p.style}
                >
                  {paper === p.id && (
                    <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-ink text-white">
                      <CheckIcon size={12} weight="bold" />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm font-semibold text-ink-2">{paperById(paper).name}</p>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="font-display text-sm font-bold tracking-[0.14em] uppercase">2 · Ribbon</legend>
            <div className="mt-3 flex flex-wrap gap-3">
              {ribbons.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRibbon(r.id)}
                  aria-pressed={ribbon === r.id}
                  aria-label={`${r.name} ribbon`}
                  title={r.name}
                  className={cx(
                    "size-10 rounded-full border-[3px] transition [transition-timing-function:var(--ease-spring)] hover:scale-110",
                    ribbon === r.id ? "scale-110 border-ink ring-4 ring-sun" : "border-ink/20",
                  )}
                  style={{ background: r.color }}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="font-display text-sm font-bold tracking-[0.14em] uppercase">3 · The tag</legend>
            <div className="relative mt-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 90))}
                rows={2}
                placeholder="Happy birthday, Didi! Love, Chintu"
                aria-label="Message for the gift tag"
                className="w-full resize-none rounded-2xl border-2 border-ink bg-white px-4 py-3 font-hand text-2xl leading-tight outline-none placeholder:text-ink-3 focus:shadow-[4px_4px_0_var(--color-lagoon-600)]"
              />
              <span className="absolute right-3 bottom-2 text-xs font-semibold text-ink-3">{note.length}/90</span>
            </div>
          </fieldset>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              onClick={onAdd}
              disabled={!giftWrap}
              className={cx(
                "group flex h-14 items-center gap-2 rounded-full px-7 text-lg font-bold text-white transition active:translate-y-1",
                added ? "bg-lagoon-600 shadow-[0_6px_0_var(--color-lagoon-800)]" : "bg-ribbon shadow-[0_6px_0_var(--color-ribbon-700)] hover:bg-ribbon-700",
              )}
            >
              {added ? <CheckIcon size={20} weight="bold" /> : <ScissorsIcon size={20} weight="bold" className="transition group-hover:-rotate-12" />}
              {added ? "Wrap added to your bag" : `Add gift wrap · ${formatPrice(price)}`}
            </button>
            <p className="max-w-[16rem] text-sm text-ink-2">One wrap per gift. Add one for every gift you&apos;d like us to wrap.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

type PreviewProps = { paper: string; ribbon: string; note: string; ref?: React.Ref<HTMLDivElement> };

/** A front-on parcel that re-wraps itself with a little hop whenever a choice changes. */
export function WrapPreview({ paper, ribbon, note, ref }: PreviewProps) {
  const p = paperById(paper);
  const r = ribbonById(ribbon);
  const edge = r.id === "white" ? "var(--color-ink)" : "transparent";
  return (
    <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-[3rem] bg-lagoon-100">
      <div aria-hidden className="dots absolute inset-0 [--dot:var(--color-lagoon)] [--dot-gap:26px] [--dot-size:2.4px]" />
      <motion.div
        key={`${paper}-${ribbon}`}
        initial={{ y: -40, scaleY: 0.9, scaleX: 1.06, rotate: -4 }}
        animate={{ y: 0, scaleY: 1, scaleX: 1, rotate: -2 }}
        transition={{ type: "spring", stiffness: 380, damping: 12 }}
        className="absolute bottom-[18%] left-[42%] h-[44%] w-[52%] -translate-x-1/2"
      >
        {/* lid */}
        <div className="absolute -inset-x-[5%] top-0 z-10 h-[24%] overflow-hidden rounded-xl border-[3px] border-ink" style={p.style}>
          <div className="absolute inset-0 bg-ink/10" />
          <div className="absolute inset-y-0 left-1/2 w-[15%] -translate-x-1/2" style={{ background: r.color, boxShadow: `inset 0 0 0 2px ${edge}` }} />
        </div>
        {/* body */}
        <div className="absolute inset-x-0 top-[20%] bottom-0 overflow-hidden rounded-b-xl border-[3px] border-ink" style={p.style}>
          <div className="absolute inset-y-0 left-1/2 w-[16%] -translate-x-1/2" style={{ background: r.color, boxShadow: `inset 0 0 0 2px ${edge}` }} />
          <div className="absolute inset-x-0 top-[44%] h-[16%]" style={{ background: r.color, boxShadow: `inset 0 0 0 2px ${edge}` }} />
        </div>
        {/* bow */}
        <svg viewBox="0 0 160 90" className="absolute -top-[30%] left-1/2 z-20 w-[52%] -translate-x-1/2" aria-hidden>
          <path d="M80 62 C 52 16, 4 16, 12 52 C 18 78, 58 76, 80 62Z" fill={r.color} stroke="var(--color-ink)" strokeWidth="5" strokeLinejoin="round" />
          <path d="M80 62 C 108 16, 156 16, 148 52 C 142 78, 102 76, 80 62Z" fill={r.color} stroke="var(--color-ink)" strokeWidth="5" strokeLinejoin="round" />
          <rect x="66" y="48" width="28" height="28" rx="8" fill={r.color} stroke="var(--color-ink)" strokeWidth="5" />
        </svg>
      </motion.div>

      {/* tag on a string */}
      <motion.div
        className="absolute top-0 right-[5%] z-30 w-[34%] origin-top"
        animate={{ rotate: [7, -3, 7] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 10 60" className="mx-auto h-16 w-2 sm:h-20" aria-hidden preserveAspectRatio="none">
          <path d="M5 0v60" stroke="var(--color-ink)" strokeWidth="2" strokeDasharray="4 3" />
        </svg>
        <div className="relative rounded-t-[2.2rem] rounded-b-2xl border-[3px] border-ink bg-paper px-4 pt-7 pb-4 shadow-[5px_5px_0_var(--color-ink)]">
          <span className="absolute top-2 left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-ink bg-cream" />
          <p className="min-h-[3.2em] text-center font-hand text-[clamp(1.1rem,2.4vw,1.6rem)] leading-tight break-words text-ink">
            {note.trim() || "Your note goes here ♥"}
          </p>
        </div>
      </motion.div>

      <p className="absolute bottom-[6%] left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-sm font-bold whitespace-nowrap shadow-sm">
        {p.name} + {r.name}
      </p>
    </div>
  );
}
