"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { adminLogin, adminLogout, adminVerifySecondStep, changeAdminPassword, completePasswordReset, createPasswordReset, requireAdmin, signOutEverywhere } from "@/lib/server/admin-auth";
import { beginTotpSetup, confirmTotpSetup, disableTotp, regenerateRecovery } from "@/lib/server/admin-security";
import { passwordForm } from "@/lib/server/admin-schemas";

export type FormState = { error?: string; ok?: string };

const TROUBLE = "The shop couldn't reach its database just now. Please try again in a minute. If it keeps happening, the site's setup needs attention (see /api/health).";

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.string().max(254), password: z.string().max(200) }).safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  let result: Awaited<ReturnType<typeof adminLogin>>;
  try {
    result = await adminLogin(parsed.data.email, parsed.data.password);
  } catch (e) {
    unstable_rethrow(e);
    console.error("[login]", e instanceof Error ? e.message : e);
    return { error: TROUBLE };
  }
  if ("error" in result) return { error: result.error };
  redirect(result.next === "verify" ? "/admin/login/verify" : "/admin");
}

export async function verifyCodeAction(_: FormState, formData: FormData): Promise<FormState> {
  const code = z.string().max(40).safeParse(formData.get("code"));
  if (!code.success) return { error: "Enter the 6-digit code." };
  let result: Awaited<ReturnType<typeof adminVerifySecondStep>>;
  try {
    result = await adminVerifySecondStep(code.data);
  } catch (e) {
    unstable_rethrow(e);
    console.error("[verify]", e instanceof Error ? e.message : e);
    return { error: TROUBLE };
  }
  if ("error" in result) return { error: result.error };
  redirect("/admin");
}

export async function logoutAction() {
  await adminLogout();
  redirect("/admin/login");
}

export async function signOutEverywhereAction() {
  const admin = await requireAdmin({ during: ["password", "2fa"] });
  await signOutEverywhere(admin);
  redirect("/admin/login");
}

export async function changePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  // Allowed while a temporary password is still in use: it is the one thing that password may do.
  const admin = await requireAdmin({ during: ["password", "2fa"] });
  const p = passwordForm.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: "Please fill in all three boxes." };
  if (p.data.next !== p.data.confirm) return { error: "The new passwords don't match." };
  const problem = await changeAdminPassword(admin, p.data.current, p.data.next);
  if (problem) return { error: problem };
  revalidatePath("/admin", "layout");
  return { ok: "Password changed. Other devices have been signed out." };
}

// ── Forgotten password ──────────────────────────────────────────────────────

export async function forgotPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const email = z.string().max(254).safeParse(formData.get("email"));
  if (!email.success || !email.data.includes("@")) return { error: "Enter your email address." };
  // The answer is the same whoever asks. The real work happens after the reply is sent.
  after(() => createPasswordReset(email.data));
  return { ok: "If that email belongs to the shop owner, a reset link is on its way. It works once and expires in 30 minutes." };
}

export async function resetPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const token = z.string().max(100).safeParse(formData.get("token"));
  const next = z.string().max(200).safeParse(formData.get("next"));
  const confirm = z.string().max(200).safeParse(formData.get("confirm"));
  if (!token.success || !next.success || !confirm.success) return { error: "Please fill in both boxes." };
  if (next.data !== confirm.data) return { error: "The two passwords don't match." };
  let problem: string | null;
  try {
    problem = await completePasswordReset(token.data, next.data);
  } catch (e) {
    unstable_rethrow(e);
    console.error("[reset]", e instanceof Error ? e.message : e);
    return { error: TROUBLE };
  }
  if (problem) return { error: problem };
  redirect("/admin/login?reset=1");
}

// ── Two-step sign-in ────────────────────────────────────────────────────────

export type TotpState = FormState & { secret?: string; qr?: string; codes?: string[] };

export async function beginTotpAction(formData: FormData): Promise<TotpState> {
  // Not allowed during the temporary-password step: set the password first.
  const admin = await requireAdmin({ during: ["2fa"] });
  const password = z.string().max(200).safeParse(formData.get("password"));
  if (!password.success) return { error: "Enter your password." };
  const r = await beginTotpSetup(admin, password.data);
  return "error" in r ? { error: r.error } : { secret: r.secret, qr: r.qr };
}

export async function confirmTotpAction(_: TotpState, formData: FormData): Promise<TotpState> {
  const admin = await requireAdmin({ during: ["2fa"] });
  const code = z.string().max(20).safeParse(formData.get("code"));
  if (!code.success) return { error: "Enter the 6-digit code." };
  const r = await confirmTotpSetup(admin, code.data);
  if ("error" in r) return { error: r.error };
  revalidatePath("/admin", "layout");
  return { ok: "Two-step sign-in is on.", codes: r.codes };
}

export async function disableTotpAction(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const password = z.string().max(200).safeParse(formData.get("password"));
  const code = z.string().max(40).safeParse(formData.get("code"));
  if (!password.success || !code.success) return { error: "Enter your password and a code." };
  const problem = await disableTotp(admin, password.data, code.data);
  if (problem) return { error: problem };
  revalidatePath("/admin", "layout");
  return { ok: "Two-step sign-in is off." };
}

export async function regenerateRecoveryAction(_: TotpState, formData: FormData): Promise<TotpState> {
  const admin = await requireAdmin();
  const password = z.string().max(200).safeParse(formData.get("password"));
  const code = z.string().max(40).safeParse(formData.get("code"));
  if (!password.success || !code.success) return { error: "Enter your password and a code." };
  const r = await regenerateRecovery(admin, password.data, code.data);
  return "error" in r ? { error: r.error } : { ok: "New recovery codes. The old ones no longer work.", codes: r.codes };
}
