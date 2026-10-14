import { customerLogin, startCustomerSession } from "@/lib/server/customer-auth";
import { guard, json, readJson, requirePost } from "@/lib/server/security";
import { loginInput } from "@/lib/server/schemas";

export const POST = guard(async (req) => {
  requirePost(req);
  const parsed = loginInput.safeParse(await readJson(req));
  if (!parsed.success) return json({ message: "That email and password don't match. Please try again." }, 401);
  const result = await customerLogin(req.headers, parsed.data.email, parsed.data.password);
  if ("error" in result) return json({ message: result.error }, result.error.startsWith("Too many") ? 429 : 401);
  await startCustomerSession(result.id);
  return json({ ok: true });
});
