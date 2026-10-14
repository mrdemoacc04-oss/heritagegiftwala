"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminLogin, adminLogout, changeAdminPassword, requireAdmin } from "@/lib/server/admin-auth";
import { passwordForm } from "@/lib/server/admin-schemas";

export type FormState = { error?: string; ok?: string };

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.string().max(254), password: z.string().max(200) }).safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const result = await adminLogin(parsed.data.email, parsed.data.password);
  if ("error" in result) return { error: result.error };
  redirect("/admin");
}

export async function logoutAction() {
  await adminLogout();
  redirect("/admin/login");
}

export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const p = passwordForm.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: "Please fill in all three boxes." };
  if (p.data.next !== p.data.confirm) return { error: "The new passwords don't match." };
  const problem = await changeAdminPassword(admin, p.data.current, p.data.next);
  return problem ? { error: problem } : { ok: "Password changed. Other devices have been signed out." };
}
