// Two-step sign-in codes (RFC 6238: the 6-digit codes authenticator apps show), built on Node's own crypto.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;

export function base32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text.replace(/=+$/, "").toUpperCase()) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("bad base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newSecret = () => base32(randomBytes(20));

export function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", fromBase32(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Checks a code against the current 30-second window and one either side (for clock drift).
 * Returns the matched step so the caller can refuse to accept the same code twice, or null.
 */
export function verifyCode(secret: string, code: string, lastUsedStep: number, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 1000 / STEP);
  let hit: number | null = null;
  for (const step of [current - 1, current, current + 1]) {
    // Always compare all three, so timing doesn't reveal which window matched.
    if (same(codeAt(secret, step), code) && step > lastUsedStep && hit === null) hit = step;
  }
  return hit;
}

export function otpauthUri(email: string, secret: string) {
  const issuer = "Heritage Gift Wala";
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
}

// ── Secrets at rest ──────────────────────────────────────────────────────────
// The authenticator secret is encrypted (AES-256-GCM) with a key derived from APP_SECRET, so a copy
// of the database alone can't be used to generate login codes.

function key(appSecret: string) {
  return Buffer.from(hkdfSync("sha256", appSecret, "heritagegiftwala", "totp-secret-v1", 32));
}

export function seal(plain: string, appSecret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(appSecret), iv, { authTagLength: 16 });
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

export function unseal(sealed: string, appSecret: string): string | null {
  try {
    const [v, iv, tag, body] = sealed.split(":");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", key(appSecret), Buffer.from(iv, "base64"), { authTagLength: 16 });
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ── Recovery codes ───────────────────────────────────────────────────────────

export function newRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32(randomBytes(8)).slice(0, 12); // 60 bits
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

export const normalizeRecovery = (code: string) => code.replace(/[^A-Za-z2-7]/g, "").toUpperCase();

export const recoveryHash = (code: string, appSecret: string) =>
  createHmac("sha256", appSecret).update(`recovery:${normalizeRecovery(code)}`).digest("hex");
