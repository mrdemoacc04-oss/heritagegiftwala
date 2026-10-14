import { ActionForm, ConfirmButton, SubmitButton } from "@/components/admin/forms";
import { Badge, Card, EmptyState, Field, PageTitle, buttonClass, inputClass, rupees, when } from "@/components/admin/ui";
import { sql } from "@/lib/server/db";
import { createCouponAction, deleteCouponAction, toggleCouponAction } from "../../_actions/shop";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Coupons" };

type C = { code: string; kind: "percent" | "fixed"; value: number; min_subtotal: number; max_uses: number | null; used: number; expires_at: string | null; active: boolean; expired: boolean };

export default async function CouponsPage() {
  await requireAdmin();
  const coupons = await sql<C>("select code, kind, value, min_subtotal, max_uses, used, expires_at, active, (expires_at is not null and expires_at < now()) as expired from shop.coupons order by created_at desc");
  return (
    <>
      <PageTitle title="Coupons" hint="Customers type a code at checkout. The discount is worked out on the items (before delivery)." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div>
          {coupons.length === 0 ? (
            <EmptyState>No coupons yet. Make the first one on the right.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
                  <tr><th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Gives</th><th className="px-4 py-2.5">Used</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5" /></tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {coupons.map((c) => {
                    const expired = c.expired;
                    const spent = c.max_uses !== null && c.used >= c.max_uses;
                    return (
                      <tr key={c.code}>
                        <td className="px-4 py-2.5 font-mono font-bold">{c.code}</td>
                        <td className="px-4 py-2.5">
                          {c.kind === "percent" ? `${c.value}% off` : `${rupees(c.value)} off`}
                          {c.min_subtotal > 0 && <span className="block text-xs text-stone-500">on {rupees(c.min_subtotal)}+</span>}
                          {c.expires_at && <span className="block text-xs text-stone-500">until {when(c.expires_at).split(",")[0]}</span>}
                        </td>
                        <td className="px-4 py-2.5">{c.used}{c.max_uses !== null ? ` of ${c.max_uses}` : ""}</td>
                        <td className="px-4 py-2.5">{!c.active ? <Badge>Paused</Badge> : expired ? <Badge tone="red">Expired</Badge> : spent ? <Badge tone="amber">Used up</Badge> : <Badge tone="green">Live</Badge>}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-2">
                            <form action={toggleCouponAction}><input type="hidden" name="code" value={c.code} /><button className={buttonClass("secondary", "sm")}>{c.active ? "Pause" : "Resume"}</button></form>
                            <form action={deleteCouponAction}><input type="hidden" name="code" value={c.code} /><ConfirmButton message={`Delete coupon ${c.code}?`}>Delete</ConfirmButton></form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Card title="New coupon">
          <ActionForm action={createCouponAction} resetOnSuccess className="space-y-3">
            <Field label="Code" hint="Letters and numbers, e.g. DIWALI10. Customers can type it in any case."><input name="code" required maxLength={24} className={`${inputClass} uppercase`} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select name="kind" className={inputClass} defaultValue="percent"><option value="percent">Percent off</option><option value="fixed">Rupees off</option></select>
              </Field>
              <Field label="Amount"><input name="value" type="number" inputMode="numeric" required min={1} max={1000000} className={inputClass} /></Field>
            </div>
            <Field label="Minimum items total (₹)" hint="0 means no minimum."><input name="min_subtotal" type="number" inputMode="numeric" min={0} defaultValue={0} className={inputClass} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Limit uses (optional)"><input name="max_uses" type="number" inputMode="numeric" min={1} placeholder="No limit" className={inputClass} /></Field>
              <Field label="Last day (optional)"><input name="expires_on" type="date" className={inputClass} /></Field>
            </div>
            <SubmitButton>Create coupon</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
