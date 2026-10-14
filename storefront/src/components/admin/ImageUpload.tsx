"use client";

import { useRef, useState } from "react";
import { buttonClass } from "./ui";

const MAX_SIDE = 1600;
const MAX_BYTES = 3.5 * 1024 * 1024;

/** Shrinks a big phone photo in the browser before sending it, so uploads are quick and stay under the size limit. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const keepAlpha = file.type === "image/png" || file.type === "image/webp";
  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, keepAlpha ? "image/png" : "image/jpeg", 0.86));
    if (blob && blob.size <= MAX_BYTES) return blob;
    scale *= 0.75;
  }
  throw new Error("That photo is too large even after shrinking. Try a smaller one.");
}

export function ImageUpload({ name, label, hint, value, onChange }: { name: string; label: string; hint?: string; value: string; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Please choose a PNG, JPEG or WebP photo.");
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", await shrink(file), file.name);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "The upload didn't work. Please try again.");
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload didn't work. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-stone-800">{label}</p>
      <div className="flex flex-col items-start gap-2">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-stone-50 text-xs text-stone-400">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="size-full object-contain" referrerPolicy="no-referrer" /> : "No photo"}
        </div>
        <div className="space-y-1.5">
          <input type="hidden" name={name} value={value} />
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id={`file-${name}`} onChange={(e) => pick(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <label htmlFor={`file-${name}`} className={`${buttonClass("secondary", "sm")} cursor-pointer`}>{busy ? "Uploading…" : value ? "Replace photo" : "Upload photo"}</label>
            {value && !busy && <button type="button" onClick={() => onChange("")} className={buttonClass("ghost", "sm")}>Remove</button>}
          </div>
          {hint && <p className="text-xs text-stone-500">{hint}</p>}
          {error && <p className="text-xs font-medium text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
