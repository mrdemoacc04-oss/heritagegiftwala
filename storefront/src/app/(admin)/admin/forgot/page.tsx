import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/admin/AuthForms";
import { mailConfigured } from "@/lib/server/mail";

export const metadata: Metadata = { title: "Forgot password" };
export const dynamic = "force-dynamic";

export default function ForgotPage() {
  const mail = mailConfigured();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Heritage Gift Wala</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Forgot your password?</h1>
      {mail ? (
        <>
          <p className="mt-2 text-sm text-stone-600">Enter the owner&apos;s email and we&apos;ll send a link to choose a new password.</p>
          <ForgotForm />
        </>
      ) : (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Password reset by email isn&apos;t switched on for this shop yet. Ask the person who set up the site to reset it with <code>npm run admin:create</code>.
        </p>
      )}
      <p className="mt-4 text-sm"><Link href="/admin/login" className="font-semibold underline underline-offset-4">Back to sign in</Link></p>
    </main>
  );
}
