import { ActionForm, SubmitButton } from "@/components/admin/forms";
import { Card, Field, PageTitle, inputClass } from "@/components/admin/ui";
import { sql } from "@/lib/server/db";
import { saveSettingsAction } from "../../_actions/shop";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Delivery" };

export default async function SettingsPage() {
  await requireAdmin();
  const [s] = await sql<{ shipping_flat: number; shipping_express: number; free_shipping_from: number }>("select shipping_flat, shipping_express, free_shipping_from from shop.settings where id = 1");
  return (
    <>
      <PageTitle title="Delivery charges" hint="What customers pay for delivery. Changes apply to the next order." />
      <Card className="max-w-xl">
        <ActionForm action={saveSettingsAction} className="space-y-4">
          <Field label="Standard delivery (₹)"><input name="shipping_flat" type="number" inputMode="numeric" min={0} max={100000} required defaultValue={s.shipping_flat} className={inputClass} /></Field>
          <Field label="Express delivery (₹)"><input name="shipping_express" type="number" inputMode="numeric" min={0} max={100000} required defaultValue={s.shipping_express} className={inputClass} /></Field>
          <Field label="Free standard delivery on orders from (₹)" hint="Enter 0 to switch free delivery off.">
            <input name="free_shipping_from" type="number" inputMode="numeric" min={0} max={1000000} required defaultValue={s.free_shipping_from} className={inputClass} />
          </Field>
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
