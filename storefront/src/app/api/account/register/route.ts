import { customerRegister, startCustomerSession } from "@/lib/server/customer-auth";
import { guard, json, readJson, requirePost } from "@/lib/server/security";
import { registerInput } from "@/lib/server/schemas";

export const POST = guard(async (req) => {
  requirePost(req);
  const parsed = registerInput.safeParse(await readJson(req));
  if (!parsed.success) return json({ message: "Please check your details and try again." }, 400);
  const result = await customerRegister(req.headers, parsed.data);
  if ("error" in result) return json({ message: result.error }, result.error.startsWith("Too many") ? 429 : 409);
  await startCustomerSession(result.id);
  return json({ ok: true }, 201);
});
