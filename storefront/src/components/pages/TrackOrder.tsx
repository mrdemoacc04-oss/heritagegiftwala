"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { CheckIcon, GiftIcon, PackageIcon, SpinnerGapIcon, TruckIcon, HouseLineIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Panda } from "@/components/brand/Panda";
import { medusaEnabled, sdk } from "@/lib/medusa";
import { cx, formatPrice, ownPhoto } from "@/lib/format";
import { site } from "@/lib/site";

type Stage = "placed" | "packed" | "shipped" | "delivered" | "cancelled";

type Tracked = {
  number: number;
  placed_at: string | null;
  stage: Stage;
  packed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  first_name: string | null;
  city: string | null;
  delivery: string | null;
  tracking: { number: string | null; url: string | null }[];
  paid: boolean;
  items: { title: string; quantity: number; unit_price: number; thumbnail: string | null; tint: string | null; gift_wrapped: boolean }[];
  subtotal: number;
  shipping_total: number;
  total: number;
};

const STEPS = [
  { stage: "placed", label: "Order placed", icon: GiftIcon, at: "placed_at" },
  { stage: "packed", label: "Packed with love", icon: PackageIcon, at: "packed_at" },
  { stage: "shipped", label: "On its way", icon: TruckIcon, at: "shipped_at" },
  { stage: "delivered", label: "Delivered", icon: HouseLineIcon, at: "delivered_at" },
] as const;

const HEADLINES: Record<Stage, { hand: string; text: string }> = {
  placed: { hand: "got it!", text: "We've received your order and are getting it ready." },
  packed: { hand: "wrapping up", text: "Your order is packed and waiting for the courier." },
  shipped: { hand: "on the move", text: "Your order has left the shop and is on its way to you." },
  delivered: { hand: "all done!", text: "Your order has been delivered. We hope it makes someone smile." },
  cancelled: { hand: "cancelled", text: "This order was cancelled. If that's a surprise, message us and we'll help." },
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : null;

/** The checkout leaves the last order here so the tracking form can fill itself in. */
function lastOrder(): { number: string; email: string } {
  try {
    const o = JSON.parse(sessionStorage.getItem("hgw-last-order") ?? "null");
    if (o && !o.preview) return { number: String(o.orderNo ?? "").replace(/\D/g, ""), email: o.email ?? "" };
  } catch {}
  return { number: "", email: "" };
}

export function TrackOrder() {
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [order, setOrder] = useState<Tracked>();

  useEffect(() => {
    const last = lastOrder();
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("order")?.replace(/\D/g, "") ?? "";
    const emailFromUrl = params.get("email") ?? "";
    // sessionStorage only exists in the browser, so the form is prefilled after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setNumber(fromUrl || last.number);
    setEmail(emailFromUrl || last.email);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdk) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await sdk.client.fetch<{ order: Tracked }>("/store/track-order", {
        method: "POST",
        body: { order_number: number, email },
      });
      setOrder(res.order);
    } catch (err) {
      setOrder(undefined);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 pt-6 pb-24 sm:px-6">
      <p className="font-hand text-3xl text-ribbon">where&apos;s my gift?</p>
      <h1 className="mt-1 text-[clamp(2.6rem,6vw,4.6rem)] leading-[0.95] font-extrabold">Track your order</h1>

      {!medusaEnabled ? (
        <p className="mt-8 rounded-2xl bg-sun-100 p-5 font-semibold">
          Order tracking switches on when the store goes live. Until then, orders placed here are only a preview.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 grid gap-4 rounded-[2rem] border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_var(--color-ink)] sm:grid-cols-[1fr_1.6fr_auto] sm:items-end">
          <label>
            <span className="text-sm font-bold">Order number</span>
            <input
              required
              inputMode="numeric"
              placeholder="e.g. 1042"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 font-semibold outline-none transition focus:border-ink"
            />
          </label>
          <label>
            <span className="text-sm font-bold">Email used at checkout</span>
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 font-semibold outline-none transition focus:border-ink"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-ink px-6 font-bold text-white transition hover:bg-ribbon disabled:opacity-60"
          >
            {busy ? <SpinnerGapIcon size={18} weight="bold" className="animate-spin" /> : <MagnifyingGlassIcon size={18} weight="bold" />}
            Track
          </button>
          {error && <p className="rounded-xl bg-ribbon-100 px-3 py-2 text-sm font-semibold text-ribbon-700 sm:col-span-3">{error}</p>}
        </form>
      )}

      {order && <Result order={order} />}

      {!order && (
        <div className="mt-12 flex flex-col items-center text-center text-ink-2">
          <Panda className="w-28" />
          <p className="mt-3 max-w-sm">Your order number is in the confirmation you saw after checkout. Can&apos;t find it? Call us on {site.phone.display}.</p>
        </div>
      )}
    </div>
  );
}

function Result({ order }: { order: Tracked }) {
  const cancelled = order.stage === "cancelled";
  const reached = cancelled ? -1 : STEPS.findIndex((s) => s.stage === order.stage);
  const headline = HEADLINES[order.stage];

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-10" aria-live="polite">
      <p className="font-hand text-3xl text-ribbon">{headline.hand}</p>
      <h2 className="mt-1 text-4xl font-extrabold">
        {order.first_name ? `${order.first_name}, order #${order.number}` : `Order #${order.number}`}
      </h2>
      <p className="mt-2 text-lg text-ink-2">{headline.text}</p>

      {!cancelled && (
        <ol className="mt-8 grid gap-4 sm:grid-cols-4">
          {STEPS.map((s, i) => {
            const done = i <= reached;
            const Icon = s.icon;
            const time = when(order[s.at]);
            return (
              <li key={s.stage} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
                <span className={cx("grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink", done ? "bg-lagoon" : "bg-white text-ink-3")}>
                  {done && i < reached ? <CheckIcon size={22} weight="bold" /> : <Icon size={22} weight="duotone" />}
                </span>
                <span>
                  <span className={cx("block font-bold", !done && "text-ink-3")}>{s.label}</span>
                  <span className="block text-sm text-ink-2">{done ? time : "Not yet"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {order.tracking.length > 0 && (
        <div className="mt-8 rounded-2xl bg-lagoon-100 p-5">
          <p className="text-sm font-bold text-lagoon-800">Courier tracking</p>
          <ul className="mt-2 space-y-1">
            {order.tracking.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {t.number && <span className="font-display text-xl font-extrabold">{t.number}</span>}
                {t.url && (
                  <a href={t.url} target="_blank" rel="noreferrer" className="font-bold text-ribbon-700 underline underline-offset-4 hover:text-ribbon">
                    Follow your parcel
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 rounded-[2rem] border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_var(--color-ink)]">
        <ul className="space-y-3">
          {order.items.map((it, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ background: it.tint ?? "#F4E9D8" }}>
                {it.thumbnail && <Image src={ownPhoto(it.thumbnail)} alt="" width={48} height={48} className="size-10 object-contain" />}
              </span>
              <span className="flex-1 text-sm font-semibold">
                {it.title} <span className="text-ink-3">× {it.quantity}</span>
              </span>
              <span className="text-sm font-bold">{formatPrice(it.unit_price * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2 border-t-2 border-dashed border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-2">Subtotal</dt>
            <dd className="font-bold">{formatPrice(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">{order.delivery ?? "Delivery"}</dt>
            <dd className="font-bold">{order.shipping_total ? formatPrice(order.shipping_total) : "Free"}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t-2 border-ink pt-4">
          <span className="font-display text-lg font-bold">Total</span>
          <span className="font-display text-3xl font-extrabold">{formatPrice(order.total)}</span>
        </div>
        <p className="mt-3 text-sm text-ink-2">
          {order.paid ? "Paid." : "Payment due on delivery."}
          {order.city ? ` Delivering to ${order.city}.` : ""}
        </p>
      </div>

      <p className="mt-6 text-sm text-ink-2">
        Something not right?{" "}
        <Link href="/help#contact" className="font-bold underline underline-offset-4 hover:text-ribbon">
          Contact the shop
        </Link>
        .
      </p>
    </motion.section>
  );
}
