import "server-only";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** True when mail can go out. In local development it "goes" to the server log, so the reset flow can be tried without a mail account. */
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV !== "production";

/**
 * Sends an email through Resend. Never throws: a broken mail service must not break an order or a login.
 * Without a key (local development only) the message is printed to the server log instead, which is how
 * the password-reset link can be tried out on a laptop.
 */
export async function sendMail(msg: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.log(`[mail:dev] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "Heritage Gift Wala <onboarding@resend.dev>", to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("[mail] service replied", res.status);
    return res.ok;
  } catch (e) {
    console.error("[mail] could not send", e instanceof Error ? e.message : e);
    return false;
  }
}
