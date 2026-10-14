import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdmin } from "@/lib/server/admin-auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Heritage Gift Wala</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Shop control panel</h1>
      <p className="mt-2 text-sm text-stone-600">Sign in to manage products, prices, stock and orders.</p>
      <LoginForm />
    </main>
  );
}
