/**
 * Database tasks, run from your own computer against the DATABASE_URL in .env.local:
 *   npm run db:migrate   apply every file in db/migrations (safe to repeat; add a name to apply only the files that start with it: db:migrate -- 0001)
 *   npm run db:seed      load the starter catalog (only adds what is missing, never overwrites edits)
 *   npm run db:step -- <name>   run ONE one-time data step from db/steps (each records itself and never runs twice)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { cleanDatabaseUrl, pgSsl } from "../src/lib/server/pg-config.ts";
import { products } from "../src/data/products.ts";
import { categories } from "../src/data/categories.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const file of [".env.local", ".env"]) {
  const p = path.join(here, "..", file);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (put it in storefront/.env.local).");
const client = new pg.Client({ connectionString: cleanDatabaseUrl(url), ssl: pgSsl(url) });
await client.connect();

const task = process.argv[2];

if (task === "migrate") {
  const dir = path.join(here, "../db/migrations");
  const only = process.argv[3];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql") && (!only || f.startsWith(only))).sort()) {
    process.stdout.write(`applying ${file} … `);
    await client.query(fs.readFileSync(path.join(dir, file), "utf8"));
    console.log("done");
  }
} else if (task === "step") {
  const name = (process.argv[3] ?? "").replace(/\.sql$/, "");
  const file = path.join(here, "../db/steps", `${name}.sql`);
  if (!/^[\w-]+$/.test(name) || !fs.existsSync(file)) throw new Error(`Usage: db:step -- <name>. Available: ${fs.readdirSync(path.join(here, "../db/steps")).map((f) => f.replace(/\.sql$/, "")).join(", ")}`);
  process.stdout.write(`running ${name} … `);
  await client.query(fs.readFileSync(file, "utf8"));
  console.log("done");
} else if (task === "seed") {
  const stock = Number(process.argv[3] ?? 10);
  const publicDir = path.join(here, "../public");
  const has = (src?: string) => (src && fs.existsSync(path.join(publicDir, src)) ? src : "");
  let added = 0;
  await client.query("begin");
  for (const [i, c] of categories.entries()) {
    await client.query(
      `insert into shop.categories (handle, title, blurb, cover, tint, sort) values ($1,$2,$3,$4,$5,$6) on conflict (handle) do nothing`,
      [c.handle, c.title, c.blurb, c.cover, c.tint, i],
    );
  }
  for (const p of products) {
    const res = await client.query(
      `insert into shop.products (handle, title, subtitle, description, price, categories, recipients, occasions, details,
                                  tint, badge, rank, is_new, hidden, track_stock, stock, image, studio, shelf, image_fit)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'contain')
       on conflict (handle) do nothing`,
      [
        // Prices are left empty: the owner enters real ones in the control panel; until then customers ask on WhatsApp.
        p.handle, p.title, p.subtitle, p.description, null, p.categories, p.recipients, p.occasions, p.details,
        p.tint, p.badge ?? "", p.rank, Boolean(p.isNew), Boolean(p.hidden), !p.hidden, p.hidden ? 0 : stock,
        has(p.image), has(p.studio), has(p.shelf),
      ],
    );
    added += res.rowCount ?? 0;
  }
  await client.query("commit");
  console.log(`seeded ${added} new products (${products.length - added} already there)`);
} else {
  throw new Error("Usage: db.mts migrate [prefix] | seed [stock] | step <name>");
}
await client.end();
