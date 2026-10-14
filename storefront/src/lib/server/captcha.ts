import "server-only";

/**
 * Optional bot check on the order form, using Cloudflare Turnstile (free, no puzzles for most people).
 * Switched on by setting TURNSTILE_SECRET_KEY (here) and NEXT_PUBLIC_TURNSTILE_SITE_KEY (the page).
 * Left unset, nothing changes. If Cloudflare itself can't be reached the order is let through, because a
 * third party's outage shouldn't stop customers buying; a visitor with no or a wrong answer is always refused.
 */
export const captchaEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

export async function captchaOk(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip && ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.status >= 500) return true; // Cloudflare itself is down
    if (!res.ok) return false;
    return (await res.json()).success === true;
  } catch (e) {
    console.error("[captcha] could not reach the verification service", e instanceof Error ? e.message : e);
    return true;
  }
}
