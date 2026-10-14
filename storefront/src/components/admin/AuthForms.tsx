"use client";

import { useActionState, useState } from "react";
import { Field, inputClass } from "./ui";
import { SubmitButton } from "./forms";
import { forgotPasswordAction, resetPasswordAction, verifyCodeAction } from "@/app/(admin)/admin/_actions/auth";

const Message = ({ state }: { state: { error?: string; ok?: string } }) => (
  <div aria-live="polite" className="empty:hidden">
    {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{state.error}</p>}
    {state.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{state.ok}</p>}
  </div>
);

export function CodeForm() {
  const [state, run] = useActionState(verifyCodeAction, {});
  return (
    <form action={run} className="mt-8 space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <Field label="Code from your app" hint="The 6 digits shown in your authenticator app. Lost your phone? Use one of your recovery codes instead.">
        <input name="code" required autoFocus inputMode="text" autoComplete="one-time-code" maxLength={20} className={`${inputClass} tracking-widest`} />
      </Field>
      <SubmitButton pending="Checking…">Continue</SubmitButton>
      <Message state={state} />
    </form>
  );
}

export function ForgotForm() {
  const [state, run] = useActionState(forgotPasswordAction, {});
  const [email, setEmail] = useState("");
  return (
    <form action={run} className="mt-8 space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <Field label="Your email">
        <input name="email" type="email" required autoFocus autoComplete="username" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <SubmitButton pending="Sending…">Email me a reset link</SubmitButton>
      <Message state={state} />
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, run] = useActionState(resetPasswordAction, {});
  return (
    <form action={run} className="mt-8 space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" hint="At least 12 characters. A few random words is a good password.">
        <input name="next" type="password" required autoFocus autoComplete="new-password" minLength={12} maxLength={128} className={inputClass} />
      </Field>
      <Field label="New password again">
        <input name="confirm" type="password" required autoComplete="new-password" minLength={12} maxLength={128} className={inputClass} />
      </Field>
      <SubmitButton pending="Saving…">Set new password</SubmitButton>
      <Message state={state} />
    </form>
  );
}
