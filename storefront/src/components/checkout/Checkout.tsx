"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeftIcon, CreditCardIcon, InfoIcon, LockSimpleIcon, MoneyIcon, SpinnerGapIcon, TruckIcon, LightningIcon, UserCircleIcon, MapPinIcon } from "@phosphor-icons/react";
import { Panda } from "@/components/brand/Panda";
import { cartSubtotal, useCart } from "@/lib/store/cart";
import { useAuth, type Customer } from "@/lib/store/auth";
import { medusaEnabled, sdk } from "@/lib/medusa";
import { cx, formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { paperById } from "@/lib/wrap";

const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

type Option = { id: string; label: string; detail: string; amount: number };
type Form = Record<"email" | "phone" | "name" | "address1" | "address2" | "city" | "state" | "pincode", string>;
const empty: Form = { email: "", phone: "", name: "", address1: "", address2: "", city: "", state: "Gujarat", pincode: "" };

const previewShipping = (subtotal: number): Option[] => [
  {
    id: "standard",
    label: "Standard delivery",
    detail: "3–6 working days",
    amount: site.freeShippingThreshold > 0 && subtotal >= site.freeShippingThreshold ? 0 : site.shippingFlat,
  },
  { id: "express", label: "Express delivery", detail: "1–3 working days", amount: site.expressShipping },
];
const previewPayments: Option[] = [
  { id: "online", label: "UPI, cards & netbanking", detail: "Pay securely online", amount: 0 },
  { id: "cod", label: "Cash on delivery", detail: "Pay when it arrives", amount: 0 },
];

/** Preview orders get a short local reference, since no backend assigns one. */
const previewOrderNo = () => `HGW-${Date.now().toString(36).slice(-6).toUpperCase()}`;

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Please enter a valid email";
  if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, "").slice(-10))) e.phone = "10-digit mobile number";
  if (!f.name.trim()) e.name = "Who should we deliver to?";
  if (!f.address1.trim()) e.address1 = "House, building and street";
  if (!f.city.trim()) e.city = "City";
  if (!/^\d{6}$/.test(f.pincode)) e.pincode = "6-digit PIN code";
  return e;
}

/** What a saved address (or the customer's own details) can fill in on the form. */
function fromAddress(a: NonNullable<Customer["addresses"]>[number]): Partial<Form> {
  return {
    name: [a.first_name, a.last_name].filter(Boolean).join(" "),
    address1: a.address_1 ?? "",
    address2: a.address_2 ?? "",
    city: a.city ?? "",
    state: STATES.find((s) => s.toLowerCase() === (a.province ?? "").toLowerCase()) ?? "Gujarat",
    pincode: a.postal_code ?? "",
    ...(a.phone ? { phone: a.phone } : {}),
  };
}

export function Checkout() {
  const lines = useCart((s) => s.lines);
  const cartId = useCart((s) => s.cartId);
  const clear = useCart((s) => s.clear);
  const router = useRouter();
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [shipping, setShipping] = useState<Option[]>([]);
  const [payments, setPayments] = useState<Option[]>(previewPayments);
  const [ship, setShip] = useState("standard");
  const [pay, setPay] = useState("online");
  const [placing, setPlacing] = useState(false);
  const [failure, setFailure] = useState<string>();
  const subtotal = cartSubtotal(lines);
  const customer = useAuth((s) => s.customer);
  const authReady = useAuth((s) => s.ready);
  const [prefilledFor, setPrefilledFor] = useState<string>();

  // A signed-in customer's details and default address fill the form once, without overwriting anything typed.
  if (customer && prefilledFor !== customer.id) {
    setPrefilledFor(customer.id);
    const addresses = customer.addresses ?? [];
    const home = addresses.find((a) => a.is_default_shipping) ?? addresses[0];
    setForm((f) => ({
      ...f,
      email: f.email || customer.email,
      phone: f.phone || customer.phone || "",
      name: f.name || [customer.first_name, customer.last_name].filter(Boolean).join(" "),
      ...(home && !f.address1 ? fromAddress(home) : {}),
    }));
  }

  // Live shipping options and payment providers come from Medusa once it is connected.
  useEffect(() => {
    if (!medusaEnabled || !sdk || !cartId) return;
    let live = true;
    (async () => {
      try {
        const { cart } = await sdk.store.cart.retrieve(cartId);
        const [{ shipping_options }, { payment_providers }] = await Promise.all([
          sdk.store.fulfillment.listCartOptions({ cart_id: cartId }),
          sdk.store.payment.listPaymentProviders({ region_id: cart.region_id! }),
        ]);
        if (!live) return;
        const s = shipping_options.map((o) => ({ id: o.id, label: o.name, detail: "", amount: Number(o.amount ?? 0) }));
        const p = payment_providers.map((pp) => ({
          id: pp.id,
          label: pp.id.includes("razorpay") ? "UPI, cards & netbanking" : pp.id === "pp_system_default" ? "Pay on delivery" : pp.id,
          detail: "",
          amount: 0,
        }));
        setShipping(s);
        setPayments(p);
        if (s[0]) setShip(s[0].id);
        if (p[0]) setPay(p[0].id);
      } catch {
        setFailure("We couldn't load delivery options. Please refresh the page.");
      }
    })();
    return () => {
      live = false;
    };
  }, [cartId]);

  const shippingOptions = medusaEnabled ? shipping : previewShipping(subtotal);
  const delivery = shippingOptions.find((o) => o.id === ship)?.amount ?? 0;
  const total = subtotal + delivery;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      document.querySelector<HTMLElement>(`[name="${Object.keys(found)[0]}"]`)?.focus();
      return;
    }
    setPlacing(true);
    setFailure(undefined);
    const summary = { lines, subtotal, delivery, total, name: form.name, city: form.city, email: form.email.trim() };

    try {
      let orderNo: string;
      if (medusaEnabled && sdk && cartId) {
        const [first, ...rest] = form.name.trim().split(/\s+/);
        const address = {
          first_name: first,
          last_name: rest.join(" "),
          address_1: form.address1,
          address_2: form.address2,
          city: form.city,
          province: form.state,
          postal_code: form.pincode,
          country_code: "in",
          phone: form.phone,
        };
        await sdk.store.cart.update(cartId, { email: form.email, shipping_address: address, billing_address: address });
        await sdk.store.cart.addShippingMethod(cartId, { option_id: ship });
        const { cart } = await sdk.store.cart.retrieve(cartId);
        await sdk.store.payment.initiatePaymentSession(cart, { provider_id: pay });
        const done = await sdk.store.cart.complete(cartId);
        if (done.type !== "order") throw new Error(done.error?.message ?? "Payment didn't go through.");
        orderNo = `#${done.order.display_id}`;
      } else {
        orderNo = previewOrderNo();
      }
      sessionStorage.setItem("hgw-last-order", JSON.stringify({ ...summary, orderNo, preview: !medusaEnabled }));
      clear();
      router.push("/order/confirmed");
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Something went wrong placing your order.");
      setPlacing(false);
    }
  };

  const wrapCount = useMemo(() => lines.filter((l) => l.handle === "gift-wrap").reduce((n, l) => n + l.quantity, 0), [lines]);

  if (!lines.length && !placing) {
    return (
      <div className="flex flex-col items-center px-4 py-24 text-center">
        <Panda className="w-36" />
        <h1 className="mt-6 text-4xl font-extrabold">Your bag is empty</h1>
        <p className="mt-2 text-ink-2">Fill it with something lovely first.</p>
        <Link href="/shop" className="mt-6 rounded-full bg-ink px-6 py-3 font-bold text-white hover:bg-ribbon">
          Go shopping
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={place} noValidate className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[1.25fr_1fr]">
      <div>
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-2 hover:text-ink">
          <ArrowLeftIcon size={14} weight="bold" /> Keep shopping
        </Link>
        <h1 className="mt-3 text-5xl font-extrabold">Checkout</h1>

        {!medusaEnabled && (
          <p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-sun-100 p-4 text-sm font-semibold">
            <InfoIcon size={20} weight="fill" className="mt-0.5 shrink-0 text-[#b07d00]" />
            Store preview: you can try the whole checkout, but orders placed here aren&apos;t sent to the shop yet.
          </p>
        )}

        {medusaEnabled && authReady && !customer && (
          <Link
            href="/account/login?next=/checkout"
            className="group mt-5 flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink/30 bg-white p-4 transition hover:border-ink"
          >
            <UserCircleIcon size={28} weight="duotone" className="shrink-0 text-lagoon-600" />
            <span className="flex-1 text-sm">
              <span className="block font-bold">Have an account? Sign in</span>
              <span className="text-ink-2">to fill in your details and keep track of this order. Or just carry on as a guest.</span>
            </span>
            <span className="font-bold underline underline-offset-4 group-hover:text-ribbon">Sign in</span>
          </Link>
        )}
        {customer && (
          <p className="mt-5 flex items-center gap-2.5 rounded-2xl bg-lagoon-100 p-4 text-sm font-semibold">
            <UserCircleIcon size={22} weight="fill" className="shrink-0 text-lagoon-800" />
            Signed in as {customer.email}. This order will appear in your account.
          </p>
        )}

        <Step n={1} title="Contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
            <Field label="Mobile number" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set("phone")} error={errors.phone} />
          </div>
        </Step>

        <Step n={2} title="Delivery address">
          {(customer?.addresses?.length ?? 0) > 0 && (
            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Your saved addresses">
              {customer!.addresses!.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, ...fromAddress(a) }))}
                  className="flex items-center gap-2 rounded-2xl border-2 border-ink/15 bg-white px-3.5 py-2 text-left text-sm transition hover:border-ink"
                >
                  <MapPinIcon size={18} weight="duotone" className="shrink-0 text-ribbon" />
                  <span>
                    <span className="block font-bold">{[a.first_name, a.last_name].filter(Boolean).join(" ") || "Saved address"}</span>
                    <span className="text-ink-2">{a.address_1}, {a.city}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} className="sm:col-span-2" />
            <Field label="House, building, street" name="address1" autoComplete="address-line1" value={form.address1} onChange={set("address1")} error={errors.address1} className="sm:col-span-2" />
            <Field label="Area, landmark (optional)" name="address2" autoComplete="address-line2" value={form.address2} onChange={set("address2")} className="sm:col-span-2" />
            <Field label="City" name="city" autoComplete="address-level2" value={form.city} onChange={set("city")} error={errors.city} />
            <Field label="PIN code" name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pincode} onChange={set("pincode")} error={errors.pincode} />
            <label className="sm:col-span-2">
              <span className="text-sm font-bold">State</span>
              <select name="state" value={form.state} onChange={set("state")} autoComplete="address-level1" className="mt-1.5 h-13 w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 font-semibold outline-none focus:border-ink">
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        </Step>

        <Step n={3} title="Delivery speed">
          <div className="grid gap-3 sm:grid-cols-2">
            {shippingOptions.map((o, i) => (
              <Radio key={o.id} name="ship" checked={ship === o.id} onChange={() => setShip(o.id)} icon={i ? LightningIcon : TruckIcon} label={o.label} detail={o.detail} right={o.amount ? formatPrice(o.amount) : "Free"} />
            ))}
            {medusaEnabled && !shippingOptions.length && <p className="text-sm text-ink-2">Loading delivery options…</p>}
          </div>
        </Step>

        <Step n={4} title="Payment">
          <div className="grid gap-3 sm:grid-cols-2">
            {payments.map((o) => (
              <Radio key={o.id} name="pay" checked={pay === o.id} onChange={() => setPay(o.id)} icon={o.id === "cod" || o.id === "pp_system_default" ? MoneyIcon : CreditCardIcon} label={o.label} detail={o.detail} />
            ))}
          </div>
        </Step>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[2rem] border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_var(--color-ink)]">
          <h2 className="text-2xl font-extrabold">Your order</h2>
          <ul className="mt-5 space-y-3">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                <span className="relative grid size-14 shrink-0 place-items-center rounded-xl" style={l.handle === "gift-wrap" && l.wrap ? paperById(l.wrap.paper).style : { background: l.tint }}>
                  {l.image && l.handle !== "gift-wrap" && <Image src={l.image} alt="" width={56} height={56} className="size-11 object-contain" />}
                  <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{l.quantity}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.title}</span>
                <span className="text-sm font-bold">{formatPrice(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-6 space-y-2 border-t-2 border-dashed border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-2">Subtotal</dt>
              <dd className="font-bold">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Delivery</dt>
              <dd className="font-bold">{delivery ? formatPrice(delivery) : "Free"}</dd>
            </div>
            {wrapCount > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-2">Gift wrapped</dt>
                <dd className="font-hand text-lg leading-none text-ribbon">{wrapCount} × with love</dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex items-baseline justify-between border-t-2 border-ink pt-4">
            <span className="font-display text-lg font-bold">Total</span>
            <motion.span key={total} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="font-display text-3xl font-extrabold">
              {formatPrice(total)}
            </motion.span>
          </div>
          {failure && <p className="mt-4 rounded-xl bg-ribbon-100 px-3 py-2 text-sm font-semibold text-ribbon-700">{failure}</p>}
          <button
            type="submit"
            disabled={placing || (medusaEnabled && !shippingOptions.length)}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ribbon text-lg font-bold text-white shadow-[0_6px_0_var(--color-ribbon-700)] transition hover:bg-ribbon-700 active:translate-y-1 active:shadow-none disabled:opacity-60"
          >
            {placing ? <SpinnerGapIcon size={20} weight="bold" className="animate-spin" /> : <LockSimpleIcon size={18} weight="bold" />}
            {placing ? "Placing your order…" : `Place order · ${formatPrice(total)}`}
          </button>
          <p className="mt-3 text-center text-xs text-ink-3">Fix rate pricing. What you see is what you pay.</p>
        </div>
      </aside>
    </form>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-3 text-2xl font-extrabold">
        <span className="grid size-9 place-items-center rounded-full bg-lagoon font-display text-lg">{n}</span>
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, error, className, ...props }: { label: string; error?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={className}>
      <span className="text-sm font-bold">{label}</span>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        className={cx(
          "mt-1.5 w-full rounded-2xl border-2 bg-white px-4 py-3 font-semibold outline-none transition focus:border-ink",
          error ? "border-ribbon" : "border-ink/15",
        )}
      />
      {error && <span className="mt-1 block text-sm font-semibold text-ribbon">{error}</span>}
    </label>
  );
}

function Radio({
  name,
  checked,
  onChange,
  icon: I,
  label,
  detail,
  right,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  icon: React.ComponentType<{ size?: number; weight?: "duotone" }>;
  label: string;
  detail?: string;
  right?: string;
}) {
  return (
    <label className={cx("flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white p-4 transition has-focus-visible:ring-4 has-focus-visible:ring-lagoon", checked ? "border-ink shadow-[3px_3px_0_var(--color-ink)]" : "border-ink/15 hover:border-ink/40")}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className={cx("grid size-5 shrink-0 place-items-center rounded-full border-2 border-ink", checked && "bg-ink")}>{checked && <span className="size-2 rounded-full bg-white" />}</span>
      <I size={24} weight="duotone" />
      <span className="flex-1">
        <span className="block font-bold">{label}</span>
        {detail && <span className="block text-sm text-ink-2">{detail}</span>}
      </span>
      {right && <span className="font-display font-extrabold">{right}</span>}
    </label>
  );
}
