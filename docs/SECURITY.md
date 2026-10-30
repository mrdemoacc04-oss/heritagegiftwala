# Security: what protects the shop, and what to keep doing

This is the plain-language version. The code is in `storefront/src/lib/server/` and `storefront/db/`.

## Nobody can change a price, a stock count or a discount from the website

The browser sends only *which* products and *how many*. The database itself (functions `shop.price_cart` and `shop.place_order`) then:

- reads the real price of every item, so a price sent from the page is ignored;
- works out delivery from the owner's current fees, and judges "free delivery" on what the customer actually pays **after** any coupon, so a big coupon can't unlock free delivery as well;
- checks the coupon: it must exist, be switched on, not expired, not used up, and the order must meet its minimum. Every failure gives the same message, so codes can't be guessed one by one (and guesses are rate-limited);
- by default a coupon works **once per customer**: the same mailbox (ignoring dots and `+tags`), phone number, delivery address (however it is typed) or signed-in account can't use it twice. The owner can untick this for a coupon meant to be reused;
- locks the products while the order is saved, so two people can't both buy the last item, and two people can't both use a coupon's last remaining use;
- refuses odd quantities (zero, negative, fractions, more than 20 of one line) and products that are drafts;
- limits one web order to 30 items and ₹50,000, and to no more of any product than half its stock (never fewer than 3), so a single anonymous order can't empty the shelves. The owner's own "Take an order" screen is exempt;
- allows each person (same email, phone number or delivery address) at most 3 unfinished orders at a time. Orders that share any of those go through one at a time, so parallel requests can't slip past. An address written in Gujarati, Hindi or just "12" carries too little Latin text to identify a household, so it is never matched (different households in one PIN code can't block each other);
- treats a retried order (a lost reply, a double tap) as the same order, and refuses an order if the price has moved since the customer last saw it, showing the new total instead of charging it;
- never makes a price quote wait for, or hold up, a real order, and gives up on a locked product after 5 seconds instead of hanging;
- gives the coupon use back when an order is cancelled, and takes stock and coupon in a fixed order so cancelling can't deadlock with a new order.

Tests for each of these try to cheat and fail (`npm run test:db`, `npm run test:api`).

## Only the owner can sign in, or no one

1. **Allow-list.** `ADMIN_ALLOWED_EMAILS` on Vercel lists the emails that may ever sign in. In production an empty list means nobody can. Even a valid row in the database is refused if the email isn't listed.
2. **Strong password rules.** At least 12 characters, not the shop's name, not your email, no `1234`/`abcd` runs, and not found in known data breaches (checked with the Pwned Passwords service; only the first 5 characters of a hash leave the server).
3. **Temporary passwords must be changed, and expire.** A login created with `--temporary` stops working after 48 hours, and until it is changed it can reach only the "choose your password" page: it cannot set up two-step sign-in or do anything else.
4. **Two-step sign-in** (authenticator app): compulsory in production. Setting it up, turning it off and making new recovery codes all ask for the password again (turning it off and new codes also need a current code), because new recovery codes would otherwise be a way around the second step. The 6-digit code works once and only inside its 30-second window (± one step for clock drift). Recovery codes (10, one use each, stored only as keyed hashes) cover a lost phone. The app's secret is stored encrypted with a key derived from `APP_SECRET`.
5. **Forgot password.** An emailed link that works once, expires in 30 minutes, is stored only as a hash, and signs the owner out everywhere when used. There is deliberately no per-email request cap (a stranger could use it up and shut the owner out): a request made while a link under 10 minutes old is already in the inbox sends nothing new, so the owner always has a valid link and the mailbox can't be flooded (at most 6 mails an hour). A successful reset also clears the account's sign-in counters. Changing the password, turning two-step on or off, making new recovery codes or "Sign out everywhere" also cancels any link still sitting in a mailbox. The form gives the same answer for any email, so it can't be used to find out who the owner is. A reset password still needs the two-step code.
6. **Sessions.** Random tokens kept server-side (only a hash is stored); a new token at every sign-in; 12 hours at most and 4 hours idle; `HttpOnly`, `Secure`, `SameSite=Strict`, `__Host-` cookie. "Sign out everywhere" is on the *My login* page. Changing the password or two-step settings signs out all other devices.
7. **Guessing is throttled, and counted before it is checked.** Every attempt is counted the instant it arrives (so a burst of parallel guesses can't all slip through), and given back only if the sign-in turns out to be genuine. Limits: 6 per visitor and email per 15 minutes, 12 per visitor, and 60 an hour per account from anywhere (the owner's own known browser isn't held to that last ceiling, so a stranger who knows the owner's email can't lock the owner out of their own computer). A visitor on IPv6 counts as their whole /64, so rotating addresses doesn't reset it. Each "enter your code" step allows 5 tries per sign-in, 10 per visitor and 15 an hour per account. Wrong password, unknown email and a non-allowed email all look identical and take the same time.
8. **A new browser is announced.** After a full sign-in the browser gets a signed "known device" cookie (90 days, only valid for that account). A sign-in from a browser without it emails the owner ("New sign-in to your shop control panel"), so a login from somewhere unexpected is noticed even when the password and code were right.
9. **Everything is recorded.** *My login* has three lists: "Changes to this login" (password, two-step, recovery codes, resets), "Sign-ins", and "Blocked and failed attempts". Failed guesses can't bury a real change or a sign-in, noise aimed at made-up emails is logged once an hour rather than per request, and the table is kept to its latest 5,000 rows. If email is on, the owner is emailed when a recovery code is used, the password changes or is reset, and when someone keeps guessing.
10. **Every admin page and action checks the session itself.** It does not rely on the page layout or on the proxy, so a revoked or expired session gets no data, even from a client-side navigation request.

## The database and the rest

- The connection from the website to Supabase is encrypted **and verified**: the app carries Supabase's public root certificate, so nobody sitting between Vercel and Supabase can impersonate the database. (Its SHA-256 fingerprint is in `src/lib/server/pg-config.ts`; compare it with the one in Supabase → Database → SSL Configuration.)
- Tables live in a private `shop` schema Supabase doesn't expose, with row level security on and no access for the public `anon` / `authenticated` roles. Only the server's own database login can read or write.
- SQL functions pin their `search_path`.
- Photo upload is owner-only, ≤ 4 MB, accepts only genuine PNG/JPEG/WebP (judged by file contents), and stores under a random name.
- Public endpoints require a matching `Origin` and JSON, validate every field, rate-limit by hashed visitor address, and answer with generic errors.
- Text typed by customers or the owner is never run as code: it is escaped everywhere, including in the product page's search-engine data and in emails. Tracking links must be `http(s)`.
- Guessing at order tracking is counted before it is checked: 15 wrong guesses an hour per email, from anywhere.
- Placing or cancelling an order runs with the database's own limits (5 seconds to get a lock, 15 seconds in total), so a stuck order can't hold products locked.
- Security headers on every page: no framing, no MIME sniffing, HSTS, a CSP for framing/forms/base; `/admin` and `/api` are never cached or indexed.

## Dependencies

`npm audit` for what runs in production reports **0 vulnerabilities**. Five advisories show up only in `eslint-config-next`'s development-time tooling (a `braces` pattern-matching issue); that code never runs on Vercel or on a visitor's machine. Run `npm outdated` now and then and update.

## What you must keep doing

- Set `ADMIN_ALLOWED_EMAILS` and keep two-step sign-in on. Save the recovery codes somewhere safe (not only on the computer you sign in from).
- Add `RESEND_API_KEY` and `MAIL_FROM` (a domain verified in Resend) so the forgot-password link and the alerts work.
- Never put `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` or `APP_SECRET` anywhere except Vercel's environment variables. If one is ever pasted somewhere public, replace it. Changing `APP_SECRET` means the owner must turn two-step off with `npm run admin:create -- you@email --reset-2fa` and set it up again.
- Turn on two-step sign-in for your Supabase, Vercel, GitHub and Resend accounts.
- Supabase's free plan has no backups. Use a paid plan or export the data.

## The website no longer takes orders itself

Customers buy on WhatsApp, so the website's own order endpoints (`/api/quote`, `/api/orders`) answer "410: orders are taken on WhatsApp" and do nothing, unless `WEB_CHECKOUT=on` is set on Vercel. The WhatsApp button only opens the customer's own WhatsApp with a written message: nothing is sent to the website, so there is nothing to spam. The protections above still apply to orders the owner takes in the control panel, and to the endpoints if they are ever switched back on.

## The control panel has its own address

With `ADMIN_HOST=admin.heritagegiftwala.in` the panel exists only there: the shop's address redirects `/admin` to it, and the panel's address answers 404 to every shop page. A second lock sits in the code: a sign-in, a session, a reset link or an upload is refused on any other address, even if a request got past the routing rules. The sign-in cookie is tied to the panel's address (`__Host-`), so it is never even sent to the shop.

## If website orders are ever switched back on

Cash on delivery needs no payment, so a script could try to place junk orders. The limits above (caps, open orders per person, per-visitor and per-email limits) already make that hard. The server still knows how to check a Cloudflare Turnstile bot check (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`), but the order page no longer shows the widget, so **do not set those keys** until a website order form with the widget is built again: with the keys set and no widget, every order would be refused.

## Known limits (honest list)

- Customer accounts have no email verification and no password reset yet, so someone could register an account with another person's email address (it only blocks that person from registering; their orders are tied to the account that placed them).
- The page security policy (CSP) doesn't restrict scripts, because Next.js inlines its own. Escaping is what keeps text from running.
- Rate limits rely on the visitor address Vercel provides, and are per address. A large botnet could still slow the site down; Vercel's own protection is the answer to that.
- The order-tracking page can be queried with an order number and an email; both must match and wrong guesses are limited per visitor and per email (15 an hour), but order numbers are sequential.
- Cash-on-delivery orders are not verified: someone can place an order with a made-up address, or use another person's email to use up that person's one-use coupon (cancelling the order frees it). The caps and limits above keep this small; the owner should confirm unusual orders by phone or WhatsApp before packing them.
- An attacker who already knows the owner's password can use up the owner's two-step allowance (15 wrong codes an hour) and delay a legitimate sign-in; they still cannot get in.

## If something looks wrong

1. *My login → Sign out everywhere*, then change the password.
2. Reset from your computer: `npm run admin:create -- you@email.com` (add `--reset-2fa` if the phone is lost).
3. In Supabase, reset the database password and update `DATABASE_URL` on Vercel.
