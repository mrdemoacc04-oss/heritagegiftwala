/** Pure-logic security checks: two-step codes, secret encryption, recovery codes and the password rules. */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { base32, codeAt, newRecoveryCodes, newSecret, normalizeRecovery, otpauthUri, recoveryHash, seal, unseal, verifyCode } from "../../src/lib/server/totp.ts";
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from "../../src/lib/server/password.ts";

// RFC 6238 test secret ("12345678901234567890") and its published 6-digit codes.
const RFC = base32(Buffer.from("12345678901234567890"));

describe("two-step codes (RFC 6238)", () => {
  test("match the published test vectors", () => {
    const at = (seconds: number) => codeAt(RFC, Math.floor(seconds / 30));
    assert.equal(at(59), "287082");
    assert.equal(at(1111111109), "081804");
    assert.equal(at(1234567890), "005924");
    assert.equal(at(2000000000), "279037");
  });

  test("a code is accepted once, and never again", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 1000 / 30);
    const code = codeAt(RFC, step);
    assert.equal(verifyCode(RFC, code, 0, now), step);
    assert.equal(verifyCode(RFC, code, step, now), null, "replaying the same code is refused");
  });

  test("allows one step of clock drift and no more", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 1000 / 30);
    assert.equal(verifyCode(RFC, codeAt(RFC, step - 1), 0, now), step - 1);
    assert.equal(verifyCode(RFC, codeAt(RFC, step + 1), 0, now), step + 1);
    assert.equal(verifyCode(RFC, codeAt(RFC, step - 2), 0, now), null);
    assert.equal(verifyCode(RFC, codeAt(RFC, step + 2), 0, now), null);
  });

  test("garbage is refused", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 3456", "000000".replace("0", "o")]) assert.equal(verifyCode(RFC, bad, 0), null);
  });

  test("secrets are random, 160 bits, and the setup link carries the right details", () => {
    const a = newSecret();
    assert.notEqual(a, newSecret());
    assert.match(a, /^[A-Z2-7]{32}$/);
    const uri = otpauthUri("owner@example.com", a);
    assert.match(uri, /^otpauth:\/\/totp\/Heritage%20Gift%20Wala:owner%40example\.com\?secret=/);
    assert.match(uri, /digits=6&period=30/);
  });
});

describe("secrets at rest", () => {
  const key = "a-long-app-secret-a-long-app-secret-0123";
  test("encrypt and decrypt, with a fresh nonce every time", () => {
    const secret = newSecret();
    const a = seal(secret, key);
    const b = seal(secret, key);
    assert.notEqual(a, b);
    assert.ok(!a.includes(secret));
    assert.equal(unseal(a, key), secret);
  });
  test("the wrong key, a tampered value or junk gives nothing", () => {
    const sealed = seal("SECRETSECRETSECRET", key);
    assert.equal(unseal(sealed, "a-different-secret-a-different-secret-12"), null);
    const parts = sealed.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    assert.equal(unseal(parts.join(":"), key), null);
    assert.equal(unseal("not-sealed", key), null);
  });
});

describe("recovery codes", () => {
  test("are unique, readable and hash the same however they are typed", () => {
    const codes = newRecoveryCodes(10);
    assert.equal(new Set(codes).size, 10);
    for (const c of codes) assert.match(c, /^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    const c = codes[0];
    const key = "k".repeat(40);
    assert.equal(recoveryHash(c, key), recoveryHash(c.toLowerCase().replace(/-/g, " "), key));
    assert.notEqual(recoveryHash(c, key), recoveryHash(codes[1], key));
    assert.notEqual(recoveryHash(c, key), recoveryHash(c, "j".repeat(40)), "keyed: useless without the app secret");
    assert.equal(normalizeRecovery(c).length, 12);
  });
});

describe("password rules", () => {
  const shop = ["heritage", "giftwala", "patan", "owner"];
  test("reject short, common, patterned and shop-related passwords", () => {
    for (const bad of ["short1!", "password1234", "aaaaaaaaaaaa", "Heritage-Gifts-2026", "myGiftwalaShop99!", "owner-owner-owner", "abcd1234efgh", "qwertyuiop12"]) {
      assert.ok(passwordProblem(bad, 12, shop), `${bad} should have been refused`);
    }
  });
  test("accept a long, unrelated passphrase", () => {
    assert.equal(passwordProblem("tulip-marble-oxygen-canal-71", 12, shop), null);
  });
  test("hashing: verifies the right password only, and every hash is different", async () => {
    const h1 = await hashPassword("correct horse battery");
    const h2 = await hashPassword("correct horse battery");
    assert.notEqual(h1, h2);
    assert.match(h1, /^scrypt\$65536\$8\$2\$/);
    assert.equal(needsRehash(h1), false);
    assert.equal(await verifyPassword("correct horse battery", h1), true);
    assert.equal(await verifyPassword("Correct horse battery", h1), false);
    assert.equal(await verifyPassword("anything", "scrypt$garbage"), false);
    assert.equal(await verifyPassword("anything", ""), false);
  });
  test("a hash made with older, cheaper settings still works and is flagged for upgrade", async () => {
    const old = "scrypt$32768$8$1$" + Buffer.from("0123456789abcdef").toString("base64") + "$";
    assert.equal(needsRehash(old + "x"), true);
    assert.equal(needsRehash("bcrypt$whatever"), true);
    // make a real old-style hash and check it verifies
    const { scrypt } = await import("node:crypto");
    const salt = Buffer.from("0123456789abcdef");
    const key: Buffer = await new Promise((res, rej) => scrypt("an old password".normalize("NFKC"), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 128 * 32768 * 8 * 3 }, (e, k) => (e ? rej(e) : res(k))));
    const stored = ["scrypt", 32768, 8, 1, salt.toString("base64"), key.toString("base64")].join("$");
    assert.equal(await verifyPassword("an old password", stored), true);
    assert.equal(await verifyPassword("another one", stored), false);
    assert.equal(needsRehash(stored), true);
  });
});

import { safeNext } from "../../src/lib/safe-next.ts";

describe("where to go after signing in (no open redirect)", () => {
  test("keeps ordinary same-site addresses", () => {
    assert.equal(safeNext("/checkout"), "/checkout");
    assert.equal(safeNext("/shop?max=500#top"), "/shop?max=500#top");
    assert.equal(safeNext("account/orders"), "/account/orders");
    assert.equal(safeNext("/a/../checkout"), "/checkout");
    assert.equal(safeNext("/%2e%2e/checkout"), "/checkout");
    // an encoded slash is just a (harmless, 404) path on this site: it can't change the host
    assert.equal(safeNext("/%2f/evil.com"), "/%2f/evil.com");
    assert.equal(safeNext(null), "/account");
    assert.equal(safeNext(""), "/account");
  });
  test("refuses everything that leaves the site", () => {
    for (const evil of ["//evil.com", "/\\evil.com", "/%5Cevil.com".replace("%5C", "\\"), "/\t/evil.com", "/\n/evil.com", "\\\\evil.com", "https://evil.com", "http://evil.com/x", "javascript:alert(1)", "data:text/html,hi", " //evil.com", "/\r/evil.com", "\\/evil.com", "///evil.com", "mailto:a@b.c", "/..//evil.com", "/.//evil.com", "/a/..\\/evil.com", "/%2e%2e//evil.com", "/a/./../..//evil.com", "/..///evil.com", "/x/../../..//evil.com"]) {
      assert.equal(safeNext(evil), "/account", `${JSON.stringify(evil)} must not be followed`);
    }
  });
});
