/**
 * Customers order on WhatsApp, so the website's own order endpoints are switched off unless WEB_CHECKOUT=on.
 * Run this against a copy of the site started WITHOUT WEB_CHECKOUT (the api suite needs it on):
 *   BASE_URL=http://localhost:3457 DATABASE_URL=postgres://… npm run test:whatsapp
 */
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3457";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
after(() => db.end());

const post = (path: string, body: unknown) =>
  fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", origin: new URL(BASE).origin, "x-forwarded-for": "10.9.9.9" }, body: JSON.stringify(body) });

describe("website orders are off by default", () => {
  test("the quote and order endpoints answer 410 and say orders are taken on WhatsApp", async () => {
    const [{ id }] = (await db.query("insert into shop.products (handle, title, price, stock) values ($1, 'WhatsApp test', 100, 5) returning id", [`wa-${Math.random().toString(36).slice(2, 8)}`])).rows;
    const items = [{ product_id: id, quantity: 1 }];
    const contact = { email: "a@example.com", phone: "9876543210", name: "A B", address1: "1 Road", address2: "", city: "Patan", state: "Gujarat", pincode: "384265" };
    for (const [path, body] of [["/api/quote", { items, shipping: "standard" }], ["/api/orders", { items, shipping: "standard", contact }]] as const) {
      const res = await post(path, body);
      assert.equal(res.status, 410, path);
      assert.match((await res.json()).message, /WhatsApp/);
    }
    assert.equal((await db.query("select count(*)::int as n from shop.orders where email = 'a@example.com'")).rows[0].n, 0, "no order is made");
    assert.equal((await db.query("select stock from shop.products where id = $1", [id])).rows[0].stock, 5, "stock is untouched");
  });
});
