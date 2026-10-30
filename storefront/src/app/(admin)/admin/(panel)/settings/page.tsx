import { ActionForm, SubmitButton } from "@/components/admin/forms";
import { Card, Field, PageTitle, Switch, inputClass } from "@/components/admin/ui";
import { sql } from "@/lib/server/db";
import { saveSettingsAction, saveShowPricesAction } from "../../_actions/shop";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const [s] = await sql<{ shipping_flat: number; shipping_express: number; free_shipping_from: number; show_prices: boolean }>(
    "select shipping_flat, shipping_express, free_shipping_from, show_prices from shop.settings where id = 1",
  );
  return (
    <>
      <PageTitle title="Settings" hint="Prices on the shop, and delivery charges for the orders you take." />
      <div className="max-w-xl space-y-6">
        <Card title="Prices on the shop">
          <ActionForm action={saveShowPricesAction} className="space-y-4">
            <Switch
              name="show_prices"
              defaultChecked={s.show_prices}
              label="Show prices on the shop"
              hint="Turn this off to hide every price and MRP at once; customers then ask for the price on WhatsApp. Each product also has its own switch, on its page and in the Products list. A price shows only when both are on."
            />
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="Delivery charges">
          <p className="mb-4 text-sm text-stone-600">Used for the orders you take yourself (Orders → Take an order). Changes apply to the next order.</p>
          <ActionForm action={saveSettingsAction} className="space-y-4">
            <Field label="Standard delivery (₹)"><input name="shipping_flat" type="number" inputMode="numeric" min={0} max={100000} required defaultValue={s.shipping_flat} className={inputClass} /></Field>
            <Field label="Express delivery (₹)"><input name="shipping_express" type="number" inputMode="numeric" min={0} max={100000} required defaultValue={s.shipping_express} className={inputClass} /></Field>
            <Field label="Free standard delivery on orders from (₹)" hint="Enter 0 to switch free delivery off.">
              <input name="free_shipping_from" type="number" inputMode="numeric" min={0} max={1000000} required defaultValue={s.free_shipping_from} className={inputClass} />
            </Field>
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
