import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { buttonClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/server/admin-auth";
import { sql } from "@/lib/server/db";
import { logoutAction } from "../_actions/auth";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin({ during: ["password", "2fa"] });
  const [{ n }] = await sql<{ n: number }>("select count(*)::int as n from shop.orders where status = 'placed'");
  return (
    <div className="mx-auto grid min-h-dvh max-w-[1400px] gap-6 px-4 py-4 lg:grid-cols-[220px_1fr] lg:px-6">
      <aside className="lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:self-start">
        <div className="flex items-center justify-between gap-3 lg:block">
          <Link href="/admin" className="block text-lg font-bold tracking-tight">
            Gift Wala <span className="font-normal text-stone-500">control panel</span>
          </Link>
          <Link href="/" target="_blank" className="text-sm font-semibold text-stone-600 underline underline-offset-4 hover:text-stone-900 lg:mt-1 lg:inline-block">
            View shop ↗
          </Link>
        </div>
        <div className="mt-4">
          {admin.setupNeeded ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">Finish the set-up on this page to unlock the panel.</p> : <AdminNav newOrders={n} />}
        </div>
        <div className="mt-6 hidden border-t border-stone-300 pt-4 lg:block">
          <p className="truncate text-sm text-stone-600" title={admin.email}>
            {admin.email}
          </p>
          <form action={logoutAction} className="mt-2">
            <button className={buttonClass("secondary", "sm")}>Sign out</button>
          </form>
        </div>
      </aside>
      <main id="main" className="min-w-0 pb-16">
        {children}
        <form action={logoutAction} className="mt-10 lg:hidden">
          <button className={buttonClass("secondary", "sm")}>Sign out ({admin.email})</button>
        </form>
      </main>
    </div>
  );
}
