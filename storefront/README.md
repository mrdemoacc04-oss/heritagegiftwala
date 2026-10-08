# Heritage Gift Wala — storefront

The customer-facing shop for **heritagegiftwala.in**. Next.js 16 (App Router) + Tailwind v4 + Motion, built to run on **Vercel** against a **Medusa v2** backend (hosted on **Render**, Postgres on **Supabase**).

```bash
npm install
npm run dev          # http://localhost:3456
npm run build        # production build
```

## Preview mode vs live mode

With no Medusa env vars set, the store runs on the built-in catalog in `src/data/` (28 products photographed in the shop). Everything works: bag, wishlist, gift wrap, hamper builder, checkout. Checkout shows a "store preview" note and orders go nowhere.

Set these (see `.env.example`) and the same UI reads products, categories, prices, stock, shipping options and payment providers from Medusa, and places real orders:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | Your Render service URL |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Medusa admin → Settings → Publishable API keys |
| `NEXT_PUBLIC_MEDUSA_REGION_ID` | Medusa admin → Settings → Regions → India (INR) |
| `NEXT_PUBLIC_SITE_URL` | `https://heritagegiftwala.in` |

On the Medusa side, add the Vercel domain to `STORE_CORS`.

## Mapping the catalog into Medusa

The storefront reads shop-specific bits from **product metadata**, so the owner can edit them in Medusa admin:

| Metadata key | Example | Used for |
| --- | --- | --- |
| `tint` | `#E6DEFF` | Background colour of the product tile |
| `badge` | `Bestseller` | Sticker on the card |
| `recipients` | `her,colleague` | Gift Finder, "For her" filters (`her, him, kids, parents, colleague, home`) |
| `occasions` | `birthday,thank-you` | Gift Finder (`birthday, anniversary, festive, housewarming, thank-you, just-because`) |
| `details` | `Insulated steel,Hand wash` | "The details" list |
| `rank` | `1` | Featured order |
| `hidden` | `true` | Keep out of listings (used by the gift-wrap product) |

Images: **thumbnail** = transparent cutout PNG (`public/products/*.png`), **image 2** = studio shot, **image 3** = the shelf photo.
Categories use the handles in `src/data/categories.ts`; category metadata `tint` and `cover` (a product handle) style the sticker wall.
Gift wrap is a product with handle `gift-wrap`; wrap paper, ribbon and note travel as line-item metadata.

## Things to fill in

`src/lib/site.ts` holds every store setting. The address, phone, map embed and Google rating come from the shop's Google Maps listing (Patan). Still to fill in: WhatsApp number and email (their buttons stay hidden until set), delivery fees, free-delivery threshold, gift-wrap price and dispatch time.
Prices in `src/data/products.ts` are placeholders, except the two brass lamps (₹600 and ₹500, read off the shop's price stickers).

## Product photos

Every product photo was cut from the client's shop photos, redrawn as a studio shot with gpt-image (using the real photo as reference), then background-removed. The scripts live in `../design/pipeline/`.
