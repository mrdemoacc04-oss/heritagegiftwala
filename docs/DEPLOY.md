# Putting the shop live: Supabase + Vercel

Everything runs on two services. No server of your own.

## 1. Supabase (database and photos)

1. Create a project at supabase.com. Choose a region near your customers (Mumbai, `ap-south-1`, is ideal for Patan) and keep the database password somewhere safe.
2. **Connect** (top of the project) shows connection strings. You need two:
   - **Transaction pooler** (port **6543**): this is the app's `DATABASE_URL` on Vercel.
   - **Session pooler** (port **5432**): used once from your computer to set the database up.
   Replace `[YOUR-PASSWORD]` in each. If the password contains `@`, `#` or `/`, write them as `%40`, `%23`, `%2F`.
3. **Project Settings → API**: copy the **Project URL** and the **service_role** key. The service_role key can do anything, so treat it like a password and only ever put it in Vercel's environment variables.
4. In **Project Settings → API → Exposed schemas**, make sure `shop` is **not** in the list (the default is `public` only). That keeps the shop's tables off Supabase's public REST API.

## 2. Set the database up (once, from your computer)

In `storefront/`, create `.env.local` with the **Session pooler** string:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Then:

```bash
npm install
npm run db:migrate                          # creates the tables, rules and the photo bucket
npm run db:seed                             # loads the 28 starter products (10 in stock each)
npm run admin:create -- owner@yourmail.com  # asks for the owner's password (12+ characters)
```

All three are safe to run again. `db:seed` only adds what is missing and never overwrites edits. Delete `.env.local` afterwards if you like; it is not committed.

## 3. Vercel (the website)

The repo is already connected with **Root Directory = `storefront`**. Add these under **Settings → Environment Variables** (Production), then redeploy:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the **Transaction pooler** string (port 6543) |
| `APP_SECRET` | a long random string. In Terminal: `openssl rand -hex 32` |
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
| `NEXT_PUBLIC_SITE_URL` | `https://www.heritagegiftwala.in` (exactly how the site is addressed) |
| `RESEND_API_KEY`, `ORDER_ALERT_EMAIL`, `MAIL_FROM` | optional, for an email when an order arrives |

`vercel.json` pins the site's functions to Tokyo (`hnd1`) to sit next to a Tokyo database. If your Supabase project is elsewhere, change the region in `vercel.json` to match (`bom1` is Mumbai).

## 4. First sign-in

Open `https://www.heritagegiftwala.in/admin`, sign in with the email and password from `admin:create`, and use **My login** to change the password.

## Keeping it safe

- Never put `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` anywhere but Vercel's environment variables.
- Turn on two-factor sign-in for your Supabase, Vercel and GitHub accounts.
- Supabase's free plan has no automatic backups. For a live shop, use a paid plan (daily backups) or export the data regularly.
- A forgotten owner password is reset by running `npm run admin:create -- owner@yourmail.com` again from your computer. It also signs that owner out everywhere.
- The `x-forwarded-for` address used for rate limiting is trustworthy on Vercel. If you ever host elsewhere, put a proxy in front that overwrites it.
