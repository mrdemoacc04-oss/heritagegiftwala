/**
 * Database rules: pricing, stock, coupons, order status and tracking.
 * Runs against an empty scratch database, never the real one:
 *   TEST_DATABASE_URL=postgres://… npm run test:db
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Set TEST_DATABASE_URL to an empty scratch database.");
const here = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: url, max: 20 });

const q = (text: string, params: unknown[] = []) => pool.query(text, params);
const one = async (text: string, params: unknown[] = []) => (await q(text, params)).rows[0];

type Item = { product_id: string; quantity: number };
const who = { email: "Asha@Example.com", phone: "9876543210", name: "Asha Patel", address1: "12 Rose Society", city: "Patan", state: "Gujarat", pincode: "384265" };
// Tests place orders as the owner's "take an order" screen does (source: admin), which is exempt from the web-only
// limits. The web-only rules have their own tests below that say source: "web".
const order = (items: Item[], extra: Record<string, unknown> = {}) =>
  one("select shop.place_order($1::jsonb) as r", [JSON.stringify({ items, shipping: "standard", source: "admin", ...who, ...extra })]).then((r) => r.r);
const price = (items: Item[], shipping = "standard", coupon: string | null = null, email: string | null = null, phone: string | null = null, extra: Record<string, unknown> = {}) =>
  one("select shop.price_cart($1::jsonb, $2, $3, $4::jsonb) as r", [JSON.stringify(items), shipping, coupon, JSON.stringify({ email, phone, admin: true, ...extra })]).then((r) => r.r);
let personCounter = 0;
/** A web customer nobody has ordered as before: unique email, phone and address. */
const stranger = () => {
  const n = ++personCounter;
  return { email: `web${n}-${Math.random().toString(36).slice(2, 7)}@example.com`, phone: `98${String(10000000 + n * 7919).slice(0, 8)}`, address1: `${n} Unique Street ${Math.random().toString(36).slice(2, 6)}`, name: "Web Buyer", source: "web" };
};
const webOrder = (items: Item[], extra: Record<string, unknown> = {}) => order(items, { ...stranger(), ...extra });

async function product(overrides: Record<string, unknown> = {}) {
  const base = { handle: `p-${Math.random().toString(36).slice(2, 10)}`, title: "Test product", price: 500, stock: 5, track_stock: true, status: "active", ...overrides };
  const r = await one(
    "insert into shop.products (handle, title, price, stock, track_stock, status) values ($1,$2,$3,$4,$5,$6) returning id",
    [base.handle, base.title, base.price, base.stock, base.track_stock, base.status],
  );
  return r.id as string;
}
const stockOf = async (id: string) => (await one("select stock from shop.products where id=$1", [id])).stock as number;
const failsWith = async (fn: () => Promise<unknown>, code: string) => {
  await assert.rejects(fn, (e: Error) => {
    assert.match(e.message, new RegExp(`^${code}:`), `expected ${code} but got: ${e.message}`);
    return true;
  });
};

before(async () => {
  await q("drop schema if exists shop cascade");
  const dir = path.join(here, "../migrations");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await q(fs.readFileSync(path.join(dir, file), "utf8"));
  // Running everything a second time must change nothing (the real database is migrated repeatedly).
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await q(fs.readFileSync(path.join(dir, file), "utf8"));
  await q("update shop.settings set shipping_flat=79, shipping_express=149, free_shipping_from=999");
});
after(() => pool.end());

describe("pricing", () => {
  test("totals come from the database, with delivery and the free-delivery threshold", async () => {
    const a = await product({ price: 400 });
    const b = await product({ price: 700 });
    const small = await price([{ product_id: a, quantity: 1 }]);
    assert.deepEqual([small.subtotal, small.shipping_fee, small.total], [400, 79, 479]);
    const big = await price([{ product_id: a, quantity: 1 }, { product_id: b, quantity: 1 }]);
    assert.deepEqual([big.subtotal, big.shipping_fee, big.total], [1100, 0, 1100]);
    const express = await price([{ product_id: a, quantity: 3 }], "express");
    assert.deepEqual([express.subtotal, express.shipping_fee, express.total], [1200, 149, 1349]);
  });

  test("a threshold of 0 turns free delivery off", async () => {
    const a = await product({ price: 5000 });
    await q("update shop.settings set free_shipping_from=0");
    assert.equal((await price([{ product_id: a, quantity: 1 }])).shipping_fee, 79);
    await q("update shop.settings set free_shipping_from=999");
  });

  test("tampered input is rejected", async () => {
    const a = await product();
    await failsWith(() => price([]), "EMPTY_CART");
    await failsWith(() => price([{ product_id: a, quantity: 0 }]), "BAD_QUANTITY");
    await failsWith(() => price([{ product_id: a, quantity: -3 }]), "BAD_QUANTITY");
    await failsWith(() => price([{ product_id: a, quantity: 21 }]), "BAD_QUANTITY");
    await failsWith(() => price([{ product_id: "00000000-0000-0000-0000-000000000000", quantity: 1 }]), "UNKNOWN_PRODUCT");
    await failsWith(() => price([{ product_id: a, quantity: 1 }], "teleport"), "BAD_SHIPPING");
    await failsWith(() => price(Array.from({ length: 41 }, () => ({ product_id: a, quantity: 1 }))), "TOO_MANY_LINES");
    const draft = await product({ status: "draft" });
    await failsWith(() => price([{ product_id: draft, quantity: 1 }]), "UNKNOWN_PRODUCT");
  });

  test("a price in the request is ignored", async () => {
    const a = await product({ price: 500 });
    const r = await price([{ product_id: a, quantity: 1, unit_price: 1, price: 1 } as Item]);
    assert.equal(r.subtotal, 500);
  });
});

describe("stock", () => {
  test("placing an order takes stock; the same product on two lines counts together", async () => {
    const a = await product({ stock: 5 });
    await order([{ product_id: a, quantity: 2 }]);
    assert.equal(await stockOf(a), 3);
    await failsWith(() => order([{ product_id: a, quantity: 2 }, { product_id: a, quantity: 2 }]), "OUT_OF_STOCK");
    assert.equal(await stockOf(a), 3, "a failed order must not touch stock");
  });

  test("untracked products (services) never run out", async () => {
    const service = await product({ track_stock: false, stock: 0 });
    await order([{ product_id: service, quantity: 7 }]);
    assert.equal(await stockOf(service), 0);
  });

  test("two buyers racing for the last item: exactly one wins", async () => {
    const last = await product({ stock: 1 });
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => order([{ product_id: last, quantity: 1 }])));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await stockOf(last), 0);
    const sold = await one("select count(*)::int as n from shop.order_items where product_id=$1", [last]);
    assert.equal(sold.n, 1);
  });

  test("a half-failed order rolls back completely", async () => {
    const ok = await product({ stock: 5 });
    const empty = await product({ stock: 0 });
    await failsWith(() => order([{ product_id: ok, quantity: 1 }, { product_id: empty, quantity: 1 }]), "OUT_OF_STOCK");
    assert.equal(await stockOf(ok), 5);
  });
});

describe("coupons", () => {
  const coupon = (code: string, over: Record<string, unknown> = {}) => {
    const c = { kind: "percent", value: 10, min_subtotal: 0, max_uses: null, expires_at: null, active: true, once_per_email: false, ...over };
    return q("insert into shop.coupons (code, kind, value, min_subtotal, max_uses, expires_at, active, once_per_email) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [code, c.kind, c.value, c.min_subtotal, c.max_uses, c.expires_at, c.active, c.once_per_email]);
  };

  test("percent and fixed discounts, codes are case-insensitive, fixed never exceeds the subtotal", async () => {
    const a = await product({ price: 1000 });
    await coupon("TEN", { value: 10 });
    await coupon("FLAT200", { kind: "fixed", value: 200 });
    await coupon("HUGE", { kind: "fixed", value: 99999 });
    assert.equal((await price([{ product_id: a, quantity: 1 }], "standard", "ten")).discount, 100);
    assert.equal((await price([{ product_id: a, quantity: 1 }], "standard", "FLAT200")).total, 879, "₹1000 − ₹200 = ₹800, which is under the free-delivery limit, so ₹79 delivery applies");
    const huge = await price([{ product_id: a, quantity: 1 }], "standard", "HUGE");
    assert.equal(huge.discount, 1000);
    assert.equal(huge.total, 79, "a coupon can't be used to unlock free delivery as well: delivery is judged after the discount");
  });

  test("every kind of bad coupon fails with the same error", async () => {
    const a = await product({ price: 500 });
    await coupon("OLD", { expires_at: "2020-01-01" });
    await coupon("OFF", { active: false });
    await coupon("BIG", { min_subtotal: 5000 });
    for (const code of ["OLD", "OFF", "BIG", "NOSUCHCODE"]) {
      await failsWith(() => price([{ product_id: a, quantity: 1 }], "standard", code), "BAD_COUPON");
    }
  });

  test("a coupon with limited uses cannot be over-used by parallel orders", async () => {
    const a = await product({ price: 500, stock: 100 });
    await coupon("TWICE", { max_uses: 2 });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => order([{ product_id: a, quantity: 1 }], { coupon: "TWICE" })));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    assert.equal((await one("select used from shop.coupons where code='TWICE'")).used, 2);
  });

  test("the check constraints stop impossible coupons", async () => {
    await assert.rejects(() => coupon("OVER", { value: 150 }));
    await assert.rejects(() => coupon("bad code!"));
  });
});

describe("order lifecycle and tracking", () => {
  test("status moves forward only; cancelling restocks once; delivered orders are locked", async () => {
    const a = await product({ stock: 10 });
    const o = await order([{ product_id: a, quantity: 3 }]);
    assert.equal(await stockOf(a), 7);

    await q("select shop.set_order_status($1, 'shipped')", [o.id]);
    const shipped = await one("select status, packed_at, shipped_at from shop.orders where id=$1", [o.id]);
    assert.equal(shipped.status, "shipped");
    assert.ok(shipped.packed_at && shipped.shipped_at, "skipping a step still stamps the earlier ones");
    await failsWith(() => q("select shop.set_order_status($1, 'packed')", [o.id]), "BAD_STATUS");

    await q("select shop.set_order_status($1, 'cancelled')", [o.id]);
    assert.equal(await stockOf(a), 10);
    await failsWith(() => q("select shop.set_order_status($1, 'packed')", [o.id]), "LOCKED");
    await q("select shop.set_order_status($1, 'cancelled')", [o.id]);
    assert.equal(await stockOf(a), 10, "cancelling twice must not restock twice");

    const o2 = await order([{ product_id: a, quantity: 1 }]);
    await q("select shop.set_order_status($1, 'delivered')", [o2.id]);
    await failsWith(() => q("select shop.set_order_status($1, 'cancelled')", [o2.id]), "LOCKED");
  });

  test("tracking needs the right email, and shows no phone or street address", async () => {
    const a = await product({ stock: 10, price: 250 });
    const o = await order([{ product_id: a, quantity: 2 }]);
    const hit = (await one("select shop.track_order($1, $2) as t", [o.number, "ASHA@example.com"])).t;
    assert.equal(hit.number, Number(o.number));
    assert.equal(hit.stage, "placed");
    assert.equal(hit.first_name, "Asha");
    assert.equal(hit.items[0].quantity, 2);
    const flat = JSON.stringify(hit);
    for (const secret of ["9876543210", "Rose Society", "384265", "asha@example.com"]) assert.ok(!flat.includes(secret), `leaked ${secret}`);

    assert.equal((await one("select shop.track_order($1, 'someone@else.com') as t", [o.number])).t, null);
    assert.equal((await one("select shop.track_order($1, $2) as t", [Number(o.number) + 99999, "asha@example.com"])).t, null);
  });

  test("a tracking link must be http(s), so a javascript: link can never be saved", async () => {
    const a = await product({ stock: 10 });
    const o = await order([{ product_id: a, quantity: 1 }]);
    await assert.rejects(() => q("update shop.orders set tracking_url='javascript:alert(1)' where id=$1", [o.id]));
    await q("update shop.orders set tracking_url='https://track.example.com/x' where id=$1", [o.id]);
  });

  test("order numbers start at 1001 and never repeat", async () => {
    const a = await product({ stock: 50 });
    const nums = await Promise.all(Array.from({ length: 5 }, () => order([{ product_id: a, quantity: 1 }]).then((r) => Number(r.number))));
    assert.equal(new Set(nums).size, 5);
    assert.ok(Math.min(...nums) >= 1001);
  });
});

describe("rate limiting", () => {
  test("allows up to the limit, then blocks, then resets with the window", async () => {
    const key = `t-${Math.random()}`;
    const hit = async () => (await one("select shop.rate_limit($1, 3, 1) as ok", [key])).ok as boolean;
    assert.deepEqual([await hit(), await hit(), await hit(), await hit()], [true, true, true, false]);
    await new Promise((r) => setTimeout(r, 1200));
    assert.equal(await hit(), true);
  });
});


describe("cheating attempts", () => {
  test("free delivery is decided on what the customer pays, not the sticker total", async () => {
    const a = await product({ price: 1000 });
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ('HALFOFF', 'percent', 50, false)");
    assert.equal((await price([{ product_id: a, quantity: 1 }])).shipping_fee, 0);
    const r = await price([{ product_id: a, quantity: 1 }], "standard", "HALFOFF");
    assert.deepEqual([r.discount, r.shipping_fee, r.total], [500, 79, 579]);
  });

  test("a coupon with 'one use per customer' can't be reused by the same person, however they write their email", async () => {
    const a = await product({ price: 800, stock: 100 });
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ('ONCE', 'fixed', 100, true)");
    const first = await order([{ product_id: a, quantity: 1 }], { coupon: "ONCE", email: "Sam.Jones@Gmail.com", phone: "9000000001" });
    assert.equal(first.discount, 100);
    // dots, +tags and capitals in the same Gmail mailbox
    for (const email of ["samjones@gmail.com", "sam.jones+deal@gmail.com", "S.A.M.Jones@googlemail.com"]) {
      await failsWith(() => order([{ product_id: a, quantity: 1 }], { coupon: "ONCE", email, phone: "9111111111" }), "BAD_COUPON");
    }
    // the same phone number with a different email
    await failsWith(() => order([{ product_id: a, quantity: 1 }], { coupon: "ONCE", email: "totally.new@example.com", phone: "9000000001" }), "BAD_COUPON");
    // a genuinely different person is fine
    assert.equal((await order([{ product_id: a, quantity: 1 }], { coupon: "ONCE", email: "someone.else@example.com", phone: "9222222222", address1: "77 Different Lane" })).discount, 100);
  });

  test("cancelling the order frees the coupon for that person again", async () => {
    const a = await product({ price: 800, stock: 100 });
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ('REFUND', 'fixed', 50, true)");
    const o = await order([{ product_id: a, quantity: 1 }], { coupon: "REFUND", email: "cancel@example.com", phone: "9333333333" });
    await q("select shop.set_order_status($1, 'cancelled')", [o.id]);
    assert.equal((await order([{ product_id: a, quantity: 1 }], { coupon: "REFUND", email: "cancel@example.com", phone: "9333333333" })).discount, 50);
  });

  test("parallel orders with the same one-use coupon: exactly one gets it", async () => {
    const a = await product({ price: 800, stock: 100 });
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ('RACE', 'fixed', 100, true)");
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => order([{ product_id: a, quantity: 1 }], { coupon: "RACE", email: "racer@example.com", phone: "9444444444" })));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  });

  test("a product without a price is quoted on WhatsApp: it can't go into an order, and nothing else is affected", async () => {
    const unpriced = await product({ price: null, title: "Brass Diya" });
    const priced = await product({ price: 300, stock: 10 });
    await failsWith(() => price([{ product_id: unpriced, quantity: 1 }]), "NOT_PRICED");
    await failsWith(() => order([{ product_id: priced, quantity: 1 }, { product_id: unpriced, quantity: 1 }]), "NOT_PRICED");
    assert.equal(await stockOf(priced), 10, "a refused order must not touch stock");
    assert.equal((await price([{ product_id: priced, quantity: 1 }])).subtotal, 300);
    // Putting a price on it makes it orderable again.
    await q("update shop.products set price = 120 where id = $1", [unpriced]);
    assert.equal((await price([{ product_id: unpriced, quantity: 2 }])).subtotal, 240);
  });

  test("a crossed-out 'was' price needs a price, and a price may be empty", async () => {
    const id = await product({ price: 100 });
    await q("update shop.products set compare_at = 150 where id = $1", [id]);
    await assert.rejects(() => q("update shop.products set price = null where id = $1", [id]), /products_compare_needs_price/);
    await q("update shop.products set price = null, compare_at = null where id = $1", [id]);
    assert.equal((await one("select price from shop.products where id = $1", [id])).price, null);
  });

  test("the one-time WhatsApp step removes gift wrap and clears prices once, then leaves later prices alone", async () => {
    const step = fs.readFileSync(path.join(here, "../steps/2026-10-whatsapp-ordering.sql"), "utf8");
    const wrap = await product({ handle: "gift-wrap", price: 49 });
    const keep = await product({ price: 800 });
    await q("update shop.products set compare_at = 999 where id = $1", [keep]);
    await q("delete from shop.applied_steps where name = '2026-10-whatsapp-ordering'");
    await q(step);
    assert.equal((await q("select 1 from shop.products where id = $1", [wrap])).rowCount, 0, "the gift-wrap product is gone");
    const cleared = await one("select price, compare_at from shop.products where id = $1", [keep]);
    assert.deepEqual([cleared.price, cleared.compare_at], [null, null]);
    // The owner types a price in; applying the migrations again must not wipe it.
    await q("update shop.products set price = 650 where id = $1", [keep]);
    await q(step);
    assert.equal((await one("select price from shop.products where id = $1", [keep])).price, 650);
  });

  test("normalize_email treats +tags and Gmail dots as the same mailbox", async () => {
    const n = async (e: string) => (await one("select shop.normalize_email($1) as n", [e])).n;
    assert.equal(await n("A.B+x@Gmail.com"), "ab@gmail.com");
    assert.equal(await n("a.b+x@example.com"), "a.b@example.com");
    assert.equal(await n("  USER@Example.COM "), "user@example.com");
  });

  test("an order total can never go negative or below zero", async () => {
    const a = await product({ price: 100, stock: 10 });
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ('BIGFIXED', 'fixed', 1000000, false)");
    const r = await price([{ product_id: a, quantity: 1 }], "express", "BIGFIXED");
    assert.ok(r.total >= 0);
    assert.equal(r.discount, 100);
  });
});

describe("admin tables", () => {
  test("a password reset token is stored hashed and can only be used once by design (columns exist, RLS on)", async () => {
    const cols = (await q("select column_name from information_schema.columns where table_schema='shop' and table_name='password_resets'")).rows.map((r) => r.column_name);
    for (const c of ["token_hash", "admin_id", "expires_at", "used_at"]) assert.ok(cols.includes(c));
    assert.ok(!cols.includes("token"), "the raw token must never be stored");
  });

  test("every function pins its search_path (no schema-hijack tricks)", async () => {
    const { rows } = await q("select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='shop'");
    assert.ok(rows.length >= 7);
    for (const r of rows) assert.ok((r.proconfig ?? []).some((c: string) => c.startsWith("search_path=")), `${r.proname} has no pinned search_path`);
  });

  test("the old unsafe pricing function is gone", async () => {
    const { rows } = await q("select pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='shop' and p.proname='price_cart'");
    assert.equal(rows.length, 1);
  });
});


describe("limits on one web order (stops one anonymous order emptying the shelves)", () => {
  test("too many items or too much value in one order is refused for the web, but not for the owner", async () => {
    const a = await product({ price: 100, stock: 500 });
    await failsWith(() => webOrder([{ product_id: a, quantity: 20 }, { product_id: a, quantity: 11 }]), "ORDER_TOO_BIG");
    const dear = await product({ price: 20000, stock: 100 });
    await failsWith(() => webOrder([{ product_id: dear, quantity: 3 }]), "ORDER_TOO_BIG");
    assert.equal((await webOrder([{ product_id: a, quantity: 20 }, { product_id: a, quantity: 10 }])).subtotal, 3000, "exactly 30 items is fine");
    assert.equal((await order([{ product_id: dear, quantity: 3 }])).subtotal, 60000, "the owner can take a big order by hand");
  });

  test("one order can't take more than half of a product's stock (never fewer than 3)", async () => {
    const a = await product({ price: 10, stock: 10 });
    await failsWith(() => webOrder([{ product_id: a, quantity: 6 }]), "TOO_MANY_OF_ONE");
    await webOrder([{ product_id: a, quantity: 5 }]);
    const few = await product({ price: 10, stock: 3 });
    await webOrder([{ product_id: few, quantity: 3 }]); // small stock: up to 3 is always allowed
    const split = await product({ price: 10, stock: 10 });
    await failsWith(() => webOrder([{ product_id: split, quantity: 4 }, { product_id: split, quantity: 4 }]), "TOO_MANY_OF_ONE");
    assert.equal(await stockOf(split), 10, "a refused order takes nothing");
    await order([{ product_id: split, quantity: 9 }]);
    assert.equal(await stockOf(split), 1, "the owner is exempt");
  });

  test("the same person can't keep more than 3 orders open at once, however they vary the details", async () => {
    const a = await product({ price: 100, stock: 500 });
    const me = stranger();
    for (let i = 0; i < 3; i++) await order([{ product_id: a, quantity: 1 }], { ...me, name: `Same Person ${i}` });
    await failsWith(() => order([{ product_id: a, quantity: 1 }], { ...me }), "TOO_MANY_OPEN");
    await failsWith(() => order([{ product_id: a, quantity: 1 }], { ...me, email: `other-${Math.random()}@example.com`, address1: "somewhere else 1" }), "TOO_MANY_OPEN"); // same phone
    await failsWith(() => order([{ product_id: a, quantity: 1 }], { ...me, email: `other2-${Math.random()}@example.com`, phone: "9000000099" }), "TOO_MANY_OPEN"); // same address
    await failsWith(() => order([{ product_id: a, quantity: 1 }], { ...me, email: me.email.replace("@", "+x@"), phone: "9000000098", address1: "else 2" }), "TOO_MANY_OPEN"); // +tag
    assert.ok(await webOrder([{ product_id: a, quantity: 1 }]), "an unrelated customer is unaffected");
    const open = await one("select id from shop.orders where email_norm = shop.normalize_email($1) limit 1", [me.email]);
    await q("select shop.set_order_status($1, 'shipped')", [open.id]);
    assert.ok(await order([{ product_id: a, quantity: 1 }], { ...me }), "once one ships, the person can order again");
  });

  test("parallel orders from one person can't race past the open-order limit", async () => {
    const a = await product({ price: 100, stock: 500 });
    const me = stranger();
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => order([{ product_id: a, quantity: 1 }], { ...me })));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  });
});

describe("retries, moving prices and quotes", () => {
  test("submitting the same order twice (lost reply, double tap) makes one order and takes stock once", async () => {
    const a = await product({ price: 100, stock: 50 });
    const idem = crypto.randomUUID();
    const first = await webOrder([{ product_id: a, quantity: 2 }], { idem_key: idem });
    const again = await order([{ product_id: a, quantity: 2 }], { ...stranger(), idem_key: idem });
    assert.equal(again.number, first.number);
    assert.equal(again.duplicate, true);
    assert.equal(await stockOf(a), 48);
  });

  test("two submits of the same order at the same moment make exactly one order", async () => {
    const a = await product({ price: 100, stock: 50 });
    const idem = crypto.randomUUID();
    const me = stranger();
    const results = await Promise.all(Array.from({ length: 6 }, () => order([{ product_id: a, quantity: 1 }], { ...me, idem_key: idem })));
    assert.equal(new Set(results.map((r) => String(r.number))).size, 1);
    assert.equal(await stockOf(a), 49);
  });

  test("if the price moved since the customer last saw it, the order is refused and the new total is returned", async () => {
    const a = await product({ price: 500, stock: 20 });
    await failsWith(() => webOrder([{ product_id: a, quantity: 1 }], { expected_total: 100 }), "PRICE_CHANGED");
    assert.equal(await stockOf(a), 20);
    const ok = await webOrder([{ product_id: a, quantity: 1 }], { expected_total: 579 });
    assert.equal(ok.total, 579);
    try { await webOrder([{ product_id: a, quantity: 1 }], { expected_total: 1 }); } catch (e) { assert.match((e as Error).message, /^PRICE_CHANGED:579/); }
  });

  test("a price quote reads without locking: it never waits for an order that holds the product", async () => {
    const a = await product({ price: 100, stock: 20 });
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query("select * from shop.products where id = $1 for update", [a]);
      const started = Date.now();
      const r = await price([{ product_id: a, quantity: 1 }], "standard", null, null, null, { admin: false });
      assert.ok(Date.now() - started < 1500, "the quote had to wait for the lock");
      assert.equal(r.subtotal, 100);
    } finally {
      await holder.query("rollback");
      holder.release();
    }
  });

  test("an order waits a few seconds for a held product, then gives up instead of hanging for ever", async () => {
    const a = await product({ price: 100, stock: 20 });
    const holder = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query("select * from shop.products where id = $1 for update", [a]);
      const started = Date.now();
      await assert.rejects(() => webOrder([{ product_id: a, quantity: 1 }]), (e: Error) => /lock timeout|canceling statement/i.test(e.message));
      assert.ok(Date.now() - started < 9000);
    } finally {
      await holder.query("rollback");
      holder.release();
    }
  });
});

describe("coupon identity and bookkeeping", () => {
  const code = (c: string, over = "true") => q(`insert into shop.coupons (code, kind, value, once_per_email) values ('${c}', 'fixed', 50, ${over})`);

  test("the same delivery address can't reuse a one-use coupon under a new name, email and phone", async () => {
    const a = await product({ price: 800, stock: 100 });
    await code("ADDR");
    const me = stranger();
    await order([{ product_id: a, quantity: 1 }], { ...me, coupon: "ADDR" });
    await failsWith(() => order([{ product_id: a, quantity: 1 }], { ...me, email: `new-${Math.random()}@example.com`, phone: "9777777701", name: "Someone Else", address1: me.address1.toUpperCase().replace(/ /g, "  ") + "." , coupon: "ADDR" }), "BAD_COUPON");
  });

  test("a signed-in account can't reuse a one-use coupon with fresh contact details", async () => {
    const a = await product({ price: 800, stock: 100 });
    await code("ACCT");
    const cust = (await one("insert into shop.customers (email, password_hash) values ($1, 'x') returning id", [`acct-${Math.random()}@example.com`])).id;
    await webOrder([{ product_id: a, quantity: 1 }], { coupon: "ACCT", customer_id: cust });
    await failsWith(() => webOrder([{ product_id: a, quantity: 1 }], { coupon: "ACCT", customer_id: cust }), "BAD_COUPON");
  });

  test("cancelling an order gives the coupon use back, once", async () => {
    const a = await product({ price: 800, stock: 100 });
    await q("insert into shop.coupons (code, kind, value, once_per_email, max_uses) values ('GIVEBACK', 'fixed', 50, false, 2)");
    const o = await order([{ product_id: a, quantity: 1 }], { coupon: "GIVEBACK" });
    assert.equal((await one("select used from shop.coupons where code='GIVEBACK'")).used, 1);
    await q("select shop.set_order_status($1, 'cancelled')", [o.id]);
    await q("select shop.set_order_status($1, 'cancelled')", [o.id]);
    assert.equal((await one("select used from shop.coupons where code='GIVEBACK'")).used, 0, "back to zero, and not below it");
  });

  test("a 100% coupon on the biggest possible owner order doesn't overflow", async () => {
    const huge = await product({ price: 1000000, stock: 100000 });
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ('ALLOFF', 'percent', 100, false)");
    const r = await price(Array.from({ length: 40 }, () => ({ product_id: huge, quantity: 20 })), "standard", "ALLOFF");
    assert.equal(r.subtotal, 800000000);
    assert.equal(r.discount, 800000000);
  });

  test("a missing delivery option is refused", async () => {
    const a = await product();
    await assert.rejects(() => one("select shop.price_cart($1::jsonb, null, null) as r", [JSON.stringify([{ product_id: a, quantity: 1 }])]), /BAD_SHIPPING/);
  });
});

describe("cancelling while orders arrive can't deadlock", () => {
  test("many cancels and new orders over the same products, all at once", async () => {
    const ps = await Promise.all(Array.from({ length: 5 }, () => product({ price: 100, stock: 1000 })));
    const orders = await Promise.all(Array.from({ length: 12 }, (_, i) => order(ps.map((id, k) => ({ product_id: id, quantity: 1 + ((i + k) % 3) })).reverse())));
    const work = [
      ...orders.map((o) => q("select shop.set_order_status($1, 'cancelled')", [o.id])),
      ...Array.from({ length: 12 }, (_, i) => order(ps.map((id, k) => ({ product_id: id, quantity: 1 + ((i * 2 + k) % 3) })))),
    ];
    const results = await Promise.allSettled(work);
    const failures = results.filter((r) => r.status === "rejected").map((r) => (r as PromiseRejectedResult).reason.message);
    assert.deepEqual(failures, [], "no deadlocks or errors");
    for (const id of ps) assert.ok((await stockOf(id)) >= 0);
  });
});

describe("sign-in allowance refunds", () => {
  test("a refund gives one hit back, never below zero", async () => {
    const key = `refund-${Math.random()}`;
    for (let i = 0; i < 3; i++) await one("select shop.rate_limit($1, 3, 60)", [key]);
    assert.equal((await one("select shop.rate_limit_check($1, 3) as ok", [key])).ok, false);
    await one("select shop.rate_limit_refund($1)", [key]);
    assert.equal((await one("select shop.rate_limit_check($1, 3) as ok", [key])).ok, true);
    for (let i = 0; i < 6; i++) await one("select shop.rate_limit_refund($1)", [key]);
    assert.equal((await one("select count from shop.rate_limits where key=$1", [key])).count, 0);
  });
});


describe("fixes from the second review", () => {
  test("an address with too little Latin text gets no key, so different households aren't mistaken for each other", async () => {
    const k = async (pin: string, a: string) => (await one("select shop.address_key($1, $2) as k", [pin, a])).k as string;
    assert.equal(await k("384265", "12"), "");
    assert.equal(await k("384265", "ઘર નંબર ૧૨, પાટણ"), "");
    assert.equal(await k("384265", "12 Rose Society"), "384265:12rosesociety");
    assert.equal(await k("384265", "12, ROSE-society."), "384265:12rosesociety");
    const a = await product({ price: 100, stock: 500 });
    await q("insert into shop.coupons (code, kind, value, once_per_email) values ('NOKEY', 'fixed', 10, true)");
    // five different households, all with a short or non-Latin address in the same PIN code: nobody blocks anybody
    for (const address1 of ["12", "7", "ઘર ૩", "૪૫", "B-2"]) {
      const r = await order([{ product_id: a, quantity: 1 }], { ...stranger(), address1, pincode: "384265", coupon: "NOKEY" });
      assert.equal(r.discount, 10);
    }
  });

  test("parallel orders that share only a phone number, or only an address, still can't pass the open-order limit", async () => {
    const a = await product({ price: 100, stock: 500 });
    const me = stranger();
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => order([{ product_id: a, quantity: 1 }], { ...me, email: `parallel-${i}-${Math.random().toString(36).slice(2, 6)}@example.com`, address1: i % 2 ? me.address1 : `${i} Different Road Number ${i}` })));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
    const byAddress = stranger();
    const results2 = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => order([{ product_id: a, quantity: 1 }], { ...byAddress, email: `addr-${i}-${Math.random().toString(36).slice(2, 6)}@example.com`, phone: `97${String(10000000 + i * 31337).slice(0, 8)}` })));
    assert.equal(results2.filter((r) => r.status === "fulfilled").length, 3);
  });

  test("a retry that waited behind its own twin gets the first order back, not a spurious refusal", async () => {
    const a = await product({ price: 100, stock: 10 });
    const idem = crypto.randomUUID();
    const me = stranger();
    for (let i = 0; i < 3; i++) await order([{ product_id: a, quantity: 1 }], { ...me });
    const first = await order([{ product_id: a, quantity: 1 }], { ...me, email: `idem-${Math.random()}@example.com`, phone: "9100000011", address1: "999 Somewhere Else Entirely", idem_key: idem });
    const twins = await Promise.all(Array.from({ length: 4 }, () => order([{ product_id: a, quantity: 1 }], { ...me, email: first.email ?? `idem2-${Math.random()}@example.com`, phone: "9100000011", address1: "999 Somewhere Else Entirely", idem_key: idem })));
    assert.ok(twins.every((t) => String(t.number) === String(first.number)));
  });

  test("clearing counters by prefix removes only that family", async () => {
    const tag = `clr-${Math.random()}`;
    for (const k of [`${tag}:a`, `${tag}:b`, `other-${tag}`]) await one("select shop.rate_limit($1, 5, 60)", [k]);
    await one("select shop.rate_limit_clear($1)", [`${tag}:`]);
    const left = (await q("select key from shop.rate_limits where key like $1", [`%${tag}%`])).rows.map((r) => r.key);
    assert.deepEqual(left, [`other-${tag}`]);
  });
});

describe("sign-in allowance", () => {
  test("only counted failures use it up: looking never counts, and it refills with the window", async () => {
    const key = `signin-${Math.random()}`;
    const open = async () => (await one("select shop.rate_limit_check($1, 3) as ok", [key])).ok as boolean;
    for (let i = 0; i < 20; i++) assert.equal(await open(), true, "checking alone never uses the allowance");
    for (let i = 0; i < 3; i++) await one("select shop.rate_limit($1, 3, 1)", [key]);
    assert.equal(await open(), false, "three counted failures close it");
    await new Promise((r) => setTimeout(r, 1200));
    assert.equal(await open(), true, "and it reopens when the window ends");
  });
});

describe("lockdown", () => {
  test("every table has row level security on and nothing is granted to PUBLIC", async () => {
    const { rows } = await q("select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='shop' and relkind='r'");
    assert.ok(rows.length >= 14);
    for (const r of rows) assert.equal(r.relrowsecurity, true, `${r.relname} is missing row level security`);
    const grants = await q("select count(*)::int as n from information_schema.role_table_grants where table_schema='shop' and grantee='PUBLIC'");
    assert.equal(grants.rows[0].n, 0);
    const open = await q("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='shop' and (p.proacl is null or p.proacl::text ~ '(^[{]|,)=X/')");
    assert.deepEqual(open.rows.map((r) => r.proname), [], "no function is executable by PUBLIC");
  });
});
