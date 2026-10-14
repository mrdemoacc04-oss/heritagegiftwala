import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CodeForm } from "@/components/admin/AuthForms";
import { getAdmin } from "@/lib/server/admin-auth";

export const metadata: Metadata = { title: "Enter your code" };
export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  if (await getAdmin()) redirect("/admin");
  // No half-finished sign-in? Back to the start.
  const jar = await cookies();
  if (!jar.has(`${process.env.NODE_ENV === "production" ? "__Host-" : ""}hgw_admin_2fa`)) redirect("/admin/login");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <p className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Heritage Gift Wala</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Two-step sign-in</h1>
      <p className="mt-2 text-sm text-stone-600">Your password was right. One more step to prove it&apos;s you.</p>
      <CodeForm />
      <p className="mt-4 text-sm"><Link href="/admin/login" className="font-semibold underline underline-offset-4">Start again</Link></p>
    </main>
  );
}
