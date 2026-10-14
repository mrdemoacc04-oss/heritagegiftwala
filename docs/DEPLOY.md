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
npm run admin:create -- owner@yourmail.com --temporary   # a temporary password the owner must change at first sign-in
```

All three are safe to run again. `db:seed` only adds what is missing and never overwrites edits. Delete `.env.local` afterwards if you like; it is not committed.

`admin:create` asks for the password at a hidden prompt. Use `--temporary` when you are choosing the password for someone else: at first sign-in they are made to pick their own (and, in production, to set up two-step sign-in) before the panel unlocks.

## 3. Vercel (the website)

The repo is already connected with **Root Directory = `storefront`**. Add these under **Settings → Environment Variables** (Production), then redeploy:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the **Transaction pooler** string (port 6543) |
| `APP_SECRET` | a long random string. In Terminal: `openssl rand -hex 32` |
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
| `NEXT_PUBLIC_SITE_URL` | `https://www.heritagegiftwala.in` (exactly how the site is addressed) |
| `ADMIN_ALLOWED_EMAILS` | the owner's email (comma-separated if more than one). **Required:** with it empty, no one can sign in to `/admin` |
| `RESEND_API_KEY`, `MAIL_FROM` | for the forgot-password link and security alerts. `MAIL_FROM` must be on a domain verified in Resend (or leave it to use Resend's test sender, which only delivers to your own Resend account email) |
| `ORDER_ALERT_EMAIL` | optional: an email when an order arrives |
| `ADMIN_REQUIRE_2FA` | leave unset: two-step sign-in is compulsory in production. Only the exact value `false` switches it off |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional: a free Cloudflare Turnstile bot check on the order form (both or neither) |

`vercel.json` pins the site's functions to Tokyo (`hnd1`) to sit next to a Tokyo database. If your Supabase project is elsewhere, change the region in `vercel.json` to match (`bom1` is Mumbai).

## 4. First sign-in

Open `https://www.heritagegiftwala.in/admin` and sign in with the email and temporary password. You will be asked to:

1. choose your own password (12+ characters, not the shop's name),
2. set up two-step sign-in: scan the QR code with Google Authenticator, Microsoft Authenticator, Authy or 1Password, type the 6-digit code, and **save the 10 recovery codes** somewhere safe.

After that, signing in is: email + password, then the code from the app. See [SECURITY.md](SECURITY.md) for everything that protects the panel.

**`APP_SECRET` must be the same everywhere that uses this database.** It encrypts the owner's two-step secret, so if you ever run the site on your own computer against the live database, put the same `APP_SECRET` in `storefront/.env.local` as on Vercel. Otherwise a two-step set-up made on one side can't be read on the other and the owner is locked out (fixable with `npm run admin:create -- you@email.com --reset-2fa`). The simplest rule: do the first sign-in and the two-step set-up on the live site.

The database connection to Supabase is encrypted and checked against Supabase's own certificate, which the app already carries; there is nothing to configure.

## Keeping it safe

- Never put `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` anywhere but Vercel's environment variables.
- Turn on two-factor sign-in for your Supabase, Vercel and GitHub accounts.
- Supabase's free plan has no automatic backups. For a live shop, use a paid plan (daily backups) or export the data regularly.
- A forgotten owner password: use **Forgot your password?** on the sign-in page (needs `RESEND_API_KEY`), or run `npm run admin:create -- owner@yourmail.com --temporary` from your computer. Add `--reset-2fa` if the phone and the recovery codes are both lost. Either way every device is signed out.
- The `x-forwarded-for` address used for rate limiting is trustworthy on Vercel. If you ever host elsewhere, put a proxy in front that overwrites it.
