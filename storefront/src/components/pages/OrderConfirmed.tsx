"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { Panda } from "@/components/brand/Panda";
import { formatPrice } from "@/lib/format";
import { useAuth } from "@/lib/store/auth";
import { paperById } from "@/lib/wrap";
import type { CartLine } from "@/lib/types";

type Last = { orderNo: string; lines: CartLine[]; total: number; name: string; city: string; preview: boolean };

const read = (): Last | null => {
  try {
    return JSON.parse(sessionStorage.getItem("hgw-last-order") ?? "null");
  } catch {
    return null;
  }
};

export function OrderConfirmed() {
  const [order, setOrder] = useState<Last | null>(null);
  const signedIn = useAuth((s) => Boolean(s.customer));

  useEffect(() => {
    // sessionStorage only exists in the browser, so the receipt is read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(read());
    const colors = ["#d72d4d", "#ffc93c", "#5adce3", "#ff8fb1"];
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.35 }, colors, disableForReducedMotion: true });
    const t = setTimeout(() => {
      confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors, disableForReducedMotion: true });
      confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors, disableForReducedMotion: true });
    }, 450);
    return () => clearTimeout(t);
  }, []);

  const first = order?.name.split(" ")[0];

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-10 pb-24 text-center">
      <motion.div initial={{ y: 40, scale: 0.6, rotate: -20 }} animate={{ y: 0, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 12 }}>
        <Panda className="w-40" />
      </motion.div>
      <p className="mt-6 font-hand text-3xl text-ribbon">yay!</p>
      <h1 className="mt-1 text-[clamp(2.6rem,6vw,4.4rem)] leading-[0.95] font-extrabold">
        {first ? `Thank you, ${first}!` : "Thank you!"}
      </h1>
      <p className="mt-4 max-w-md text-lg text-ink-2">
        {order?.preview
          ? "This was a preview order, so nothing was sent to the shop. Once the store is live, this is where the good news lands."
          : "Your order is in. We're already picking it off the shelf and getting the ribbon out."}
      </p>
      {order && (
        <div className="mt-8 w-full rounded-[2rem] border-2 border-ink bg-paper p-6 text-left shadow-[6px_6px_0_var(--color-ink)]">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-ink-2">Order</span>
            <span className="font-display text-xl font-extrabold">{order.orderNo}</span>
          </div>
          <ul className="mt-4 space-y-3">
            {order.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={l.wrap && !l.image ? paperById(l.wrap.paper).style : { background: l.tint }}>
                  {l.image && <Image src={l.image} alt="" width={48} height={48} className="size-10 object-contain" />}
                </span>
                <span className="flex-1 text-sm font-semibold">
                  {l.title} <span className="text-ink-3">× {l.quantity}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-baseline justify-between border-t-2 border-dashed border-line pt-4">
            <span className="font-bold">Total</span>
            <span className="font-display text-2xl font-extrabold">{formatPrice(order.total)}</span>
          </div>
          <p className="mt-2 text-sm text-ink-2">Heading to {order.city}.</p>
        </div>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {order && !order.preview && (
          <Link href="/track" className="rounded-full border-2 border-ink bg-white px-7 py-3.5 text-lg font-bold hover:bg-lagoon">
            Track this order
          </Link>
        )}
        {signedIn && (
          <Link href="/account" className="rounded-full border-2 border-ink bg-white px-7 py-3.5 text-lg font-bold hover:bg-sun">
            View in my account
          </Link>
        )}
        <Link href="/shop" className="rounded-full bg-ink px-7 py-3.5 text-lg font-bold text-white shadow-[0_5px_0_var(--color-ribbon)] hover:bg-ribbon">
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
