"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./forms";
import { ImageUpload } from "./ImageUpload";
import { Card, Field, Switch, inputClass } from "./ui";
import { PopupCard } from "@/components/promo/PopupCard";
import type { FormState } from "@/app/(admin)/admin/_actions/auth";

export type PopupValues = {
  enabled: boolean; label: string; title: string; text: string; button_text: string; button_url: string; image: string; tint: string;
  delay: number; reshow_days: number; ends_on: string;
};

const TINTS = ["#FFD6DE", "#FFE9B8", "#FFF0A8", "#D3F3EA", "#D6EEFF", "#E6DEFF", "#FFE3CC", "#F4E9D8"];

export function PopupForm({ action, initial }: { action: (state: FormState, formData: FormData) => Promise<FormState>; initial: PopupValues }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [label, setLabel] = useState(initial.label);
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const [buttonText, setButtonText] = useState(initial.button_text);
  const [buttonUrl, setButtonUrl] = useState(initial.button_url);
  const [image, setImage] = useState(initial.image);
  const [tint, setTint] = useState(initial.tint);

  return (
    <ActionForm action={action} className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        <Card>
          <Switch
            name="enabled"
            checked={enabled}
            onChange={setEnabled}
            label={enabled ? "The popup is ON" : "The popup is OFF"}
            hint="On: visitors see it a few seconds after they arrive. Off: nobody sees it. Your words below stay saved either way."
          />
        </Card>

        <Card title="What it says">
          <div className="grid gap-4">
            <Field label="Small sticker (optional)" hint="A short tag above the heading, e.g. DIWALI SALE or 20% OFF.">
              <input name="label" maxLength={30} value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Heading" hint="The big words. Required to switch the popup on.">
              <input name="title" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diwali sale is on!" className={inputClass} />
            </Field>
            <Field label="A line or two (optional)">
              <textarea name="text" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Flat 20% off on hampers till Sunday. Message us to order." className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button label (optional)">
                <input name="button_text" maxLength={30} value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Shop the sale" className={inputClass} />
              </Field>
              <Field label="Where the button goes">
                <input name="button_url" maxLength={300} value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="/shop" className={inputClass} />
              </Field>
            </div>
            <div className="-mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-600">
              Quick choices:
              {[
                ["Chat on WhatsApp", "whatsapp"],
                ["All gifts", "/shop"],
                ["Gift hampers", "/collections/gift-hampers"],
              ].map(([name, url]) => (
                <button key={url} type="button" onClick={() => setButtonUrl(url)} className="rounded-full border border-stone-300 bg-white px-2.5 py-1 font-semibold text-stone-800 hover:bg-stone-100">
                  {name}
                </button>
              ))}
              <span className="basis-full text-stone-500">Type <b>whatsapp</b> to open a chat with the shop, a page on the shop like <b>/shop</b>, or a full address starting with <b>https://</b>.</span>
            </div>
          </div>
        </Card>

        <Card title="Picture and colour">
          <div className="grid gap-5 sm:grid-cols-2">
            <ImageUpload name="image" label="Picture (optional)" hint="A wide photo or banner shows across the top." value={image} onChange={setImage} />
            <Field label="Background colour">
              <div className="flex items-center gap-2">
                <input type="color" name="tint" value={tint} onChange={(e) => setTint(e.target.value)} className="h-9 w-14 cursor-pointer rounded border border-stone-300 bg-white p-0.5" aria-label="Background colour" />
                <div className="flex flex-wrap gap-1">
                  {TINTS.map((t) => (
                    <button type="button" key={t} onClick={() => setTint(t)} style={{ background: t }} className="size-6 rounded-full border border-stone-300" aria-label={`Use ${t}`} />
                  ))}
                </div>
              </div>
            </Field>
          </div>
        </Card>

        <Card title="When it shows">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Wait (seconds)" hint="Time on the page before it appears.">
              <input name="delay" type="number" inputMode="numeric" min={0} max={60} step={1} defaultValue={initial.delay} required className={inputClass} />
            </Field>
            <Field label="Stay away (days)" hint="After someone closes it. Saving the popup again shows it to everyone once more.">
              <input name="reshow_days" type="number" inputMode="numeric" min={1} max={30} step={1} defaultValue={initial.reshow_days} required className={inputClass} />
            </Field>
            <Field label="Stops after (optional)" hint="Its last day. It switches itself off after that.">
              <input name="ends_on" type="date" defaultValue={initial.ends_on} className={inputClass} />
            </Field>
          </div>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-stone-300 bg-stone-100/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
          <SubmitButton>Save popup</SubmitButton>
        </div>
      </div>

      <div>
        <div className="sticky top-4">
          <p className="mb-2 text-sm font-semibold text-stone-800">How it will look</p>
          <div className={enabled ? "" : "opacity-50"}>
            <PopupCard popup={{ label, title, text, buttonText, buttonUrl, image, tint }} preview />
          </div>
          {!enabled && <p className="mt-2 text-xs text-stone-500">This is a preview. The popup is switched off, so visitors don&apos;t see it yet.</p>}
        </div>
      </div>
    </ActionForm>
  );
}
