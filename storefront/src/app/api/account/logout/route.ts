import { endCustomerSession } from "@/lib/server/customer-auth";
import { guard, json, sameOrigin, HttpError } from "@/lib/server/security";

export const POST = guard(async (req) => {
  if (!sameOrigin(req)) throw new HttpError(403, "That request wasn't allowed.");
  await endCustomerSession();
  return json({ ok: true });
});
