# Heritage Gift Wala: the shop and its control panel

One Next.js 16 app (App Router, Tailwind v4) on **Vercel**, with **Supabase** (Postgres + Storage) behind it. It holds:

- **The shop** customers use: browse, bag, hamper builder, accounts, order tracking. **Buying is on WhatsApp**: the customer fills in their details and the site opens WhatsApp with the whole order written out. No payment is taken on the website.
- **The owner's control panel** at `admin.heritagegiftwala.in` (see `ADMIN_HOST` below): products, optional prices, stock, photos, shelves, coupons, delivery fees, orders and courier tracking.

There is no separate backend: the pages and the admin talk to Supabase's Postgres directly from the server.

```bash
npm install
npm run dev          # http://localhost:3456
npm run build        # production build
```

With no `DATABASE_URL` the shop runs in **preview mode** on the built-in catalog in `src/data/` (28 products). Everything works except real orders, accounts and the admin panel.

## Going live

Follow [../docs/DEPLOY.md](../docs/DEPLOY.md). The owner's day-to-day guide is [../docs/OWNER-GUIDE.md](../docs/OWNER-GUIDE.md).

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Supabase "Transaction pooler" connection string (port 6543) |
| `APP_SECRET` | 32+ random characters; hashes visitor IPs for rate limiting |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | For product photo uploads. **Server-only secret.** |
| `NEXT_PUBLIC_SITE_URL` | The shop's public address |
| `ADMIN_HOST` | The control panel's own address, e.g. `admin.heritagegiftwala.in` (no `https://`). Once set, `/admin` exists only there; the shop address redirects to it. Needs a redeploy. Unset = the panel is at `/admin` on the shop's address (local work) |
| `WEB_CHECKOUT` | Leave unset. `on` re-enables the website's own cash-on-delivery order endpoints (`/api/quote`, `/api/orders`); the shop pages no longer call them |
| `RESEND_API_KEY`, `MAIL_FROM` | Optional: password-reset links and security alerts for the owner. (`ORDER_ALERT_EMAIL` only matters for website orders, which are off.) |

## How it is put together

| Path | What |
| --- | --- |
| `db/migrations/` | The database schema (private `shop` schema, row level security on, nothing public). Orders, stock and coupons are enforced by SQL functions, so the browser can never set a price. |
| `db/tests/` | `npm run test:db` (rules) and `npm run test:api` (a running site, including attacks) |
| `scripts/` | `db:migrate`, `db:seed`, `admin:create` (run from your own computer) |
| `src/app/(shop)/` | Customer pages |
| `src/app/(admin)/admin/` | Owner pages and their server actions |
| `src/app/api/` | Quote, order, tracking, account and photo-upload endpoints |
| `src/lib/server/` | Database, sessions, passwords, rate limiting, validation (server-only) |
| `src/proxy.ts` | Sends visitors without an admin cookie to the login page and sets no-store headers |

### Security model in one page

- **The database is closed.** Tables live in a `shop` schema Supabase doesn't expose, with row level security on and no policies. Only this app's server login can read or write.
- **The browser only says what and how many.** `shop.price_cart` and `shop.place_order` (SQL) read prices, stock, delivery fees and coupon rules themselves and lock product rows, so two buyers can't take the last item and a price can't be edited in the page.
- **Owner login:** scrypt-hashed passwords, random server-side session tokens (only their SHA-256 is stored), `HttpOnly` + `SameSite=Strict` + `__Host-` cookie, 12 h session with 4 h idle timeout, per-visitor rate limits, and the same message for "no such user" and "wrong password". Every admin page and action checks the session itself.
- **Customer accounts** use the same session machinery. Every address and order query is filtered by the signed-in customer's id.
- **Public endpoints** require a matching `Origin` and JSON, validate input with zod, rate-limit by hashed IP, and return generic errors.
- **Uploads** are admin-only, ≤ 4 MB, and judged by their real bytes (PNG/JPEG/WebP), then stored under a random name.
- **Headers:** `X-Frame-Options: DENY`, `nosniff`, HSTS, a CSP for framing/forms/base, no `X-Powered-By`; `/admin` and `/api` are `no-store` and `noindex`.

### Product tiles

Each product has an image mode. *Cut-out on a coloured tile* (`contain`) suits transparent PNGs like the seeded photos; *Fill the tile* (`cover`) suits ordinary photos, so an owner's phone snap still looks tidy.
