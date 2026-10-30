"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, InfoIcon, MapPinIcon, MinusIcon, PlusIcon, TrashIcon, UserCircleIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { Panda } from "@/components/brand/Panda";
import { cartSubtotal, useCart } from "@/lib/store/cart";
import { useAuth, type Address } from "@/lib/store/auth";
import { cx, formatPrice, hasPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { orderMessage, whatsappLink } from "@/lib/whatsapp";

const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

type Form = Record<"phone" | "name" | "address1" | "address2" | "city" | "state" | "pincode" | "note", string>;
const empty: Form = { phone: "", name: "", address1: "", address2: "", city: "Patan", state: "Gujarat", pincode: "", note: "" };

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.name.trim()) e.name = "Who is this order for?";
  if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, "").slice(-10))) e.phone = "10-digit mobile number";
  if (!f.address1.trim()) e.address1 = "House, building and street";
  if (!f.city.trim()) e.city = "City";
  if (!/^\d{6}$/.test(f.pincode.trim())) e.pincode = "6-digit PIN code";
  return e;
}

/** What a saved address (or the customer's own details) can fill in on the form. */
function fromAddress(a: Address): Partial<Form> {
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

/** The bag's details page. It ends on WhatsApp: the shop confirms the price, the delivery and the payment in the chat. */
export function Checkout() {
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const remove = useCart((s) => s.remove);
  const setQuantity = useCart((s) => s.setQuantity);
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  // The link that was opened, kept so it can be offered again if the browser blocked the new tab.
  const [sentLink, setSentLink] = useState<string>();
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
      phone: f.phone || customer.phone || "",
      name: f.name || [customer.first_name, customer.last_name].filter(Boolean).join(" "),
      ...(home && !f.address1 ? fromAddress(home) : {}),
    }));
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      document.querySelector<HTMLElement>(`[name="${Object.keys(found)[0]}"]`)?.focus();
      return;
    }
    const text = orderMessage(
      lines.map((l) => ({ handle: l.handle, title: l.title, quantity: l.quantity, price: l.price })),
      {
        name: form.name.trim(),
        phone: form.phone.replace(/\D/g, "").slice(-10),
        address1: form.address1.trim(),
        address2: form.address2.trim(),
        city: form.city.trim(),
        state: form.state,
        pincode: form.pincode.trim(),
        note: form.note.trim(),
      },
    );
    const link = whatsappLink(text);
    setSentLink(link);
    // Opened from the tap itself, so the browser lets it through; the link under the button is the fallback.
    window.open(link, "_blank", "noopener");
  };

  if (!lines.length) {
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
    <form onSubmit={send} noValidate className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-6 pb-24 sm:px-6 lg:grid-cols-[1.25fr_1fr]">
      <div>
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-2 hover:text-ink">
          <ArrowLeftIcon size={14} weight="bold" /> Keep shopping
        </Link>
        <h1 className="mt-3 text-5xl font-extrabold">Order on WhatsApp</h1>
        <p className="mt-3 flex items-start gap-2.5 rounded-2xl bg-lagoon-100 p-4 text-sm font-semibold">
          <InfoIcon size={20} weight="fill" className="mt-0.5 shrink-0 text-lagoon-800" />
          Tell us where to send it. When you press the green button, WhatsApp opens with your whole order already written. Just press Send, and we&apos;ll confirm the price, the delivery and how to pay in the chat.
        </p>

        {authReady && !customer && (
          <Link
            href="/account/login?next=/checkout"
            className="group mt-5 flex items-center gap-3 rounded-2xl border-2 border-dashed border-ink/30 bg-white p-4 transition hover:border-ink"
          >
            <UserCircleIcon size={28} weight="duotone" className="shrink-0 text-lagoon-600" />
            <span className="flex-1 text-sm">
              <span className="block font-bold">Have an account? Sign in</span>
              <span className="text-ink-2">to fill in your details from your saved address. Or just carry on as a guest.</span>
            </span>
            <span className="font-bold underline underline-offset-4 group-hover:text-ribbon">Sign in</span>
          </Link>
        )}
        {customer && (
          <p className="mt-5 flex items-center gap-2.5 rounded-2xl bg-lagoon-100 p-4 text-sm font-semibold">
            <UserCircleIcon size={22} weight="fill" className="shrink-0 text-lagoon-800" />
            Signed in as {customer.email}.
          </p>
        )}

        <Step n={1} title="About you">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" name="name" autoComplete="name" maxLength={120} value={form.name} onChange={set("name")} error={errors.name} />
            <Field label="Mobile number" name="phone" type="tel" maxLength={20} autoComplete="tel" inputMode="tel" value={form.phone} onChange={set("phone")} error={errors.phone} />
          </div>
        </Step>

        <Step n={2} title="Delivery address">
          {(customer?.addresses?.length ?? 0) > 0 && (
            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Your saved addresses">
              {customer!.addresses.map((a) => (
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
            <Field label="House, building, street" name="address1" autoComplete="address-line1" maxLength={200} value={form.address1} onChange={set("address1")} error={errors.address1} className="sm:col-span-2" />
            <Field label="Area, landmark (optional)" name="address2" autoComplete="address-line2" maxLength={200} value={form.address2} onChange={set("address2")} className="sm:col-span-2" />
            <Field label="City" name="city" autoComplete="address-level2" maxLength={80} value={form.city} onChange={set("city")} error={errors.city} />
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

        <Step n={3} title="Anything we should know?">
          <label>
            <span className="text-sm font-bold">Gift message, pick-up from the shop, a date you need it by… (optional)</span>
            <textarea
              name="note"
              value={form.note}
              onChange={set("note")}
              rows={3}
              maxLength={300}
              className="mt-1.5 w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 font-semibold outline-none transition focus:border-ink"
            />
          </label>
        </Step>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[2rem] border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_var(--color-ink)]">
          <h2 className="text-2xl font-extrabold">Your order</h2>
          <ul className="mt-5 space-y-3">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                <Link href={`/products/${l.handle}`} className="relative grid size-16 shrink-0 place-items-center rounded-xl" style={{ background: l.tint }} aria-label={l.title}>
                  {l.image && <Image src={l.image} alt="" width={64} height={64} className="size-12 object-contain" />}
                </Link>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{l.title}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="flex items-center rounded-full border-2 border-ink bg-white">
                      <button type="button" onClick={() => setQuantity(l.id, l.quantity - 1)} aria-label={`One less ${l.title}`} className="grid size-6 place-items-center rounded-full hover:bg-cream">
                        <MinusIcon size={11} weight="bold" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold" aria-live="polite">{l.quantity}</span>
                      <button type="button" onClick={() => setQuantity(l.id, l.quantity + 1)} aria-label={`One more ${l.title}`} className="grid size-6 place-items-center rounded-full hover:bg-cream">
                        <PlusIcon size={11} weight="bold" />
                      </button>
                    </span>
                    <button type="button" onClick={() => remove(l.id)} aria-label={`Remove ${l.title}`} className="rounded-full p-1.5 text-ink-3 hover:bg-ribbon-100 hover:text-ribbon">
                      <TrashIcon size={15} />
                    </button>
                  </span>
                </span>
                {hasPrice(l) && <span className="text-sm font-bold">{formatPrice(l.price * l.quantity)}</span>}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-baseline justify-between border-t-2 border-ink pt-4">
            <span className="font-display text-lg font-bold">{subtotal !== null ? "Items" : "Price"}</span>
            <span className={cx("font-display font-extrabold", subtotal !== null ? "text-3xl" : "text-lg")}>{subtotal !== null ? formatPrice(subtotal) : "Confirmed on WhatsApp"}</span>
          </div>
          <p className="mt-1 text-xs text-ink-3">Delivery is worked out in the chat.</p>

          <button
            type="submit"
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#25d366] text-lg font-bold text-ink shadow-[0_6px_0_#128c4a] transition hover:bg-[#2fe173] active:translate-y-1 active:shadow-[0_2px_0_#128c4a]"
          >
            <WhatsappLogoIcon size={24} weight="fill" /> Send order on WhatsApp
          </button>

          {sentLink && (
            <div role="status" className="mt-4 rounded-2xl bg-lagoon-100 p-4 text-sm">
              <p className="font-bold">WhatsApp should have opened with your order ready.</p>
              <p className="mt-1 text-ink-2">Press Send there and we&apos;ll reply as soon as we can. Nothing is ordered until you send it.</p>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-bold">
                <a href={sentLink} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ribbon">
                  It didn&apos;t open? Open WhatsApp
                </a>
                <button type="button" onClick={() => { clear(); setSentLink(undefined); }} className="underline underline-offset-4 hover:text-ribbon">
                  I&apos;ve sent it, empty my bag
                </button>
              </p>
            </div>
          )}
          <p className="mt-3 text-center text-xs text-ink-3">Chatting with {site.phone.display}. No payment is taken on this website.</p>
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
