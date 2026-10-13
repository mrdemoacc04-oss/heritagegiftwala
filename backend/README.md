# Heritage Gift Wala: backend & owner control panel

[Medusa v2](https://medusajs.com) (pinned to the same version as the storefront's `@medusajs/js-sdk`). One service gives you:

- the **store API** the storefront talks to (products, carts, orders),
- the **admin panel** at `/app`, the owner's control panel for prices, stock, products and orders (see [../docs/OWNER-GUIDE.md](../docs/OWNER-GUIDE.md)),
- a custom **`POST /store/track-order`** route behind the storefront's `/track` page.

## What's in here

| Path | Purpose |
| --- | --- |
| `medusa-config.ts` | Database (Supabase TLS), CORS, optional S3 photo storage, optional Redis |
| `src/scripts/bootstrap.ts` | Runs on each deploy. Creates the owner login, and **once** sets up India/INR, the Patan stock location, delivery options, categories, the 28-product catalog with opening stock, and the storefront API key |
| `src/scripts/data/catalog.ts` | Generated from `storefront/src/data` by `npm run catalog:build` |
| `src/api/store/track-order/route.ts` | Guest order tracking (order number + email) |

After the first setup the bootstrap script never touches products again, so the owner's edits survive redeploys.

## Run locally

Needs Node 20+ and a Postgres database.

```bash
cp .env.example .env      # set DATABASE_URL, DATABASE_SSL=false, local CORS, ADMIN_EMAIL/PASSWORD
npm install
npm run migrate
npm run bootstrap         # prints the region id + publishable key for the storefront
npm run dev               # API on :9000, admin on http://localhost:9000/app
```

Point the storefront at it with `NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000` plus the two printed values (see `../storefront/.env.example`) and add `http://localhost:3456` to `STORE_CORS`.

## Deploy on Render + Supabase

**Already done for this shop:** the Supabase project `bykxrjyonlcqvjsiqfdq` (Tokyo) has had `npm run migrate` and the first-time setup run against it, so it already holds the 28-product catalog, delivery options, stock and the owner login (`heritagegiftwala.website@gmail.com`). When Render deploys, set `ADMIN_EMAIL` to that same address, otherwise the bootstrap creates a second admin login. Everything else in step 2 below still needs to be filled in on Render.


1. **Supabase**: create a project. Copy the **Session pooler** connection string (port 5432). Create a **public** Storage bucket (e.g. `products`) and an S3 access key (Storage → S3 Connection) for admin photo uploads.
2. **Render**: New → **Blueprint** → select this repo (it reads `../render.yaml`). Fill the environment variables listed in `.env.example`.
   - `MEDUSA_BACKEND_URL` / `ADMIN_CORS`: the service's `https://….onrender.com` URL (known after the first create; set them, then redeploy).
   - `STORE_CORS`: the storefront domains, e.g. `https://heritagegiftwala.in,https://www.heritagegiftwala.in` (plus any `*.vercel.app` preview you use).
   - `STOREFRONT_URL`: where the storefront is hosted, since the seeded photos are served from its `/products` folder.
3. When the deploy is live, open the service **Logs**. The bootstrap prints `NEXT_PUBLIC_MEDUSA_REGION_ID` and `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` on every boot. Put both, plus `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, into the storefront's Vercel environment variables and redeploy it.
4. Sign in at `https://<service>.onrender.com/app` and change the owner password.

Notes:
- Render's free tier sleeps and is too small for Medusa. Use a paid plan with 1–2 GB RAM.
- The first deploy's build takes a few minutes (it also builds the admin UI).
- To redo the first-time shop setup from scratch, clear `catalog_seeded` from the store's metadata (or use a fresh database). **That recreates products and will duplicate any that still exist**, so only do it on an empty shop.
