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

type Item = { product_id: string; quantity: number; wrap?: unknown };
const who = { email: "Asha@Example.com", phone: "9876543210", name: "Asha Patel", address1: "12 Rose Society", city: "Patan", state: "Gujarat", pincode: "384265" };
const order = (items: Item[], extra: Record<string, unknown> = {}) =>
  one("select shop.place_order($1::jsonb) as r", [JSON.stringify({ items, shipping: "standard", ...who, ...extra })]).then((r) => r.r);
const price = (items: Item[], shipping = "standard", coupon: string | null = null) =>
  one("select shop.price_cart($1::jsonb, $2, $3, false) as r", [JSON.stringify(items), shipping, coupon]).then((r) => r.r);

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
  await q(fs.readFileSync(path.join(here, "../migrations/0001_init.sql"), "utf8"));
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
    const wrap = await product({ track_stock: false, stock: 0 });
    await order([{ product_id: wrap, quantity: 7 }]);
    assert.equal(await stockOf(wrap), 0);
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
    const c = { kind: "percent", value: 10, min_subtotal: 0, max_uses: null, expires_at: null, active: true, ...over };
    return q("insert into shop.coupons (code, kind, value, min_subtotal, max_uses, expires_at, active) values ($1,$2,$3,$4,$5,$6,$7)",
      [code, c.kind, c.value, c.min_subtotal, c.max_uses, c.expires_at, c.active]);
  };

  test("percent and fixed discounts, codes are case-insensitive, fixed never exceeds the subtotal", async () => {
    const a = await product({ price: 1000 });
    await coupon("TEN", { value: 10 });
    await coupon("FLAT200", { kind: "fixed", value: 200 });
    await coupon("HUGE", { kind: "fixed", value: 99999 });
    assert.equal((await price([{ product_id: a, quantity: 1 }], "standard", "ten")).discount, 100);
    assert.equal((await price([{ product_id: a, quantity: 1 }], "standard", "FLAT200")).total, 800);
    const huge = await price([{ product_id: a, quantity: 1 }], "standard", "HUGE");
    assert.equal(huge.discount, 1000);
    assert.equal(huge.total, 0, "free delivery applies on the pre-discount subtotal");
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
    const o = await order([{ product_id: a, quantity: 2, wrap: { paper: "kraft-stars" } }]);
    const hit = (await one("select shop.track_order($1, $2) as t", [o.number, "ASHA@example.com"])).t;
    assert.equal(hit.number, Number(o.number));
    assert.equal(hit.stage, "placed");
    assert.equal(hit.first_name, "Asha");
    assert.equal(hit.items[0].gift_wrapped, true);
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

describe("lockdown", () => {
  test("every table has row level security on and nothing is granted to PUBLIC", async () => {
    const { rows } = await q("select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='shop' and relkind='r'");
    assert.ok(rows.length >= 12);
    for (const r of rows) assert.equal(r.relrowsecurity, true, `${r.relname} is missing row level security`);
    const grants = await q("select count(*)::int as n from information_schema.role_table_grants where table_schema='shop' and grantee='PUBLIC'");
    assert.equal(grants.rows[0].n, 0);
  });
});
