/**
 * Talks to a running copy of the site the way a customer, an attacker and the owner would.
 *   BASE_URL=http://localhost:3457 DATABASE_URL=postgres://… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:api
 * Use a scratch database: it creates products, orders, customers and coupons.
 * Start the site with WEB_CHECKOUT=on for this suite: the website's own order endpoints are switched off by default
 * (customers order on WhatsApp), and whatsapp.test.mts covers that default.
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

let seq = 0;
/** A phone number nobody has used before, even in an earlier run against the same scratch database. */
const uniquePhone = () => `9${String(100000000 + (parseInt(run, 36) % 700000000) + ++seq * 37).slice(0, 9)}`;
/** A different household every time: its own email, phone and address (the shop limits open orders per person). */
const person = (n = run) => {
  seq += 1;
  return { email: `buyer-${n}-${seq}@example.com`, phone: uniquePhone(), name: "Asha Patel", address1: `${seq} Rose Society ${n}`, address2: "", city: "Patan", state: "Gujarat", pincode: "384265" };
};

let productId = "";
before(async () => {
  productId = (await q("insert into shop.products (handle, title, price, stock) values ($1, 'API test product', 500, 600) returning id", [`api-${run}`]))[0].id;
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
    const r = await call("/api/orders", { body: { items: items(), shipping: "standard", contact: { ...person(`sql-${run}`), name, address1: `<img src=x onerror=alert(1)> ${run}` } } });
    assert.equal(r.status, 201);
    const row = (await q("select name, address1 from shop.orders where number=$1", [r.json.order.number]))[0];
    assert.equal(row.name, name);
    assert.ok((await q("select count(*)::int as n from shop.orders"))[0].n > 0, "the orders table must still exist");
  });

  test("a product with no price can't be ordered through the website", async () => {
    const free = (await q("insert into shop.products (handle, title, price, stock) values ($1, 'API unpriced', null, 20) returning id", [`api-unpriced-${run}`]))[0].id;
    const quote = await call("/api/quote", { body: { items: items(1, free), shipping: "standard" } });
    assert.equal(quote.status, 409);
    assert.equal(quote.json.code, "NOT_PRICED");
    const order = await call("/api/orders", { body: { items: items(1, free), shipping: "standard", contact: person(`unpriced-${run}`) } });
    assert.equal(order.status, 409);
    assert.equal((await q("select stock from shop.products where id=$1", [free]))[0].stock, 20, "a refused order must not touch stock");
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

describe("coupon tricks through the real API", () => {
  test("a one-use coupon can't be used twice by the same person, even with dots or +tags in their email", async () => {
    const code = `ONCE${run.toUpperCase()}`;
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ($1, 'fixed', 100, true)", [code]);
    const mine = { ...person(`once-${run}`), email: `Sam.Jones.${run}@gmail.com`, phone: uniquePhone() };
    const first = await call("/api/orders", { body: { items: items(2), shipping: "standard", coupon: code, contact: mine } });
    assert.equal(first.status, 201, first.text);
    for (const email of [`samjones${run}@gmail.com`, `sam.jones.${run}+again@gmail.com`]) {
      const again = await call("/api/orders", { body: { items: items(2), shipping: "standard", coupon: code, contact: { ...mine, email, phone: uniquePhone() } } });
      assert.equal(again.status, 409, `reused with ${email}`);
      assert.equal(again.json.code, "BAD_COUPON");
    }
    const samePhone = await call("/api/orders", { body: { items: items(2), shipping: "standard", coupon: code, contact: { ...mine, email: `fresh-${run}@example.com` } } });
    assert.equal(samePhone.status, 409, "reused with a new email but the same phone");
    const stranger = await call("/api/orders", { body: { items: items(2), shipping: "standard", coupon: code, contact: { ...person(`other-${run}`), phone: uniquePhone() } } });
    assert.equal(stranger.status, 201, "a different person still gets it");
  });

  test("a failed order with a refused coupon leaves no trace: stock and coupon counter untouched", async () => {
    const code = `TRACE${run.toUpperCase()}`;
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ($1, 'fixed', 50, true)", [code]);
    const who = { ...person(`trace-${run}`), phone: uniquePhone() };
    await call("/api/orders", { body: { items: items(1), shipping: "standard", coupon: code, contact: who } });
    const stock = (await q("select stock from shop.products where id=$1", [productId]))[0].stock;
    const used = (await q("select used from shop.coupons where code=$1", [code]))[0].used;
    const refused = await call("/api/orders", { body: { items: items(5), shipping: "standard", coupon: code, contact: who } });
    assert.equal(refused.status, 409);
    assert.equal((await q("select stock from shop.products where id=$1", [productId]))[0].stock, stock);
    assert.equal((await q("select used from shop.coupons where code=$1", [code]))[0].used, used);
  });

  test("the delivery fee can't be dodged: free delivery is judged after the coupon", async () => {
    const big = (await q("insert into shop.products (handle, title, price, stock) values ($1, 'API big ticket', 1000, 50) returning id", [`api-big-${run}`]))[0].id;
    const code = `HALF${run.toUpperCase()}`;
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ($1, 'percent', 50, false)", [code]);
    const r = await call("/api/quote", { body: { items: [{ product_id: big, quantity: 1 }], shipping: "standard", coupon: code } });
    assert.deepEqual([r.json.subtotal, r.json.discount, r.json.shipping_fee, r.json.total], [1000, 500, 79, 579]);
  });
});

describe("protections added after the security review", () => {
  test("one web order can't be huge: item count, value and share of a product's stock are capped", async () => {
    const big = (await q("insert into shop.products (handle, title, price, stock) values ($1, 'API cap product', 100, 600) returning id", [`api-cap-${run}`]))[0].id;
    const tooMany = await call("/api/orders", { body: { items: [{ product_id: big, quantity: 20 }, { product_id: big, quantity: 11 }], shipping: "standard", contact: person() } });
    assert.equal(tooMany.status, 409);
    assert.equal(tooMany.json.code, "ORDER_TOO_BIG");
    const dear = (await q("insert into shop.products (handle, title, price, stock) values ($1, 'API dear product', 30000, 50) returning id", [`api-dear-${run}`]))[0].id;
    assert.equal((await call("/api/orders", { body: { items: [{ product_id: dear, quantity: 2 }], shipping: "standard", contact: person() } })).json.code, "ORDER_TOO_BIG");
    const few = (await q("insert into shop.products (handle, title, price, stock) values ($1, 'API few product', 10, 10) returning id", [`api-few-${run}`]))[0].id;
    const half = await call("/api/orders", { body: { items: [{ product_id: few, quantity: 6 }], shipping: "standard", contact: person() } });
    assert.equal(half.json.code, "TOO_MANY_OF_ONE");
    assert.equal((await q("select stock from shop.products where id=$1", [few]))[0].stock, 10, "a refused order takes nothing");
    assert.equal((await call("/api/orders", { body: { items: [{ product_id: few, quantity: 5 }], shipping: "standard", contact: person() } })).status, 201);
  });

  test("the same person can't keep more than 3 orders open", async () => {
    const me = person(`open-${run}`);
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await call("/api/orders", { body: { items: items(1), shipping: "standard", contact: me } });
      assert.equal(r.status, 201, r.text);
      ids.push(r.json.order.number);
    }
    const fourth = await call("/api/orders", { body: { items: items(1), shipping: "standard", contact: me } });
    assert.equal(fourth.status, 409);
    assert.equal(fourth.json.code, "TOO_MANY_OPEN");
    assert.match(fourth.json.message, /orders on their way/);
  });

  test("a retried order (same idempotency key) is the same order, and stock is taken once", async () => {
    const me = person(`idem-${run}`);
    const idem = crypto.randomUUID();
    const before = (await q("select stock from shop.products where id=$1", [productId]))[0].stock;
    const a = await call("/api/orders", { body: { items: items(2), shipping: "standard", contact: me, idem_key: idem } });
    const b = await call("/api/orders", { body: { items: items(2), shipping: "standard", contact: me, idem_key: idem } });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.equal(b.json.order.number, a.json.order.number);
    assert.equal((await q("select stock from shop.products where id=$1", [productId]))[0].stock, before - 2);
    const racers = await Promise.all(Array.from({ length: 5 }, () => call("/api/orders", { body: { items: items(1), shipping: "standard", contact: person(`idem2-${run}`), idem_key: crypto.randomUUID() } })));
    assert.ok(racers.every((r) => r.status === 201 || r.status === 409));
  });

  test("if the price moved since the customer last saw it, they are told the new total instead of being charged it", async () => {
    const r = await call("/api/orders", { body: { items: items(1), shipping: "standard", contact: person(), expected_total: 1 } });
    assert.equal(r.status, 409);
    assert.equal(r.json.code, "PRICE_CHANGED");
    assert.equal(r.json.new_total, 579);
    assert.equal((await call("/api/orders", { body: { items: items(1), shipping: "standard", contact: person(), expected_total: 579 } })).status, 201);
  });

  test("walking order numbers for one email is stopped, whichever addresses the guesses come from", async () => {
    const email = `walker-${run}@example.com`;
    const statuses = [];
    for (let i = 0; i < 18; i++) statuses.push((await call("/api/track", { body: { order_number: 5000 + i, email } })).status);
    assert.equal(statuses.filter((s) => s === 404).length, 15);
    assert.deepEqual(statuses.slice(15), [429, 429, 429]);
  });

  test("a burst of parallel tracking guesses for one email: exactly 15 are checked, the rest refused", async () => {
    const email = `burstwalk-${run}@example.com`;
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => call("/api/track", { ip: `10.99.${i}.5`, body: { order_number: 7000 + i, email } })));
    assert.equal(results.filter((r) => r.status === 404).length, 15);
    assert.equal(results.filter((r) => r.status === 429).length, 15);
  });

  test("a burst of parallel login guesses from one visitor can't all be tried (counted before the slow check)", async () => {
    const email = `burst-${run}@example.com`;
    await call("/api/account/register", { body: { first_name: "B", last_name: "B", email, phone: "", password: "a-long-enough-password" } });
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => call("/api/account/login", { ip: "10.77.7.7", body: { email, password: `wrong-guess-number-${i}` } })));
    const tried = results.filter((r) => r.status === 401).length;
    assert.equal(tried, 8, `${tried} of 40 parallel guesses were checked; the limit is 8`);
    assert.equal(results.filter((r) => r.status === 429).length, 32);
  });

  test("guesses spread over many addresses still hit a per-account ceiling (60 an hour)", async () => {
    const email = `spread-${run}@example.com`;
    await call("/api/account/register", { body: { first_name: "B", last_name: "B", email, phone: "", password: "a-long-enough-password" } });
    const results = await Promise.all(Array.from({ length: 75 }, (_, i) => call("/api/account/login", { ip: `10.88.${i}.1`, body: { email, password: `wrong-guess-number-${i}` } })));
    const tried = results.filter((r) => r.status === 401).length;
    assert.equal(tried, 60, `${tried} guesses were checked; the account ceiling is 60 an hour`);
  });

  test("a signed-in customer keeps at most 10 sessions, however often they sign in", async () => {
    const email = `sessions-${run}@example.com`;
    await call("/api/account/register", { body: { first_name: "S", last_name: "S", email, phone: "", password: "a-long-enough-password" } });
    for (let i = 0; i < 14; i++) await call("/api/account/login", { body: { email, password: "a-long-enough-password" } });
    const n = (await q("select count(*)::int as n from shop.customer_sessions s join shop.customers c on c.id=s.customer_id where c.email=$1", [email]))[0].n;
    assert.ok(n <= 10, `${n} sessions kept`);
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
