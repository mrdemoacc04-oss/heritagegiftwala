import "server-only";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Emails the shop owner when an order arrives (optional: needs RESEND_API_KEY and ORDER_ALERT_EMAIL).
 * Failures are logged and swallowed. A broken mail service must never lose an order.
 */
export async function alertNewOrder(o: { number: number; name: string; city: string; total: number; items: { title: string; quantity: number }[] }) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_ALERT_EMAIL;
  if (!key || !to) return;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const lines = o.items.map((i) => `<li>${esc(i.title)} × ${i.quantity}</li>`).join("");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "Heritage Gift Wala <onboarding@resend.dev>",
        to: [to],
        subject: `New order #${o.number}: ₹${o.total.toLocaleString("en-IN")}`,
        html: `<p>New order <b>#${o.number}</b> from ${esc(o.name)}, ${esc(o.city)}.</p><ul>${lines}</ul><p>Total: ₹${o.total.toLocaleString("en-IN")} (cash on delivery)</p><p><a href="${esc(site)}/admin/orders">Open the control panel</a></p>`,
      }),
    });
    if (!res.ok) console.error("[notify] mail service replied", res.status);
  } catch (e) {
    console.error("[notify] could not send", e instanceof Error ? e.message : e);
  }
}
