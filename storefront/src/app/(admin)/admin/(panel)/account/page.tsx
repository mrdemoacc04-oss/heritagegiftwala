import { ActionForm, SubmitButton } from "@/components/admin/forms";
import { Card, Field, PageTitle, inputClass } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/server/admin-auth";
import { changePasswordAction } from "../../_actions/auth";

export const metadata = { title: "My login" };

export default async function AccountPage() {
  const admin = await requireAdmin();
  return (
    <>
      <PageTitle title="My login" hint={`Signed in as ${admin.email}.`} />
      <Card title="Change password" className="max-w-xl">
        <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-4">
          <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" maxLength={200} className={inputClass} /></Field>
          <Field label="New password" hint="At least 12 characters. A few random words is a good password."><input name="next" type="password" required autoComplete="new-password" minLength={12} maxLength={128} className={inputClass} /></Field>
          <Field label="New password again"><input name="confirm" type="password" required autoComplete="new-password" minLength={12} maxLength={128} className={inputClass} /></Field>
          <SubmitButton>Change password</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
