import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/admin/AuthForms";
import { resetTokenValid } from "@/lib/server/admin-auth";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = await resetTokenValid(token);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Heritage Gift Wala</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Choose a new password</h1>
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <>
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">This link has expired or was already used.</p>
          <p className="mt-4 text-sm"><Link href="/admin/forgot" className="font-semibold underline underline-offset-4">Ask for a new link</Link></p>
        </>
      )}
    </main>
  );
}
