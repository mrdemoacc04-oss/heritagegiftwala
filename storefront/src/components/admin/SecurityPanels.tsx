"use client";

import { useActionState, useState, useTransition } from "react";
import { ActionForm, ConfirmButton, SubmitButton } from "./forms";
import { Card, Field, buttonClass, inputClass } from "./ui";
import {
  beginTotpAction,
  changePasswordAction,
  confirmTotpAction,
  disableTotpAction,
  regenerateRecoveryAction,
  signOutEverywhereAction,
  type TotpState,
} from "@/app/(admin)/admin/_actions/auth";

export function ChangePassword({ forced }: { forced: boolean }) {
  return (
    <Card title={forced ? "Choose your own password to continue" : "Change password"} className={forced ? "ring-2 ring-amber-500" : ""}>
      {forced && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">You signed in with a temporary password. Choose a new one that only you know before using the panel.</p>}
      <ActionForm action={changePasswordAction} resetOnSuccess className="max-w-xl space-y-4">
        <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" maxLength={200} className={inputClass} /></Field>
        <Field label="New password" hint="At least 12 characters, not the shop's name, and not found in known data breaches. A few random words is a good password."><input name="next" type="password" required autoComplete="new-password" minLength={12} maxLength={128} className={inputClass} /></Field>
        <Field label="New password again"><input name="confirm" type="password" required autoComplete="new-password" minLength={12} maxLength={128} className={inputClass} /></Field>
        <SubmitButton>Change password</SubmitButton>
      </ActionForm>
    </Card>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-bold text-amber-900">Save these recovery codes now. They are shown only once.</p>
      <p className="mt-1 text-sm text-amber-900">Each works one time if you lose your phone. Keep them somewhere safe, away from your computer&apos;s password manager notes if possible.</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <button type="button" className={`${buttonClass("secondary", "sm")} mt-3`} onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>Copy codes</button>
    </div>
  );
}

export function TwoStep({ enabled, required, codesLeft }: { enabled: boolean; required: boolean; codesLeft: number }) {
  const [setup, setSetup] = useState<TotpState>({});
  const [starting, start] = useTransition();
  const [confirmed, confirm] = useActionState(confirmTotpAction, {} as TotpState);
  const [fresh, regenerate] = useActionState(regenerateRecoveryAction, {} as TotpState);

  if (confirmed.codes) {
    return (
      <Card title="Two-step sign-in is on">
        <RecoveryCodes codes={confirmed.codes} />
        <p className="mt-3 text-sm text-stone-600">From now on, signing in asks for the code in your app after your password.</p>
        <a href="/admin" className={`${buttonClass("primary")} mt-4`}>Continue to the panel</a>
      </Card>
    );
  }

  if (enabled) {
    return (
      <Card title="Two-step sign-in is on">
        <p className="text-sm text-stone-700">Signing in needs your password and a code from your authenticator app. You have <b>{codesLeft}</b> unused recovery code{codesLeft === 1 ? "" : "s"}.</p>
        {fresh.codes && <div className="mt-4"><RecoveryCodes codes={fresh.codes} /></div>}
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <form action={regenerate} className="space-y-3">
            <p className="text-sm font-semibold">Get new recovery codes</p>
            <input name="password" type="password" required placeholder="Your password" autoComplete="current-password" maxLength={200} className={inputClass} aria-label="Your password" />
            <input name="code" required placeholder="Code from your app (or a recovery code)" maxLength={40} autoComplete="off" className={inputClass} aria-label="Code" />
            <SubmitButton kind="secondary" size="sm">Make new codes</SubmitButton>
            {fresh.error && <p className="text-sm font-medium text-red-700">{fresh.error}</p>}
          </form>
          <ActionForm action={disableTotpAction} className="space-y-3">
            <p className="text-sm font-semibold">Turn off two-step sign-in</p>
            <input name="password" type="password" required placeholder="Your password" autoComplete="current-password" maxLength={200} className={inputClass} aria-label="Your password" />
            <input name="code" required placeholder="Code from your app (or a recovery code)" maxLength={40} autoComplete="off" className={inputClass} aria-label="Code" />
            <ConfirmButton message={required ? "This shop requires two-step sign-in. If you turn it off you'll be asked to set it up again at your next sign-in. Continue?" : "Turn off two-step sign-in? Your account will be protected by the password alone."}>Turn off</ConfirmButton>
          </ActionForm>
        </div>
      </Card>
    );
  }

  return (
    <Card title={required ? "Set up two-step sign-in to continue" : "Turn on two-step sign-in"} className={required ? "ring-2 ring-amber-500" : ""}>
      <p className="text-sm text-stone-700">
        {required ? "This shop requires it. " : "Strongly recommended. "}
        With two-step sign-in, a stolen or guessed password is not enough to get in: you also need a 6-digit code from an app on your phone (Google Authenticator, Microsoft Authenticator, Authy or 1Password).
      </p>
      {!setup.secret ? (
        <form
          className="mt-4 max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            start(async () => setSetup(await beginTotpAction(data)));
          }}
        >
          <Field label="Your password" hint="Asked again because this is a security change.">
            <input name="password" type="password" required autoComplete="current-password" maxLength={200} className={inputClass} />
          </Field>
          <button type="submit" disabled={starting} className={buttonClass("primary")}>{starting ? "Preparing…" : "Start set-up"}</button>
          {setup.error && <p className="text-sm font-medium text-red-700">{setup.error}</p>}
        </form>
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-[240px_1fr]">
          <div>
            {/* The QR image is generated on the server as plain SVG for this one visit. */}
            <div className="w-[220px] rounded-lg border border-stone-200 bg-white p-1" dangerouslySetInnerHTML={{ __html: setup.qr ?? "" }} />
            <p className="mt-2 text-xs text-stone-500">Can&apos;t scan? Type this key into your app:</p>
            <p className="font-mono text-sm tracking-wider break-all">{setup.secret}</p>
          </div>
          <form action={confirm} className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-700">
              <li>Open your authenticator app and add an account by scanning the code.</li>
              <li>Type the 6-digit code it shows below to finish.</li>
            </ol>
            <Field label="6-digit code"><input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className={`${inputClass} max-w-40 tracking-widest`} /></Field>
            <SubmitButton pending="Checking…">Turn on</SubmitButton>
            {confirmed.error && <p className="text-sm font-medium text-red-700">{confirmed.error}</p>}
          </form>
        </div>
      )}
    </Card>
  );
}

export function SignOutEverywhere() {
  return (
    <Card title="Sign out everywhere">
      <p className="mb-3 text-sm text-stone-600">Signs out every browser and device, including this one. Use it if you think someone else may have your session.</p>
      <form action={signOutEverywhereAction}><ConfirmButton message="Sign out on every device, including this one?" kind="secondary" size="md">Sign out everywhere</ConfirmButton></form>
    </Card>
  );
}
