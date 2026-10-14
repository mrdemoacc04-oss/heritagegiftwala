import { getAdmin } from "@/lib/server/admin-auth";
import { allow, guard, json, sameOrigin, HttpError } from "@/lib/server/security";
import { saveImage, sniffImage } from "@/lib/server/storage";

const MAX_BYTES = 4 * 1024 * 1024;

/** Product photo upload. Admin-only; the file's real type is read from its bytes, never trusted from its name. */
export const POST = guard(async (req) => {
  if (!sameOrigin(req)) throw new HttpError(403, "That request wasn't allowed.");
  const admin = await getAdmin();
  if (!admin) throw new HttpError(401, "Please sign in again.");
  if (admin.setupNeeded) throw new HttpError(403, "Finish your security set-up first.");
  if (!(await allow(`upload:${admin.id}`, 60, 600))) throw new HttpError(429, "Too many uploads. Please wait a few minutes.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) throw new HttpError(413, "That photo is too large (4 MB at most).");

  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No photo was attached.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "That photo is too large (4 MB at most).");
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw new HttpError(415, "Please upload a PNG, JPEG or WebP photo.");
  return json({ url: await saveImage(bytes, kind) });
});
