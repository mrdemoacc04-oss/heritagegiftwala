// Password hashing with scrypt (built into Node, memory-hard). Kept free of app imports so the
// command-line scripts can use it too.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// OWASP-recommended cost: 64 MiB of memory, two passes. Older, cheaper hashes still verify and are upgraded at next sign-in.
const N = 2 ** 16;
const R = 8;
const P = 2;
const KEYLEN = 64;
const MAXMEM = 128 * N * R * 3;

const derive = (password: string, salt: Buffer, n = N, r = R, p = P) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  );

/** `scrypt$N$r$p$salt$hash`, so the cost can be raised later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "base64");
    const actual = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** True when a stored hash was made with weaker settings than today's, so it should be re-made after a successful sign-in. */
export function needsRehash(stored: string): boolean {
  const [scheme, n, r, p] = stored.split("$");
  return scheme !== "scrypt" || Number(n) < N || Number(r) < R || Number(p) < P;
}

// Made once, when the server starts, so the very first "no such account" sign-in costs the same as every other.
const dummy: Promise<string> = hashPassword(randomBytes(12).toString("hex"));
dummy.catch(() => {});

/** Burns the same time as a real check, so "no such account" and "wrong password" take equally long. */
export async function verifyAgainstDummy(password: string) {
  await verifyPassword(password, await dummy);
}

const COMMON = new Set(["password", "password1", "12345678", "123456789", "1234567890", "qwerty123", "iloveyou", "welcome1", "letmein123", "admin12345"]);

/**
 * Returns a message when the password is too weak, otherwise null.
 * `personal` are words that must not appear in it (the account's email, the shop's name…).
 */
export function passwordProblem(password: string, minLength: number, personal: string[] = []): string | null {
  if (password.length < minLength) return `Use at least ${minLength} characters.`;
  if (password.length > 128) return "Use at most 128 characters.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "That password is too common. Pick something harder to guess.";
  if (/^(.)\1+$/.test(password)) return "That password is too simple.";
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/.test(lower)) return "Avoid runs like 1234 or abcd.";
  for (const word of personal) {
    if (word.length >= 4 && lower.includes(word.toLowerCase())) return "Don't use the shop's name or your email in the password.";
  }
  if (new Set(lower).size < 6) return "That password doesn't have enough different characters.";
  return null;
}
