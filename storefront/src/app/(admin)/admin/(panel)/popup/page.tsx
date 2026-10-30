import { PageTitle } from "@/components/admin/ui";
import { PopupForm, type PopupValues } from "@/components/admin/PopupForm";
import { sql } from "@/lib/server/db";
import { savePopupAction } from "../../_actions/shop";
import { requireAdmin } from "@/lib/server/admin-auth";

export const metadata = { title: "Sale popup" };

export default async function PopupPage() {
  await requireAdmin();
  const [s] = await sql<{
    popup_enabled: boolean; popup_label: string; popup_title: string; popup_text: string; popup_button_text: string; popup_button_url: string;
    popup_image: string; popup_tint: string; popup_delay: number; popup_reshow_days: number; popup_ends_on: string | null;
  }>(
    `select popup_enabled, popup_label, popup_title, popup_text, popup_button_text, popup_button_url, popup_image, popup_tint, popup_delay, popup_reshow_days,
            to_char(popup_ends_on, 'YYYY-MM-DD') as popup_ends_on
       from shop.settings where id = 1`,
  );
  const initial: PopupValues = {
    enabled: s.popup_enabled,
    label: s.popup_label,
    title: s.popup_title,
    text: s.popup_text,
    button_text: s.popup_button_text,
    button_url: s.popup_button_url,
    image: s.popup_image,
    tint: s.popup_tint,
    delay: s.popup_delay,
    reshow_days: s.popup_reshow_days,
    ends_on: s.popup_ends_on ?? "",
  };
  return (
    <>
      <PageTitle
        title="Sale popup"
        hint="A box that pops up on the shop to announce a sale or an offer. Write it, check the preview, switch it on. Switch it off the day the sale ends (or give it a last day and it switches itself off)."
      />
      <PopupForm action={savePopupAction} initial={initial} />
    </>
  );
}
