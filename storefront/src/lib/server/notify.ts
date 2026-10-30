import "server-only";
import { adminOrigin } from "./admin-host";
import { esc, sendMail } from "./mail";

/**
 * Emails the shop owner when an order arrives (optional: needs RESEND_API_KEY and ORDER_ALERT_EMAIL).
 * Failures are logged and swallowed. A broken mail service must never lose an order.
 */
export async function alertNewOrder(o: { number: number; name: string; city: string; total: number; items: { title: string; quantity: number }[] }) {
  const to = process.env.ORDER_ALERT_EMAIL;
  if (!to) return;
  const panel = adminOrigin();
  const lines = o.items.map((i) => `<li>${esc(i.title)} × ${i.quantity}</li>`).join("");
  await sendMail({
    to,
    subject: `New order #${o.number}: ₹${o.total.toLocaleString("en-IN")}`,
    html: `<p>New order <b>#${o.number}</b> from ${esc(o.name)}, ${esc(o.city)}.</p><ul>${lines}</ul><p>Total: ₹${o.total.toLocaleString("en-IN")} (cash on delivery)</p><p><a href="${esc(panel)}/admin/orders">Open the control panel</a></p>`,
    text: `New order #${o.number} from ${o.name}, ${o.city}. Total ₹${o.total.toLocaleString("en-IN")} (cash on delivery). ${panel}/admin/orders`,
  });
}
