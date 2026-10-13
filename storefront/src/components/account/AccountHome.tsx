"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { CheckIcon, MapPinIcon, PackageIcon, PencilSimpleIcon, PlusIcon, SignOutIcon, SpinnerGapIcon, TrashIcon, UserIcon } from "@phosphor-icons/react";
import type { HttpTypes } from "@medusajs/types";
import { Panda } from "@/components/brand/Panda";
import { sdk } from "@/lib/medusa";
import { useAuth } from "@/lib/store/auth";
import { cx, formatPrice, ownPhoto } from "@/lib/format";

type Tab = "orders" | "details" | "addresses";
const TABS: { id: Tab; label: string; icon: typeof PackageIcon }[] = [
  { id: "orders", label: "Orders", icon: PackageIcon },
  { id: "details", label: "Details", icon: UserIcon },
  { id: "addresses", label: "Addresses", icon: MapPinIcon },
];

export function AccountHome() {
  const router = useRouter();
  const { customer, ready, init, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (ready && !customer) router.replace("/account/login");
  }, [ready, customer, router]);

  if (!customer) {
    return (
      <div className="grid place-items-center py-40">
        <SpinnerGapIcon size={32} weight="bold" className="animate-spin text-ink-3" aria-label="Loading your account" />
      </div>
    );
  }

  const name = customer.first_name || customer.email.split("@")[0];
  const since = customer.created_at ? new Date(customer.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : null;

  return (
    <div className="mx-auto max-w-[1000px] px-4 pt-6 pb-20 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-hand text-3xl text-ribbon">hello again</p>
          <h1 className="mt-1 text-[clamp(2.4rem,5.5vw,4rem)] leading-[0.95] font-extrabold">Hi, {name}!</h1>
          {since && <p className="mt-2 text-ink-2">With us since {since}</p>}
        </div>
        <button
          onClick={async () => {
            await logout();
            router.push("/");
          }}
          className="flex items-center gap-2 rounded-full border-2 border-ink px-5 py-2.5 font-bold transition hover:bg-ink hover:text-white"
        >
          <SignOutIcon size={18} weight="bold" /> Sign out
        </button>
      </div>

      <LayoutGroup id="account-tabs">
        <div role="tablist" aria-label="Your account" className="no-scrollbar mt-10 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="relative flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 font-bold transition-colors">
              {tab === t.id && <motion.span layoutId="account-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
              <span className={cx("relative flex items-center gap-2", tab === t.id ? "text-white" : "text-ink-2")}>
                <t.icon size={18} weight="bold" /> {t.label}
              </span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <div className="mt-8">
        {tab === "orders" && <Orders email={customer.email} />}
        {tab === "details" && <Details />}
        {tab === "addresses" && <Addresses />}
      </div>
    </div>
  );
}

/* ── Orders ─────────────────────────────────────────────────────────────── */

type StoreOrder = HttpTypes.StoreOrder;

const stageOf = (o: StoreOrder) => {
  if (o.status === "canceled") return { label: "Cancelled", tone: "bg-ribbon-100 text-ribbon-700" };
  switch (o.fulfillment_status) {
    case "delivered":
      return { label: "Delivered", tone: "bg-lagoon-100 text-lagoon-800" };
    case "shipped":
    case "partially_shipped":
      return { label: "On its way", tone: "bg-sun-100 text-[#8a6100]" };
    case "fulfilled":
    case "partially_fulfilled":
      return { label: "Packed", tone: "bg-sun-100 text-[#8a6100]" };
    default:
      return { label: "Placed", tone: "bg-white text-ink-2 border border-line" };
  }
};

function Orders({ email }: { email: string }) {
  const [orders, setOrders] = useState<StoreOrder[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    sdk?.store.order
      .list({ limit: 30, order: "-created_at", fields: "id,display_id,created_at,status,fulfillment_status,total,currency_code,*items" })
      .then((r) => live && setOrders(r.orders))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return <p className="rounded-2xl bg-ribbon-100 p-5 font-semibold text-ribbon-700">We couldn&apos;t load your orders. Please refresh and try again.</p>;
  if (!orders) return <div className="grid place-items-center py-20"><SpinnerGapIcon size={28} weight="bold" className="animate-spin text-ink-3" /></div>;

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center rounded-[2rem] bg-white py-16 text-center">
        <Panda className="w-28" />
        <h2 className="mt-5 text-2xl font-extrabold">No orders yet</h2>
        <p className="mt-1 max-w-sm text-ink-2">When you place an order while signed in, it shows up here with live tracking.</p>
        <Link href="/shop" className="mt-6 rounded-full bg-ink px-6 py-3 font-bold text-white hover:bg-ribbon">Start shopping</Link>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((o, i) => {
        const stage = stageOf(o);
        const items = (o.items ?? []).filter(Boolean);
        return (
          <motion.li key={o.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-[2rem] border-2 border-ink bg-paper p-5 shadow-[5px_5px_0_var(--color-ink)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-extrabold">Order #{o.display_id}</p>
                <p className="text-sm text-ink-2">{new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
              </div>
              <span className={cx("rounded-full px-4 py-1.5 text-sm font-bold", stage.tone)}>{stage.label}</span>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {items.map((it) => (
                <li key={it.id} className="relative grid size-16 place-items-center rounded-2xl bg-cream" title={`${it.product_title ?? it.title} × ${it.quantity}`}>
                  {it.thumbnail && <Image src={ownPhoto(it.thumbnail)} alt={it.product_title ?? it.title} width={56} height={56} className="size-12 object-contain" />}
                  {it.quantity > 1 && <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{it.quantity}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-line pt-4">
              <p>
                <span className="text-ink-2">Total </span>
                <span className="font-display text-xl font-extrabold">{formatPrice(Number(o.total))}</span>
              </p>
              <Link href={`/track?order=${o.display_id}&email=${encodeURIComponent(email)}`} className="rounded-full bg-sun px-5 py-2 font-bold shadow-[0_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none">
                Track order
              </Link>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* ── Details ────────────────────────────────────────────────────────────── */

function Details() {
  const { customer, setCustomer } = useAuth();
  const [first, setFirst] = useState(customer?.first_name ?? "");
  const [last, setLast] = useState(customer?.last_name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (!customer) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdk) return;
    setState("saving");
    try {
      await sdk.store.customer.update({ first_name: first.trim(), last_name: last.trim(), phone: phone.trim() || undefined });
      const { customer: fresh } = await sdk.store.customer.retrieve({ fields: "+addresses" });
      setCustomer(fresh);
      setState("saved");
      setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("error");
    }
  };

  return (
    <form onSubmit={save} className="max-w-xl rounded-[2rem] bg-white p-6 sm:p-8">
      <h2 className="text-2xl font-extrabold">Your details</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Input label="First name" value={first} onChange={setFirst} autoComplete="given-name" />
        <Input label="Last name" value={last} onChange={setLast} autoComplete="family-name" />
        <div className="sm:col-span-2">
          <Input label="Mobile number" value={phone} onChange={setPhone} type="tel" autoComplete="tel" />
        </div>
        <label className="block sm:col-span-2">
          <span className="text-sm font-bold">Email</span>
          <input value={customer.email} readOnly className="mt-1.5 w-full rounded-2xl border-2 border-ink/10 bg-cream px-4 py-3 font-semibold text-ink-2" />
          <span className="mt-1 block text-xs text-ink-3">Your email is your sign-in, so it can&apos;t be changed here.</span>
        </label>
      </div>
      <div className="mt-6 flex items-center gap-4">
        <button disabled={state === "saving"} className={cx("flex h-12 items-center gap-2 rounded-full px-6 font-bold text-white transition disabled:opacity-60", state === "saved" ? "bg-lagoon-600" : "bg-ink hover:bg-ribbon")}>
          {state === "saving" ? <SpinnerGapIcon size={18} weight="bold" className="animate-spin" /> : state === "saved" ? <CheckIcon size={18} weight="bold" /> : null}
          {state === "saved" ? "Saved" : "Save changes"}
        </button>
        {state === "error" && <p className="text-sm font-semibold text-ribbon-700">Couldn&apos;t save. Please try again.</p>}
      </div>
    </form>
  );
}

/* ── Addresses ──────────────────────────────────────────────────────────── */

type Address = HttpTypes.StoreCustomerAddress;
type AddrForm = { first_name: string; last_name: string; phone: string; address_1: string; address_2: string; city: string; province: string; postal_code: string; is_default_shipping: boolean };
const blankAddr = (c?: { first_name?: string | null; last_name?: string | null; phone?: string | null }): AddrForm => ({
  first_name: c?.first_name ?? "",
  last_name: c?.last_name ?? "",
  phone: c?.phone ?? "",
  address_1: "",
  address_2: "",
  city: "",
  province: "Gujarat",
  postal_code: "",
  is_default_shipping: false,
});

function Addresses() {
  const { customer, refresh } = useAuth();
  const [editing, setEditing] = useState<{ id?: string; form: AddrForm } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const remove = useCallback(
    async (id: string) => {
      if (!sdk) return;
      await sdk.store.customer.deleteAddress(id);
      await refresh();
    },
    [refresh],
  );

  if (!customer) return null;
  const addresses = customer.addresses ?? [];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !sdk) return;
    const f = editing.form;
    if (!f.first_name.trim() || !f.address_1.trim() || !f.city.trim() || !/^\d{6}$/.test(f.postal_code)) {
      setError("Please add a name, street address, city and a 6-digit PIN code.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const body = { ...f, country_code: "in", address_2: f.address_2 || undefined, phone: f.phone || undefined };
      if (editing.id) await sdk.store.customer.updateAddress(editing.id, body);
      else await sdk.store.customer.createAddress(body);
      await refresh();
      setEditing(null);
    } catch {
      setError("We couldn't save that address. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const setField = (k: keyof AddrForm) => (v: string) => setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, [k]: v } } : cur));

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {addresses.map((a: Address) => (
            <motion.div key={a.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative rounded-[1.75rem] border-2 border-ink bg-paper p-5">
              {a.is_default_shipping && <span className="absolute -top-3 left-5 rounded-full bg-sun px-3 py-0.5 text-xs font-bold">Default</span>}
              <address className="not-italic leading-relaxed">
                <span className="font-bold">{[a.first_name, a.last_name].filter(Boolean).join(" ")}</span>
                <br />
                {a.address_1}
                {a.address_2 && <>, {a.address_2}</>}
                <br />
                {a.city}, {a.province} {a.postal_code}
                {a.phone && <><br />{a.phone}</>}
              </address>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() =>
                    setEditing({
                      id: a.id,
                      form: { first_name: a.first_name ?? "", last_name: a.last_name ?? "", phone: a.phone ?? "", address_1: a.address_1 ?? "", address_2: a.address_2 ?? "", city: a.city ?? "", province: a.province ?? "Gujarat", postal_code: a.postal_code ?? "", is_default_shipping: Boolean(a.is_default_shipping) },
                    })
                  }
                  className="flex items-center gap-1.5 rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold hover:bg-cream"
                >
                  <PencilSimpleIcon size={14} weight="bold" /> Edit
                </button>
                <button onClick={() => remove(a.id)} aria-label="Delete this address" className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-ribbon-100 hover:text-ribbon">
                  <TrashIcon size={17} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!editing && (
          <button onClick={() => setEditing({ form: { ...blankAddr(customer), is_default_shipping: addresses.length === 0 } })} className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[1.75rem] border-[3px] border-dashed border-ink/30 font-bold transition hover:border-ink hover:bg-sun">
            <PlusIcon size={26} weight="bold" /> Add an address
          </button>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <motion.form onSubmit={save} noValidate initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="mt-6 max-w-xl rounded-[2rem] bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-extrabold">{editing.id ? "Edit address" : "New address"}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input label="First name" value={editing.form.first_name} onChange={setField("first_name")} autoComplete="given-name" />
              <Input label="Last name" value={editing.form.last_name} onChange={setField("last_name")} autoComplete="family-name" />
              <div className="sm:col-span-2"><Input label="House, building, street" value={editing.form.address_1} onChange={setField("address_1")} autoComplete="address-line1" /></div>
              <div className="sm:col-span-2"><Input label="Area, landmark (optional)" value={editing.form.address_2} onChange={setField("address_2")} autoComplete="address-line2" /></div>
              <Input label="City" value={editing.form.city} onChange={setField("city")} autoComplete="address-level2" />
              <Input label="PIN code" value={editing.form.postal_code} onChange={setField("postal_code")} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
              <Input label="State" value={editing.form.province} onChange={setField("province")} autoComplete="address-level1" />
              <Input label="Phone (optional)" value={editing.form.phone} onChange={setField("phone")} type="tel" autoComplete="tel" />
              <label className="flex items-center gap-2.5 font-semibold sm:col-span-2">
                <input type="checkbox" checked={editing.form.is_default_shipping} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, is_default_shipping: e.target.checked } })} className="size-5 accent-[var(--color-ribbon)]" />
                Use as my default delivery address
              </label>
            </div>
            {error && <p className="mt-4 rounded-xl bg-ribbon-100 px-4 py-3 text-sm font-semibold text-ribbon-700">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button disabled={busy} className="flex h-12 items-center gap-2 rounded-full bg-ink px-6 font-bold text-white hover:bg-ribbon disabled:opacity-60">
                {busy && <SpinnerGapIcon size={18} weight="bold" className="animate-spin" />} Save address
              </button>
              <button type="button" onClick={() => { setEditing(null); setError(undefined); }} className="h-12 rounded-full border-2 border-ink px-6 font-bold hover:bg-cream">Cancel</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {!editing && addresses.length === 0 && <p className="mt-6 text-ink-2">No saved addresses yet. Add one and checkout will fill it in for you.</p>}
    </div>
  );
}

function Input({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 font-semibold outline-none transition focus:border-ink" />
    </label>
  );
}
