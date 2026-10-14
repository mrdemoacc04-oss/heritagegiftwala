import "server-only";
import { createHash } from "node:crypto";

/**
 * Has this password appeared in a known data breach? Uses the "Pwned Passwords" range API, which only ever
 * receives the first 5 characters of the password's SHA-1, never the password itself. If the service can't
 * be reached the check is skipped rather than blocking the owner.
 */
export async function breachCount(password: string): Promise<number> {
  const sha = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${sha.slice(0, 5)}`, {
      headers: { "Add-Padding": "true", "User-Agent": "heritagegiftwala-admin" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return 0;
    for (const line of (await res.text()).split("\n")) {
      const [suffix, count] = line.trim().split(":");
      if (suffix === sha.slice(5)) return Number(count) || 0;
    }
  } catch {
    // offline or slow: skip
  }
  return 0;
}
