"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./forms";
import { Card, Field, buttonClass, inputClass, rupees } from "./ui";
import { createOrderAction } from "@/app/(admin)/admin/_actions/orders";

type P = { id: string; title: string; price: number; stock: number; track_stock: boolean };

export function NewOrderForm({ products }: { products: P[] }) {
  const [rows, setRows] = useState([{ key: 0, id: "", qty: 1 }]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const subtotal = rows.reduce((n, r) => n + (byId.get(r.id)?.price ?? 0) * r.qty, 0);

  return (
    <ActionForm action={createOrderAction} className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <Card title="Items">
          <div className="space-y-2">
            {rows.map((r, i) => {
              const p = byId.get(r.id);
              return (
                <div key={r.key} className="flex flex-wrap items-center gap-2">
                  <select
                    name="product_id"
                    value={r.id}
                    onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, id: e.target.value } : x)))}
                    className={`${inputClass} min-w-0 flex-1`}
                    aria-label={`Product ${i + 1}`}
                  >
                    <option value="">Choose a product…</option>
                    {products.map((o) => (
                      <option key={o.id} value={o.id} disabled={o.track_stock && o.stock === 0}>
                        {o.title} · {rupees(o.price)}{o.track_stock ? ` · ${o.stock === 0 ? "sold out" : `${o.stock} in stock`}` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={20}
                    value={r.qty}
                    onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, qty: Math.max(1, Math.min(20, Number(e.target.value) || 1)) } : x)))}
                    className={`${inputClass} w-20`}
                    aria-label="Quantity"
                  />
                  <span className="w-20 text-right text-sm font-semibold">{p ? rupees(p.price * r.qty) : ""}</span>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows(rows.filter((x) => x.key !== r.key))} className={buttonClass("ghost", "sm")} aria-label="Remove this line">✕</button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={() => setRows([...rows, { key: Math.max(...rows.map((r) => r.key)) + 1, id: "", qty: 1 }])} className={buttonClass("secondary", "sm")}>
              + Add another product
            </button>
            <span className="text-sm text-stone-600">Items: <b>{rupees(subtotal)}</b> (delivery and any coupon are added when you place it)</span>
          </div>
        </Card>

        <Card title="Customer">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input name="name" required maxLength={120} className={inputClass} /></Field>
            <Field label="Mobile number"><input name="phone" required inputMode="tel" maxLength={20} className={inputClass} /></Field>
            <Field label="Email" className="sm:col-span-2" hint="Needed for the customer to track the order. For a phone order with no email, use something like 91XXXXXXXXXX@orders.heritagegiftwala.in."><input name="email" type="email" required maxLength={254} className={inputClass} /></Field>
            <Field label="House, building, street" className="sm:col-span-2"><input name="address1" required maxLength={200} className={inputClass} /></Field>
            <Field label="Area, landmark (optional)" className="sm:col-span-2"><input name="address2" maxLength={200} className={inputClass} /></Field>
            <Field label="City"><input name="city" required maxLength={80} defaultValue="Patan" className={inputClass} /></Field>
            <Field label="PIN code"><input name="pincode" required inputMode="numeric" maxLength={6} defaultValue="384265" className={inputClass} /></Field>
            <Field label="State" className="sm:col-span-2"><input name="state" maxLength={80} defaultValue="Gujarat" className={inputClass} /></Field>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Delivery & payment">
          <div className="space-y-3">
            <Field label="Delivery">
              <select name="shipping" className={inputClass} defaultValue="standard">
                <option value="standard">Standard</option>
                <option value="express">Express</option>
              </select>
            </Field>
            <Field label="Coupon code (optional)"><input name="coupon" maxLength={24} className={`${inputClass} uppercase`} /></Field>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="paid" className="size-4 accent-stone-900" /> Already paid (cash taken in the shop)</label>
          </div>
        </Card>
        <SubmitButton pending="Placing…">Place order</SubmitButton>
      </div>
    </ActionForm>
  );
}
