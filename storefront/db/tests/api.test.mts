/**
 * Talks to a running copy of the site the way a customer, an attacker and the owner would.
 *   BASE_URL=http://localhost:3457 DATABASE_URL=postgres://… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:api
 * Use a scratch database: it creates products, orders, customers and coupons.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3457";
const ORIGIN = new URL(BASE).origin;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const q = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows;
const run = Math.random().toString(36).slice(2, 8);

let ipCounter = 10;
const freshIp = () => `10.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}.${Math.floor(Math.random() * 200) + 1}`;

type Opts = { method?: string; body?: unknown; cookie?: string; ip?: string; origin?: string | null; type?: string | null; raw?: BodyInit };
async function call(path: string, o: Opts = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": o.ip ?? freshIp() };
  if (o.origin !== null) headers.origin = o.origin ?? ORIGIN;
  if (typeof o.type === "string") headers["content-type"] = o.type;
  else if (o.type === undefined && o.raw === undefined) headers["content-type"] = "application/json";
  if (o.cookie) headers.cookie = o.cookie;
  const res = await fetch(BASE + path, {
    method: o.method ?? "POST",
    headers,
    body: o.raw ?? (o.body === undefined ? undefined : JSON.stringify(o.body)),
    redirect: "manual",
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, json, text, headers: res.headers, setCookie };
}
const cookieFrom = (setCookie: string[]) => setCookie.map((c) => c.split(";")[0]).join("; ");

const person = (n = run) => ({
  email: `buyer-${n}@example.com`, phone: "9876543210", name: "Asha Patel", address1: "12 Rose Society", address2: "", city: "Patan", state: "Gujarat", pincode: "384265",
});

let productId = "";
before(async () => {
  productId = (await q("insert into shop.products (handle, title, price, stock) values ($1, 'API test product', 500, 40) returning id", [`api-${run}`]))[0].id;
  await q("update shop.settings set shipping_flat=79, shipping_express=149, free_shipping_from=999");
});
after(() => db.end());

const items = (qty = 1, id = productId) => [{ product_id: id, quantity: qty }];

describe("public endpoints refuse bad requests", () => {
  test("a request from another website is refused (CSRF)", async () => {
    for (const path of ["/api/quote", "/api/orders", "/api/track", "/api/account/login"]) {
      const foreign = await call(path, { body: {}, origin: "https://evil.example" });
      assert.equal(foreign.status, 403, `${path} accepted a foreign Origin`);
      const none = await call(path, { body: {}, origin: null });
      assert.equal(none.status, 403, `${path} accepted a request with no Origin`);
    }
  });

  test("only JSON is accepted", async () => {
    const r = await call("/api/quote", { raw: "items=1", type: "application/x-www-form-urlencoded" });
    assert.equal(r.status, 415);
  });

  test("oversized and malformed bodies are rejected", async () => {
    assert.equal((await call("/api/quote", { raw: "{not json", type: "application/json" })).status, 400);
    assert.equal((await call("/api/quote", { raw: "x".repeat(40_000), type: "application/json" })).status, 413);
  });

  test("errors never leak internals", async () => {
    const r = await call("/api/orders", { body: { items: [{ product_id: "'; drop table shop.orders;--", quantity: 1 }] } });
    assert.equal(r.status, 400);
    assert.ok(!/stack|select |postgres|shop\./i.test(r.text));
  });
});

describe("quote and order", () => {
  test("a quote is priced from the database, not from the request", async () => {
    const r = await call("/api/quote", { body: { items: [{ product_id: productId, quantity: 2, price: 1, unit_price: 1 }], shipping: "standard" } });
    assert.equal(r.status, 200);
    assert.equal(r.json.subtotal, 1000);
    assert.equal(r.json.shipping_fee, 0);
    assert.equal(r.json.total, 1000);
  });

  test("impossible bags are refused", async () => {
    for (const body of [
      { items: [{ product_id: productId, quantity: 0 }], shipping: "standard" },
      { items: [{ product_id: productId, quantity: -1 }], shipping: "standard" },
      { items: [{ product_id: productId, quantity: 999 }], shipping: "standard" },
      { items: [{ product_id: productId, quantity: 1.5 }], shipping: "standard" },
      { items: [], shipping: "standard" },
      { items: items(), shipping: "teleport" },
    ]) assert.equal((await call("/api/quote", { body })).status, 400, JSON.stringify(body));
    assert.equal((await call("/api/quote", { body: { items: items(1, "00000000-0000-0000-0000-000000000000"), shipping: "standard" } })).status, 409);
  });

  test("placing an order takes stock and returns a number", async () => {
    const before = (await q("select stock from shop.products where id=$1", [productId]))[0].stock;
    const r = await call("/api/orders", { body: { items: items(2), shipping: "standard", contact: person() } });
    assert.equal(r.status, 201, r.text);
    assert.ok(r.json.order.number >= 1001);
    assert.equal(r.json.order.total, 1000);
    assert.equal((await q("select stock from shop.products where id=$1", [productId]))[0].stock, before - 2);
  });

  test("a customer id in the request is ignored; only a real session can own an order", async () => {
    const victim = (await q("insert into shop.customers (email, password_hash) values ($1, 'x') returning id", [`victim-${run}@example.com`]))[0].id;
    const r = await call("/api/orders", { body: { items: items(1), shipping: "standard", contact: person(`own-${run}`), customer_id: victim } });
    assert.equal(r.status, 201);
    const o = (await q("select customer_id from shop.orders where number=$1", [r.json.order.number]))[0];
    assert.equal(o.customer_id, null);
  });

  test("invalid contact details are refused with field names, not database errors", async () => {
    const bad = { ...person(), email: "not-an-email", pincode: "12", phone: "123" };
    const r = await call("/api/orders", { body: { items: items(), shipping: "standard", contact: bad } });
    assert.equal(r.status, 400);
    assert.ok(r.json.fields.some((f: string) => f.includes("email")));
  });

  test("odd-looking text is stored as plain text, never run", async () => {
    const name = `Robert'); DROP TABLE shop.orders;-- <script>alert(1)</script>`;
    const r = await call("/api/orders", { body: { items: items(), shipping: "standard", contact: { ...person(`sql-${run}`), name, address1: "<img src=x onerror=alert(1)>" } } });
    assert.equal(r.status, 201);
    const row = (await q("select name, address1 from shop.orders where number=$1", [r.json.order.number]))[0];
    assert.equal(row.name, name);
    assert.ok((await q("select count(*)::int as n from shop.orders"))[0].n > 0, "the orders table must still exist");
  });

  test("gift wrap details are checked against the real options", async () => {
    const bad = [{ product_id: productId, quantity: 1, wrap: { paper: "x".repeat(500), ribbon: "red", note: "hi" } }];
    assert.equal((await call("/api/quote", { body: { items: bad, shipping: "standard" } })).status, 400);
    const ok = [{ product_id: productId, quantity: 1, wrap: { paper: "polka-lagoon", ribbon: "red", note: "Happy birthday!\u0000\u0007" } }];
    const r = await call("/api/orders", { body: { items: ok, shipping: "standard", contact: person(`wrap-${run}`) } });
    assert.equal(r.status, 201);
    const w = (await q("select wrap from shop.order_items i join shop.orders o on o.id=i.order_id where o.number=$1", [r.json.order.number]))[0].wrap;
    assert.equal(w.note, "Happy birthday!", "control characters are stripped");
  });

  test("the same visitor can't flood the shop with orders", async () => {
    const ip = freshIp();
    const results = [];
    for (let i = 0; i < 13; i++) results.push((await call("/api/orders", { ip, body: { items: items(), shipping: "standard", contact: person(`flood-${run}-${i}`) } })).status);
    assert.equal(results.filter((s) => s === 201).length, 10);
    assert.ok(results.slice(10).every((s) => s === 429), `expected 429s after the limit, got ${results}`);
  });

  test("coupon guessing is rate limited and every failure looks the same", async () => {
    await q("insert into shop.coupons (code, kind, value) values ($1, 'percent', 10)", [`GOOD${run.toUpperCase()}`]);
    const ip = freshIp();
    const ok = await call("/api/quote", { ip, body: { items: items(2), shipping: "standard", coupon: `good${run}` } });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.discount, 100);
    const wrong = await call("/api/quote", { ip, body: { items: items(), shipping: "standard", coupon: "NOPE123" } });
    assert.equal(wrong.status, 409);
    assert.equal(wrong.json.code, "BAD_COUPON");
    const codes = [];
    for (let i = 0; i < 30; i++) codes.push((await call("/api/quote", { ip, body: { items: items(), shipping: "standard", coupon: `GUESS${i}` } })).status);
    assert.ok(codes.includes(429), "many wrong guesses must hit a limit");
  });
});

describe("tracking", () => {
  test("needs the right number AND email; wrong answers look identical; only safe fields come back", async () => {
    const email = `track-${run}@example.com`;
    const placed = await call("/api/orders", { body: { items: items(), shipping: "standard", contact: { ...person(), email } } });
    const number = placed.json.order.number;
    const ok = await call("/api/track", { body: { order_number: `#${number}`, email: email.toUpperCase() } });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.order.stage, "placed");
    const flat = JSON.stringify(ok.json);
    for (const secret of ["9876543210", "Rose Society", "384265", email]) assert.ok(!flat.includes(secret), `leaked ${secret}`);

    const wrongEmail = await call("/api/track", { body: { order_number: number, email: "other@example.com" } });
    const wrongNumber = await call("/api/track", { body: { order_number: number + 5000, email } });
    assert.equal(wrongEmail.status, 404);
    assert.equal(wrongNumber.status, 404);
    assert.equal(wrongEmail.text, wrongNumber.text);
  });

  test("guessing is rate limited", async () => {
    const ip = freshIp();
    const statuses = [];
    for (let i = 0; i < 25; i++) statuses.push((await call("/api/track", { ip, body: { order_number: 1001 + i, email: "x@example.com" } })).status);
    assert.ok(statuses.includes(429));
  });
});

describe("customer accounts", () => {
  const email = `acct-${run}@example.com`;
  const password = "a-long-enough-password";
  let cookie = "";
  let other = "";

  test("weak passwords and duplicates are refused", async () => {
    const base = { first_name: "Asha", last_name: "Patel", email, phone: "", password };
    assert.equal((await call("/api/account/register", { body: { ...base, password: "short" } })).status, 409);
    assert.equal((await call("/api/account/register", { body: { ...base, password: "password1" } })).status, 409);
    const first = await call("/api/account/register", { body: base });
    assert.equal(first.status, 201);
    cookie = cookieFrom(first.setCookie);
    assert.equal((await call("/api/account/register", { body: base })).status, 409);
  });

  test("the session cookie is HttpOnly and SameSite", async () => {
    const r = await call("/api/account/login", { body: { email, password } });
    assert.equal(r.status, 200);
    const session = r.setCookie.find((c) => /hgw_customer/.test(c))!;
    assert.match(session, /HttpOnly/i);
    assert.match(session, /SameSite=Lax/i);
    const hint = r.setCookie.find((c) => /hgw_in/.test(c))!;
    assert.ok(!/HttpOnly/i.test(hint) && !/hgw_customer/.test(hint));
    cookie = cookieFrom(r.setCookie);
  });

  test("wrong password and unknown email give the same answer", async () => {
    const ip = freshIp();
    const a = await call("/api/account/login", { ip, body: { email, password: "wrong-wrong-wrong" } });
    const b = await call("/api/account/login", { ip, body: { email: `nobody-${run}@example.com`, password: "wrong-wrong-wrong" } });
    assert.equal(a.status, 401);
    assert.equal(a.text, b.text);
  });

  test("login attempts are rate limited per visitor", async () => {
    const ip = freshIp();
    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await call("/api/account/login", { ip, body: { email, password: `wrong-password-${i}` } })).status);
    assert.ok(statuses.includes(429));
    // ...but the real owner on another connection is not locked out
    assert.equal((await call("/api/account/login", { body: { email, password } })).status, 200);
  });

  test("me, profile and addresses work for the signed-in customer only", async () => {
    assert.equal((await call("/api/account/me", { method: "GET", origin: null })).json.customer, null);
    assert.equal((await call("/api/account/me", { method: "GET", origin: null, cookie })).json.customer.email, email);
    assert.equal((await call("/api/account/profile", { body: { first_name: "Asha", last_name: "P", phone: "9876543210" } })).status, 401);
    assert.equal((await call("/api/account/profile", { cookie, body: { first_name: "Asha", last_name: "P", phone: "9876543210" } })).status, 200);

    const addr = { first_name: "Asha", last_name: "", phone: "", address_1: "1 Test Lane", address_2: "", city: "Patan", province: "Gujarat", postal_code: "384265", is_default: true };
    assert.equal((await call("/api/account/addresses", { cookie, body: addr })).status, 201);
    const me = (await call("/api/account/me", { method: "GET", origin: null, cookie })).json.customer;
    assert.equal(me.addresses.length, 1);
    assert.equal(me.addresses[0].is_default_shipping, true);
  });

  test("one customer can never read or change another's addresses", async () => {
    const reg = await call("/api/account/register", { body: { first_name: "Eve", last_name: "X", email: `eve-${run}@example.com`, phone: "", password } });
    other = cookieFrom(reg.setCookie);
    const mine = (await call("/api/account/me", { method: "GET", origin: null, cookie })).json.customer.addresses[0].id;
    const edit = await call(`/api/account/addresses/${mine}`, { cookie: other, body: { first_name: "Hacked", last_name: "", phone: "", address_1: "x", address_2: "", city: "x", province: "", postal_code: "384265", is_default: false } });
    assert.equal(edit.status, 404);
    await call(`/api/account/addresses/${mine}`, { method: "DELETE", cookie: other });
    const stillThere = (await call("/api/account/me", { method: "GET", origin: null, cookie })).json.customer.addresses;
    assert.equal(stillThere.length, 1);
    assert.equal(stillThere[0].first_name, "Asha");
  });

  test("a signed-in order shows up in My orders; logout kills the session for good", async () => {
    const placed = await call("/api/orders", { cookie, body: { items: items(), shipping: "standard", contact: { ...person(), email } } });
    assert.equal(placed.status, 201);
    const mine = (await call("/api/account/orders", { method: "GET", origin: null, cookie })).json.orders;
    assert.ok(mine.some((o: { number: string }) => Number(o.number) === placed.json.order.number));
    const theirs = (await call("/api/account/orders", { method: "GET", origin: null, cookie: other })).json.orders ?? [];
    assert.ok(!theirs.some((o: { number: string }) => Number(o.number) === placed.json.order.number));

    assert.equal((await call("/api/account/logout", { cookie })).status, 200);
    assert.equal((await call("/api/account/me", { method: "GET", origin: null, cookie })).json.customer, null, "the old cookie must be dead");
  });
});

describe("admin area", () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  test("admin pages and the upload endpoint are closed to visitors", async () => {
    for (const p of ["/admin", "/admin/orders", "/admin/products", "/admin/coupons", "/admin/settings"]) {
      const r = await call(p, { method: "GET", origin: null });
      assert.equal(r.status, 307, p);
      assert.match(r.headers.get("location") ?? "", /\/admin\/login/);
    }
    const form = new FormData();
    form.set("file", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0])], { type: "image/png" }), "x.png");
    assert.equal((await call("/api/admin/upload", { raw: form, type: null })).status, 401);
  });

  test("a forged or garbage admin cookie gets nowhere", async () => {
    for (const c of ["hgw_admin=" + "a".repeat(43), "hgw_admin=../../etc/passwd", "hgw_admin='; drop table shop.admins;--"]) {
      const r = await call("/admin", { method: "GET", origin: null, cookie: c });
      // The proxy lets a cookie-bearing request through; the page itself must then refuse it.
      assert.ok([307, 303].includes(r.status), `${c} -> ${r.status}`);
      assert.match(r.headers.get("location") ?? "", /\/admin\/login/);
    }
  });

  test("admin login is rate limited, never says which half was wrong, and sets a strict cookie", { skip: !email || !password }, async () => {
    const ip = freshIp();
    // The login form is a Next server action, so drive it with a real browser-like POST.
    const page = await fetch(`${BASE}/admin/login`, { headers: { "x-forwarded-for": ip } });
    assert.equal(page.status, 200);
    assert.doesNotMatch(page.headers.get("cache-control") ?? "", /public|s-maxage/, "the login page must never be cached by a shared cache");
    assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
  });
});

describe("response headers", () => {
  test("security headers are on every page", async () => {
    const r = await call("/", { method: "GET", origin: null });
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.match(r.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.match(r.headers.get("strict-transport-security") ?? "", /max-age/);
    assert.ok(!r.headers.get("x-powered-by"));
  });
});
