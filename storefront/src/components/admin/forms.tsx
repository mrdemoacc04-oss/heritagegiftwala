"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";
import type { FormState } from "@/app/(admin)/admin/_actions/auth";

const PendingContext = createContext(false);

export function SubmitButton({ children, pending = "Saving…", kind = "primary", size = "md" }: { children: React.ReactNode; pending?: string; kind?: "primary" | "secondary" | "danger"; size?: "md" | "sm" }) {
  const status = useFormStatus();
  const inFlight = useContext(PendingContext);
  const busy = status.pending || inFlight;
  return (
    <button type="submit" disabled={busy} className={buttonClass(kind, size)}>
      {busy ? pending : children}
    </button>
  );
}

/** A `<form>` wired to a server action, showing its error or success message underneath. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(action, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    // Submitted through onSubmit (not the form's `action` prop) because React empties a form after an action
    // finishes. That would throw away everything the owner typed whenever one field fails validation.
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
      className={className}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      <div aria-live="polite" className="mt-3 empty:hidden">
        {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{state.error}</p>}
        {state.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{state.ok}</p>}
      </div>
    </form>
  );
}

/** A button that asks "are you sure?" before submitting its form. */
export function ConfirmButton({ message, children, kind = "danger", size = "sm" }: { message: string; children: React.ReactNode; kind?: "primary" | "secondary" | "danger"; size?: "md" | "sm" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(kind, size)}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
