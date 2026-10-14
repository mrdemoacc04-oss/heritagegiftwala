"use client";

import { useActionState, useState } from "react";
import { Field, inputClass } from "./ui";
import { SubmitButton } from "./forms";
import { loginAction } from "@/app/(admin)/admin/_actions/auth";

export function LoginForm() {
  const [state, run] = useActionState(loginAction, {});
  // React empties a form after it is submitted, so the email is kept here and survives a wrong password.
  const [email, setEmail] = useState("");
  return (
    <form action={run} className="mt-8 space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <Field label="Email">
        <input name="email" type="email" required autoComplete="username" autoFocus maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="current-password" maxLength={200} className={inputClass} />
      </Field>
      <SubmitButton pending="Signing in…">Sign in</SubmitButton>
      <div aria-live="polite" className="empty:hidden">
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{state.error}</p>}
      </div>
    </form>
  );
}
