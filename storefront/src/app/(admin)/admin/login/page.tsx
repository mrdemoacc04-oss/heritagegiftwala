import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdmin } from "@/lib/server/admin-auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  if (await getAdmin()) redirect("/admin");
  const reset = (await searchParams).reset === "1";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Heritage Gift Wala</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Shop control panel</h1>
      <p className="mt-2 text-sm text-stone-600">Sign in to manage products, prices, stock and orders.</p>
      {reset && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">Password changed. Sign in with the new one.</p>}
      <LoginForm />
      <p className="mt-4 text-sm">
        <Link href="/admin/forgot" className="font-semibold text-stone-700 underline underline-offset-4 hover:text-stone-900">Forgot your password?</Link>
      </p>
    </main>
  );
}
