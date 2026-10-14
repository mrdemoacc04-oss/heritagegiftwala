"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./forms";
import { ImageUpload } from "./ImageUpload";
import { Card, Field, inputClass } from "./ui";
import type { FormState } from "@/app/(admin)/admin/_actions/auth";

export type ProductValues = {
  title: string; handle: string; subtitle: string; description: string; price: number; compare_at: number | null;
  categories: string[]; recipients: string[]; occasions: string[]; details: string[]; tint: string; badge: string; rank: number;
  is_new: boolean; status: "active" | "draft"; track_stock: boolean; stock: number; image: string; studio: string; shelf: string; image_fit: "contain" | "cover"; hidden: boolean;
};

const RECIPIENTS: [string, string][] = [["her", "For her"], ["him", "For him"], ["kids", "For kids"], ["parents", "For parents"], ["colleague", "For a colleague"], ["home", "For the home"]];
const OCCASIONS: [string, string][] = [["birthday", "Birthday"], ["anniversary", "Anniversary"], ["festive", "Festive"], ["housewarming", "Housewarming"], ["thank-you", "Thank you"], ["just-because", "Just because"]];
const TINTS = ["#FFD6DE", "#FFE0EC", "#D3F3EA", "#FFE3CC", "#E6DEFF", "#F4E9D8", "#D6EEFF", "#F7E4D4", "#FFE9B8", "#FFF0A8", "#E1E7F0", "#ECE7E2"];

export const blankProduct: ProductValues = {
  title: "", handle: "", subtitle: "", description: "", price: 0, compare_at: null, categories: [], recipients: [], occasions: [], details: [], tint: "#F4E9D8",
  badge: "", rank: 100, is_new: false, status: "active", track_stock: true, stock: 0, image: "", studio: "", shelf: "", image_fit: "cover", hidden: false,
};

const check = "size-4 accent-stone-900";

export function ProductForm({
  action,
  initial,
  categories,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: ProductValues;
  categories: { handle: string; title: string }[];
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initial.title);
  const [price, setPrice] = useState(String(initial.price));
  const [tint, setTint] = useState(initial.tint);
  const [fit, setFit] = useState(initial.image_fit);
  const [image, setImage] = useState(initial.image);
  const [studio, setStudio] = useState(initial.studio);
  const [shelf, setShelf] = useState(initial.shelf);
  const [track, setTrack] = useState(initial.track_stock);
  const service = initial.hidden;

  return (
    <ActionForm action={action} className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <Card title="The basics">
          <div className="grid gap-4">
            <Field label="Name"><input name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field>
            <Field label="One-line description (under the name)"><input name="subtitle" maxLength={160} defaultValue={initial.subtitle} placeholder="e.g. Insulated steel · bow straw topper" className={inputClass} /></Field>
            <Field label="Description"><textarea name="description" rows={5} maxLength={4000} defaultValue={initial.description} className={inputClass} /></Field>
            <Field label="Key points (one per line)" hint="Shown as a bullet list under “The details”.">
              <textarea name="details" rows={4} maxLength={2400} defaultValue={initial.details.join("\n")} className={inputClass} />
            </Field>
            <Field label="Web address" hint={service ? "This one is fixed. The site finds the gift-wrap service by it." : "Leave blank to make it from the name. Letters, numbers and dashes only. Changing it later breaks old links."}>
              <input name="handle" maxLength={80} defaultValue={initial.handle} readOnly={service} placeholder="made-from-the-name" className={`${inputClass} ${service ? "bg-stone-100" : ""}`} />
            </Field>
          </div>
        </Card>

        <Card title="Price and stock">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price (₹)"><input name="price" type="number" inputMode="numeric" required min={0} max={1000000} step={1} value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} /></Field>
            <Field label="Crossed-out “was” price (₹, optional)" hint="Shows a discount badge. Must be higher than the price."><input name="compare_at" type="number" inputMode="numeric" min={0} max={1000000} step={1} defaultValue={initial.compare_at ?? ""} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input type="checkbox" name="track_stock" checked={track} onChange={(e) => setTrack(e.target.checked)} className={check} />
              Count stock for this product (turn off for services or made-to-order items)
            </label>
            {track && (
              <Field label="In stock now"><input name="stock" type="number" inputMode="numeric" required min={0} max={100000} step={1} defaultValue={initial.stock} className={inputClass} /></Field>
            )}
            {!track && <input type="hidden" name="stock" value="0" />}
          </div>
        </Card>

        <Card title="Photos">
          <div className="grid gap-5 sm:grid-cols-3">
            <ImageUpload name="image" label="Main photo" hint="The one shown on the shop tile." value={image} onChange={setImage} />
            <ImageUpload name="studio" label="Second photo" hint="Optional gallery photo." value={studio} onChange={setStudio} />
            <ImageUpload name="shelf" label="Third photo" hint="Optional gallery photo." value={shelf} onChange={setShelf} />
          </div>
          <fieldset className="mt-5">
            <legend className="mb-1 text-sm font-semibold text-stone-800">How should the main photo sit on its tile?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200 p-3 has-[:checked]:border-stone-900">
                <input type="radio" name="image_fit" value="cover" checked={fit === "cover"} onChange={() => setFit("cover")} className="mt-1 accent-stone-900" />
                <span className="text-sm"><b>Fill the tile</b><br />For ordinary photos. They are cropped to fit.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200 p-3 has-[:checked]:border-stone-900">
                <input type="radio" name="image_fit" value="contain" checked={fit === "contain"} onChange={() => setFit("contain")} className="mt-1 accent-stone-900" />
                <span className="text-sm"><b>Cut-out on a coloured tile</b><br />For photos with no background (transparent PNG). Uses the tile colour.</span>
              </label>
            </div>
          </fieldset>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="How it will look">
          <div className="mx-auto w-full max-w-[220px]">
            <div className="relative aspect-square overflow-hidden rounded-2xl" style={{ background: tint }}>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className={`size-full ${fit === "cover" ? "object-cover" : "object-contain p-4"}`} referrerPolicy="no-referrer" />
              ) : (
                <span className="grid size-full place-items-center text-xs text-stone-500">Upload a main photo</span>
              )}
            </div>
            <p className="mt-2 truncate text-sm font-semibold">{title || "Product name"}</p>
            <p className="text-sm text-stone-600">₹{Number(price || 0).toLocaleString("en-IN")}</p>
          </div>
          <div className="mt-4">
            <Field label="Tile colour">
              <div className="flex items-center gap-2">
                <input type="color" name="tint" value={tint} onChange={(e) => setTint(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-stone-300 bg-white p-0.5" aria-label="Tile colour" />
                <div className="flex flex-wrap gap-1">
                  {TINTS.map((t) => (
                    <button type="button" key={t} onClick={() => setTint(t)} style={{ background: t }} className="size-6 rounded-full border border-stone-300" aria-label={`Use ${t}`} />
                  ))}
                </div>
              </div>
            </Field>
          </div>
        </Card>

        <Card title="Visibility">
          <div className="space-y-3">
            {service ? (
              <input type="hidden" name="status" value="active" />
            ) : (
              <Field label="Status">
                <select name="status" defaultValue={initial.status} className={inputClass}>
                  <option value="active">Live on the shop</option>
                  <option value="draft">Draft (hidden)</option>
                </select>
              </Field>
            )}
            <Field label="Sticker (optional)" hint="Short label on the tile, e.g. Bestseller."><input name="badge" maxLength={24} defaultValue={initial.badge} className={inputClass} /></Field>
            <Field label="Order on the shop" hint="Smaller numbers come first."><input name="rank" type="number" min={0} max={100000} defaultValue={initial.rank} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_new" defaultChecked={initial.is_new} className={check} /> Show a “New” mark</label>
          </div>
        </Card>

        {!service && (
          <>
            <Card title="Shelves">
              <div className="grid gap-2">
                {categories.map((c) => (
                  <label key={c.handle} className="flex items-center gap-2 text-sm"><input type="checkbox" name="categories" value={c.handle} defaultChecked={initial.categories.includes(c.handle)} className={check} /> {c.title}</label>
                ))}
              </div>
            </Card>
            <Card title="Gift finder">
              <p className="mb-2 text-sm font-semibold">Who is it for?</p>
              <div className="grid grid-cols-2 gap-2">
                {RECIPIENTS.map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 text-sm"><input type="checkbox" name="recipients" value={v} defaultChecked={initial.recipients.includes(v)} className={check} /> {l}</label>
                ))}
              </div>
              <p className="mt-4 mb-2 text-sm font-semibold">Good for…</p>
              <div className="grid grid-cols-2 gap-2">
                {OCCASIONS.map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 text-sm"><input type="checkbox" name="occasions" value={v} defaultChecked={initial.occasions.includes(v)} className={check} /> {l}</label>
                ))}
              </div>
            </Card>
          </>
        )}

      </div>
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-stone-300 bg-stone-100/95 px-4 py-3 backdrop-blur xl:col-span-2 lg:-mx-6 lg:px-6">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
