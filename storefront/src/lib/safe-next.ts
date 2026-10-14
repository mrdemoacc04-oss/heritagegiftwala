/**
 * Where to send someone after they sign in. Only paths on this same site are accepted.
 *
 * The address is resolved the way a browser would (so "/\evil.com" and "/<tab>/evil.com" become what the browser
 * would really open), and then the RESULT is checked too: "/..//evil.com" resolves to this site but with the path
 * "//evil.com", which the router would treat as another website. So the final path must be a single-slash path with
 * no backslashes or control characters.
 */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next) return fallback;
  try {
    const base = "http://same-site.invalid";
    const u = new URL(next, base);
    if (u.origin !== base) return fallback;
    const path = `${u.pathname}${u.search}${u.hash}`;
    if (!/^\/(?![/\\])[^\\\u0000-\u001f\u007f]*$/.test(path)) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
