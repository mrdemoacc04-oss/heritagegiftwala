import { ChangePassword, SignOutEverywhere, TwoStep } from "@/components/admin/SecurityPanels";
import { Card, PageTitle, when } from "@/components/admin/ui";
import { requireAdmin, twoFactorRequired } from "@/lib/server/admin-auth";
import { recentActivity, securityStatus } from "@/lib/server/admin-security";

export const metadata = { title: "My login" };

const LABELS: Record<string, string> = {
  sign_in: "Signed in",
  sign_out: "Signed out",
  sign_out_everywhere: "Signed out everywhere",
  sign_in_failed: "Wrong password",
  sign_in_throttled: "Too many attempts (blocked)",
  sign_in_blocked_not_allowed: "Sign-in refused (email not allowed)",
  sign_in_temp_password_expired: "Sign-in refused (temporary password expired)",
  code_throttled: "Too many wrong codes (blocked)",
  reset_requests_throttled: "Too many reset requests (blocked)",
  two_step_setup_refused: "Two-step set-up refused (wrong password)",
  password_ok_waiting_for_code: "Password accepted, waiting for code",
  code_failed: "Wrong two-step code",
  recovery_code_used: "Recovery code used",
  recovery_codes_regenerated: "New recovery codes made",
  password_changed: "Password changed",
  password_change_failed: "Password change refused (wrong current password)",
  password_reset_completed: "Password reset by email link",
  reset_requested: "Password reset link requested",
  reset_requested_not_allowed: "Reset requested for an email that isn't allowed",
  two_step_enabled: "Two-step sign-in turned on",
  two_step_disabled: "Two-step sign-in turned off",
  login_set_by_script: "Login created or reset by the site administrator",
};

function ActivityList({ rows, empty }: { rows: { event: string; detail?: string; created_at: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-stone-600">{empty}</p>;
  return (
    <ul className="divide-y divide-stone-100 text-sm">
      {rows.map((a, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2">
          <span>{LABELS[a.event] ?? a.event}{a.detail === "new device" ? " (new device)" : ""}</span>
          <span className="shrink-0 text-stone-500">{when(a.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AccountPage() {
  const admin = await requireAdmin({ during: ["password", "2fa"] });
  const [status, activity] = await Promise.all([securityStatus(admin), recentActivity(admin)]);
  const required = twoFactorRequired();
  return (
    <>
      <PageTitle title="My login" hint={`Signed in as ${admin.email}.`} />
      {admin.setupNeeded && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Almost there: {admin.setupNeeded === "password" ? "choose your own password" : "set up two-step sign-in"} to unlock the rest of the panel.
        </p>
      )}
      <div className="space-y-6">
        {admin.setupNeeded !== "2fa" && <ChangePassword forced={admin.setupNeeded === "password"} />}
        {admin.setupNeeded !== "password" && <TwoStep enabled={admin.totpEnabled} required={required} codesLeft={status?.codes_left ?? 0} />}
        {!admin.setupNeeded && <SignOutEverywhere />}
        <Card title="Changes to this login">
          <ActivityList rows={activity.changes} empty="No changes yet." />
        </Card>
        <Card title="Sign-ins">
          <ActivityList rows={activity.signIns} empty="Nothing yet." />
          <p className="mt-3 text-xs text-stone-500">If you see a sign-in you don&apos;t recognise, change your password and use “Sign out everywhere”.</p>
        </Card>
        <Card title="Blocked and failed attempts">
          <ActivityList rows={activity.attempts} empty="Nothing. Good." />
        </Card>
      </div>
    </>
  );
}
