// Password hashing with scrypt (built into Node, memory-hard). Kept free of app imports so the
// command-line scripts can use it too.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * N * R * 2;

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

let dummy: Promise<string> | undefined;
/** Burns the same time as a real check, so "no such account" and "wrong password" take equally long. */
export async function verifyAgainstDummy(password: string) {
  dummy ??= hashPassword(randomBytes(12).toString("hex"));
  await verifyPassword(password, await dummy);
}

const COMMON = new Set(["password", "password1", "12345678", "123456789", "1234567890", "qwerty123", "iloveyou", "welcome1", "letmein123", "admin12345"]);

/** Returns a message when the password is too weak, otherwise null. */
export function passwordProblem(password: string, minLength: number): string | null {
  if (password.length < minLength) return `Use at least ${minLength} characters.`;
  if (password.length > 128) return "Use at most 128 characters.";
  if (COMMON.has(password.toLowerCase())) return "That password is too common. Pick something harder to guess.";
  if (/^(.)\1+$/.test(password)) return "That password is too simple.";
  return null;
}
