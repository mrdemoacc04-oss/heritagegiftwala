"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { EyeIcon, EyeSlashIcon, GiftIcon, MapPinIcon, PackageIcon, SpinnerGapIcon, InfoIcon } from "@phosphor-icons/react";
import { Panda } from "@/components/brand/Panda";
import { useCatalog } from "@/components/providers/CatalogProvider";
import { useAuth } from "@/lib/store/auth";
import { cx } from "@/lib/format";
import { safeNext } from "@/lib/safe-next";

type Mode = "login" | "register";
type Fields = { firstName: string; lastName: string; email: string; phone: string; password: string };
const blank: Fields = { firstName: "", lastName: "", email: "", phone: "", password: "" };

function validate(mode: Mode, f: Fields) {
  const e: Partial<Record<keyof Fields, string>> = {};
  if (mode === "register") {
    if (!f.firstName.trim()) e.firstName = "Your first name";
    if (!f.lastName.trim()) e.lastName = "Your last name";
    if (f.phone.trim() && !/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, "").slice(-10))) e.phone = "10-digit mobile number";
    if (f.password.length < 8) e.password = "At least 8 characters";
  } else if (!f.password) e.password = "Enter your password";
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Please enter a valid email";
  return e;
}

export function AuthPage({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { customer, ready, login, register, init } = useAuth();
  const live = useCatalog().live;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [f, setF] = useState<Fields>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  useEffect(() => {
    void init();
  }, [init]);

  // Already signed in (or just signed in): carry on to where they were headed.
  useEffect(() => {
    if (ready && customer) router.replace(next);
  }, [ready, customer, next, router]);

  const switchTo = (m: Mode) => {
    setMode(m);
    setErrors({});
    setFailure(undefined);
    window.history.replaceState(null, "", `/account/${m === "login" ? "login" : "register"}${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`);
  };

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF((cur) => ({ ...cur, [k]: e.target.value }));
    if (errors[k]) setErrors((cur) => ({ ...cur, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(mode, f);
    setErrors(found);
    setFailure(undefined);
    if (Object.keys(found).length) {
      document.querySelector<HTMLElement>(`[name="${Object.keys(found)[0]}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(f.email, f.password);
      else await register({ firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone, password: f.password });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-[1100px] gap-8 px-4 pt-6 pb-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
      {/* a friendly side panel */}
      <aside className="relative hidden overflow-hidden rounded-[2.5rem] bg-lagoon p-10 lg:block">
        <div aria-hidden className="dots absolute inset-0 opacity-40 [--dot-gap:22px]" />
        <div className="relative">
          <Panda className="w-36" />
          <p className="mt-8 font-hand text-3xl text-ribbon-700">{mode === "login" ? "welcome back!" : "join the fun"}</p>
          <h2 className="mt-1 text-4xl leading-[0.98] font-extrabold">
            {mode === "login" ? "Your gifts, your orders, all in one place." : "Make gifting a little faster."}
          </h2>
          <ul className="mt-8 space-y-4 font-semibold">
            {[
              [PackageIcon, "See every order and follow it from shelf to doorstep"],
              [MapPinIcon, "Save addresses for the people you gift most"],
              [GiftIcon, "Skip the typing: checkout fills itself in"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof PackageIcon;
              return (
                <li key={i} className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white">
                    <I size={20} weight="duotone" />
                  </span>
                  <span className="pt-1.5">{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <div className="mx-auto w-full max-w-lg">
        <LayoutGroup id="auth-tabs">
          <div role="tablist" aria-label="Sign in or create an account" className="flex rounded-full border-2 border-ink bg-white p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchTo(m)}
                className="relative flex-1 rounded-full py-2.5 font-bold transition-colors"
              >
                {mode === m && <motion.span layoutId="auth-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                <span className={cx("relative", mode === m ? "text-white" : "text-ink-2")}>{m === "login" ? "Sign in" : "Create account"}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        <h1 className="mt-8 text-4xl font-extrabold">{mode === "login" ? "Sign in" : "Create your account"}</h1>
        <p className="mt-2 text-ink-2">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button type="button" onClick={() => switchTo(mode === "login" ? "register" : "login")} className="font-bold text-ribbon underline underline-offset-4">
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>

        {!live && (
          <p className="mt-5 flex items-start gap-2.5 rounded-2xl bg-sun-100 p-4 text-sm font-semibold">
            <InfoIcon size={20} weight="fill" className="mt-0.5 shrink-0 text-[#b07d00]" />
            Store preview: accounts switch on once the shop&apos;s backend is connected.
          </p>
        )}

        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <AnimatePresence initial={false}>
            {mode === "register" && (
              <motion.div key="names" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid gap-4 p-0.5 sm:grid-cols-2">
                  <Field label="First name" name="firstName" autoComplete="given-name" value={f.firstName} onChange={set("firstName")} error={errors.firstName} />
                  <Field label="Last name" name="lastName" autoComplete="family-name" value={f.lastName} onChange={set("lastName")} error={errors.lastName} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Field label="Email" name="email" type="email" autoComplete="email" value={f.email} onChange={set("email")} error={errors.email} />

          <AnimatePresence initial={false}>
            {mode === "register" && (
              <motion.div key="phone" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="p-0.5">
                  <Field label="Mobile number (optional)" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} error={errors.phone} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <label className="block">
            <span className="text-sm font-bold">Password</span>
            <span className="relative mt-1.5 block">
              <input
                name="password"
                type={show ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={f.password}
                onChange={set("password")}
                aria-invalid={Boolean(errors.password)}
                className={cx("w-full rounded-2xl border-2 bg-white py-3 pr-12 pl-4 font-semibold outline-none transition focus:border-ink", errors.password ? "border-ribbon" : "border-ink/15")}
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-2 hover:bg-cream">
                {show ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </span>
            {errors.password && <span className="mt-1 block text-sm font-semibold text-ribbon">{errors.password}</span>}
            {mode === "register" && !errors.password && <span className="mt-1 block text-xs text-ink-3">Use at least 8 characters.</span>}
          </label>

          <div aria-live="polite">{failure && <p className="rounded-xl bg-ribbon-100 px-4 py-3 text-sm font-semibold text-ribbon-700">{failure}</p>}</div>

          <button
            type="submit"
            disabled={busy || !live}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ribbon text-lg font-bold text-white shadow-[0_6px_0_var(--color-ribbon-700)] transition hover:bg-ribbon-700 active:translate-y-1 active:shadow-none disabled:opacity-60"
          >
            {busy && <SpinnerGapIcon size={20} weight="bold" className="animate-spin" />}
            {busy ? (mode === "login" ? "Signing you in…" : "Creating your account…") : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-2">
          Prefer not to sign up? <Link href="/shop" className="font-bold underline underline-offset-4">Keep shopping</Link>. You can still check out as a guest.
        </p>
      </div>
    </div>
  );
}

function Field({ label, error, ...props }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        className={cx("mt-1.5 w-full rounded-2xl border-2 bg-white px-4 py-3 font-semibold outline-none transition focus:border-ink", error ? "border-ribbon" : "border-ink/15")}
      />
      {error && <span className="mt-1 block text-sm font-semibold text-ribbon">{error}</span>}
    </label>
  );
}
