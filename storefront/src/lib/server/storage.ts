import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** Only genuine PNG, JPEG and WebP files are accepted, judged by their bytes and not by the name or claimed type. */
export function sniffImage(b: Buffer): { ext: "png" | "jpg" | "webp"; type: string } | null {
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", type: "image/png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

const bucket = () => process.env.SUPABASE_STORAGE_BUCKET || "products";
const base = () => process.env.SUPABASE_URL?.replace(/\/+$/, "");

/** Where uploaded photos are served from, used to check that a saved image address is one of ours. */
export const publicImageBase = () => (base() ? `${base()}/storage/v1/object/public/${bucket()}` : null);

export function isOwnImage(url: string): boolean {
  if (url === "") return true;
  if (/^\/(products|uploads)\/[A-Za-z0-9._\-/]{1,200}$/.test(url) && !url.includes("..")) return true;
  const pub = publicImageBase();
  return Boolean(pub && url.startsWith(`${pub}/`) && /^[A-Za-z0-9._\-/:]+$/.test(url) && !url.includes(".."));
}

/** Stores an already-validated image and returns the address to save on the product. */
export async function saveImage(bytes: Buffer, img: { ext: string; type: string }): Promise<string> {
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${img.ext}`;
  const root = base();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (root && key) {
    const res = await fetch(`${root}/storage/v1/object/${bucket()}/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": img.type, "x-upsert": "false", "Cache-Control": "max-age=31536000" },
      body: new Uint8Array(bytes),
    });
    if (!res.ok) throw new Error(`Photo storage refused the upload (${res.status}).`);
    return `${root}/storage/v1/object/public/${bucket()}/${name}`;
  }

  if (process.env.NODE_ENV === "production") throw new Error("Photo storage is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).");
  // Local development only: keep uploads beside the site so everything works offline.
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), bytes);
  return `/uploads/${name}`;
}
