-- Heritage Gift Wala: shop schema.
--
-- Everything lives in the private `shop` schema. Supabase only exposes the `public` schema through its
-- REST API, so none of this is reachable with the public anon key. Row level security is switched on for
-- every table as a second lock, with no policies: anything that is not the server's own database login
-- gets nothing. The Next.js server is the only thing that talks to these tables.

create schema if not exists shop;

-- ── Catalog ────────────────────────────────────────────────────────────────

create table if not exists shop.categories (
  handle     text primary key check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(handle) <= 60),
  title      text not null check (char_length(title) between 1 and 80),
  blurb      text not null default '' check (char_length(blurb) <= 200),
  cover      text not null default '' check (char_length(cover) <= 80),
  tint       text not null default '#F4E9D8' check (tint ~ '^#[0-9A-Fa-f]{6}$'),
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists shop.products (
  id          uuid primary key default gen_random_uuid(),
  handle      text not null unique check (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(handle) <= 80),
  title       text not null check (char_length(title) between 1 and 120),
  subtitle    text not null default '' check (char_length(subtitle) <= 160),
  description text not null default '' check (char_length(description) <= 4000),
  price       int  check (price is null or price between 0 and 1000000),   -- null = no price shown, the shop quotes it on WhatsApp
  compare_at  int  check (compare_at is null or compare_at between 0 and 1000000),
  categories  text[] not null default '{}',
  recipients  text[] not null default '{}',
  occasions   text[] not null default '{}',
  details     text[] not null default '{}',
  tint        text not null default '#F4E9D8' check (tint ~ '^#[0-9A-Fa-f]{6}$'),
  badge       text not null default '' check (char_length(badge) <= 24),
  rank        int  not null default 100,
  is_new      boolean not null default false,
  hidden      boolean not null default false,           -- kept out of listings
  status      text not null default 'active' check (status in ('active', 'draft')),
  track_stock boolean not null default true,
  stock       int  not null default 0 check (stock >= 0),
  image       text not null default '' check (char_length(image) <= 500),
  studio      text not null default '' check (char_length(studio) <= 500),
  shelf       text not null default '' check (char_length(shelf) <= 500),
  image_fit   text not null default 'cover' check (image_fit in ('contain', 'cover')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists products_status_rank on shop.products (status, rank);

-- A price is optional: a product without one shows no price on the shop and is bought by messaging the shop on WhatsApp.
-- (Databases created before this change still have the old "not null"; this relaxes it.)
alter table shop.products alter column price drop not null;
-- A price can be kept on file and hidden from the shop with this switch (on by default). The crossed-out MRP is the column `compare_at`.
alter table shop.products add column if not exists show_price boolean not null default true;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_compare_needs_price' and conrelid = 'shop.products'::regclass) then
    alter table shop.products add constraint products_compare_needs_price check (compare_at is null or price is not null);
  end if;
end $$;

create table if not exists shop.settings (
  id                int primary key default 1 check (id = 1),
  shipping_flat     int not null default 79  check (shipping_flat between 0 and 100000),
  shipping_express  int not null default 149 check (shipping_express between 0 and 100000),
  free_shipping_from int not null default 999 check (free_shipping_from between 0 and 1000000),
  updated_at        timestamptz not null default now()
);
insert into shop.settings (id) values (1) on conflict do nothing;

-- Shop-wide switch for showing prices at all, and the sale popup the owner can edit and switch on or off.
alter table shop.settings add column if not exists show_prices boolean not null default true;
alter table shop.settings add column if not exists popup_enabled boolean not null default false;
alter table shop.settings add column if not exists popup_label text not null default '' check (char_length(popup_label) <= 30);
alter table shop.settings add column if not exists popup_title text not null default '' check (char_length(popup_title) <= 80);
alter table shop.settings add column if not exists popup_text text not null default '' check (char_length(popup_text) <= 300);
alter table shop.settings add column if not exists popup_button_text text not null default '' check (char_length(popup_button_text) <= 30);
alter table shop.settings add column if not exists popup_button_url text not null default '';
-- Where the button goes: nothing, the word "whatsapp", a page on the shop ("/shop"), or an https address. Never javascript:, //other-site or
-- a backslash (browsers read "/\evil.example" as "//evil.example"). Dropped and re-added each time so a tightened rule reaches databases that already have the old one.
alter table shop.settings drop constraint if exists settings_popup_button_url_check;
alter table shop.settings add constraint settings_popup_button_url_check
  check (char_length(popup_button_url) <= 300 and (popup_button_url = '' or popup_button_url = 'whatsapp' or popup_button_url ~ '^/([^/[:space:]\\][^[:space:]\\]*)?$' or popup_button_url ~* '^https://[^[:space:]\\]+$'));
alter table shop.settings add column if not exists popup_image text not null default '' check (char_length(popup_image) <= 500);
alter table shop.settings add column if not exists popup_tint text not null default '#FFD6DE' check (popup_tint ~ '^#[0-9A-Fa-f]{6}$');
alter table shop.settings add column if not exists popup_delay int not null default 4 check (popup_delay between 0 and 60);
alter table shop.settings add column if not exists popup_reshow_days int not null default 1 check (popup_reshow_days between 1 and 30);
alter table shop.settings add column if not exists popup_ends_on date;
-- Changes every time the popup is saved, so visitors who closed an older version see the new one.
alter table shop.settings add column if not exists popup_updated_at timestamptz not null default now();

create table if not exists shop.coupons (
  code         text primary key check (code ~ '^[A-Z0-9_-]{3,24}$'),
  kind         text not null check (kind in ('percent', 'fixed')),
  value        int  not null check (value > 0 and value <= 1000000),
  min_subtotal int  not null default 0 check (min_subtotal >= 0),
  max_uses     int  check (max_uses is null or max_uses > 0),
  used         int  not null default 0 check (used >= 0),
  expires_at   timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);

-- ── People ─────────────────────────────────────────────────────────────────

create table if not exists shop.admins (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email) and char_length(email) <= 254),
  password_hash text not null,
  disabled      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists shop.customers (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email) and char_length(email) <= 254),
  first_name    text not null default '' check (char_length(first_name) <= 60),
  last_name     text not null default '' check (char_length(last_name) <= 60),
  phone         text not null default '' check (char_length(phone) <= 20),
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists shop.customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references shop.customers (id) on delete cascade,
  first_name  text not null default '' check (char_length(first_name) <= 60),
  last_name   text not null default '' check (char_length(last_name) <= 60),
  phone       text not null default '' check (char_length(phone) <= 20),
  address_1   text not null check (char_length(address_1) between 1 and 200),
  address_2   text not null default '' check (char_length(address_2) <= 200),
  city        text not null check (char_length(city) between 1 and 80),
  province    text not null default '' check (char_length(province) <= 80),
  postal_code text not null check (postal_code ~ '^[0-9]{6}$'),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists customer_addresses_customer on shop.customer_addresses (customer_id);

-- Sessions: the browser holds a random token, the database holds only its SHA-256, so a leaked
-- database cannot be replayed as logins.
create table if not exists shop.admin_sessions (
  token_hash text primary key,
  admin_id   uuid not null references shop.admins (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists admin_sessions_admin on shop.admin_sessions (admin_id);

create table if not exists shop.customer_sessions (
  token_hash  text primary key,
  customer_id uuid not null references shop.customers (id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists customer_sessions_customer on shop.customer_sessions (customer_id);

-- ── Orders ─────────────────────────────────────────────────────────────────

create table if not exists shop.orders (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity (start with 1001) unique,
  customer_id    uuid references shop.customers (id) on delete set null,
  source         text not null default 'web' check (source in ('web', 'admin')),
  email          text not null check (email = lower(email) and char_length(email) <= 254),
  phone          text not null check (char_length(phone) <= 20),
  name           text not null check (char_length(name) between 1 and 120),
  address1       text not null check (char_length(address1) between 1 and 200),
  address2       text not null default '' check (char_length(address2) <= 200),
  city           text not null check (char_length(city) between 1 and 80),
  state          text not null default '' check (char_length(state) <= 80),
  pincode        text not null check (pincode ~ '^[0-9]{6}$'),
  shipping_method text not null check (shipping_method in ('standard', 'express')),
  shipping_fee   int not null check (shipping_fee >= 0),
  subtotal       int not null check (subtotal >= 0),
  discount       int not null default 0 check (discount >= 0),
  total          int not null check (total >= 0),
  coupon_code    text,
  payment_method text not null default 'cod' check (payment_method in ('cod')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded')),
  status         text not null default 'placed' check (status in ('placed', 'packed', 'shipped', 'delivered', 'cancelled')),
  courier        text not null default '' check (char_length(courier) <= 80),
  tracking_number text not null default '' check (char_length(tracking_number) <= 80),
  tracking_url   text not null default '' check (char_length(tracking_url) <= 500 and (tracking_url = '' or tracking_url ~* '^https?://')),
  admin_note     text not null default '' check (char_length(admin_note) <= 1000),
  restocked      boolean not null default false,
  placed_at      timestamptz not null default now(),
  packed_at      timestamptz,
  shipped_at     timestamptz,
  delivered_at   timestamptz,
  cancelled_at   timestamptz
);
create index if not exists orders_email on shop.orders (email);
create index if not exists orders_status_placed on shop.orders (status, placed_at desc);
create index if not exists orders_customer on shop.orders (customer_id, placed_at desc);

create table if not exists shop.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references shop.orders (id) on delete cascade,
  product_id uuid references shop.products (id) on delete set null,
  title      text not null,
  unit_price int  not null check (unit_price >= 0),
  quantity   int  not null check (quantity between 1 and 50),
  image      text not null default '',
  tint       text not null default '#F4E9D8',
  wrap       jsonb                                      -- no longer used: the gift-wrap service was removed
);
create index if not exists order_items_order on shop.order_items (order_id);

-- ── Admin hardening: temporary passwords, two-step sign-in, reset links, audit trail ───────────

alter table shop.admins add column if not exists must_change_password boolean not null default false;
alter table shop.admins add column if not exists temp_password_expires_at timestamptz;
alter table shop.admins add column if not exists password_changed_at  timestamptz;
-- Two-step sign-in (authenticator app). Secrets are stored encrypted by the app, never in plain text.
alter table shop.admins add column if not exists totp_enabled   boolean not null default false;
alter table shop.admins add column if not exists totp_secret    text;
alter table shop.admins add column if not exists totp_pending   text;
alter table shop.admins add column if not exists totp_last_step bigint not null default 0;
-- Keyed hashes of the one-time recovery codes.
alter table shop.admins add column if not exists recovery_hashes text[] not null default '{}';

-- Password reset links. Only the SHA-256 of the token is stored. A link works once and expires.
create table if not exists shop.password_resets (
  token_hash text primary key,
  admin_id   uuid not null references shop.admins (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index if not exists password_resets_admin on shop.password_resets (admin_id);

-- What happened, and when.
create table if not exists shop.admin_audit (
  id         bigint generated always as identity primary key,
  admin_id   uuid references shop.admins (id) on delete set null,
  email      text not null default '',
  event      text not null check (char_length(event) <= 60),
  detail     text not null default '' check (char_length(detail) <= 300),
  ip_hash    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_recent on shop.admin_audit (created_at desc);

alter table shop.coupons add column if not exists once_per_email boolean not null default true;

-- Orders: who bought (normalised), where to, and a client-chosen key that makes a retried submit harmless.
alter table shop.orders add column if not exists email_norm  text not null default '';
alter table shop.orders add column if not exists address_key text not null default '';
alter table shop.orders add column if not exists idem_key    uuid;
create unique index if not exists orders_idem on shop.orders (idem_key) where idem_key is not null;
create index if not exists orders_coupon_person on shop.orders (coupon_code, email_norm) where coupon_code is not null;
create index if not exists orders_open_email on shop.orders (email_norm) where status in ('placed', 'packed');
create index if not exists orders_open_phone on shop.orders (phone) where status in ('placed', 'packed');

-- ── Abuse protection ───────────────────────────────────────────────────────

create table if not exists shop.rate_limits (
  key      text primary key,
  count    int not null,
  reset_at timestamptz not null
);
create index if not exists rate_limits_reset on shop.rate_limits (reset_at);

-- True while the caller is within `p_max` hits per `p_window_seconds`.
create or replace function shop.rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  c int;
begin
  insert into shop.rate_limits as r (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count    = case when r.reset_at < now() then 1 else r.count + 1 end,
        reset_at = case when r.reset_at < now() then now() + make_interval(secs => p_window_seconds) else r.reset_at end
  returning count into c;

  -- Housekeeping: about one call in fifty clears expired counters.
  if random() < 0.02 then
    delete from shop.rate_limits where key in (select key from shop.rate_limits where reset_at < now() - interval '1 hour' for update skip locked);
    delete from shop.admin_sessions where expires_at < now();
    delete from shop.customer_sessions where expires_at < now();
    delete from shop.password_resets where expires_at < now() - interval '1 day';
    delete from shop.admin_audit where created_at < now() - interval '180 days';
    delete from shop.admin_audit where id <= (select coalesce(max(id), 0) - 5000 from shop.admin_audit);
  end if;

  return c <= p_max;
end;
$$;

-- Wipes the counters whose key starts with a prefix (used after a password reset by emailed link).
create or replace function shop.rate_limit_clear(p_prefix text)
returns void
language sql
set search_path = ''
as $$
  delete from shop.rate_limits where left(key, length(p_prefix)) = p_prefix;
$$;

-- True while this key has used fewer than p_max of its allowance. It only looks; it never counts.
-- Sign-in limits use it so that only FAILED attempts use up the allowance.
create or replace function shop.rate_limit_check(p_key text, p_max int)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select r.reset_at < now() or r.count < p_max from shop.rate_limits r where r.key = p_key), true);
$$;

-- ── Pricing and ordering ───────────────────────────────────────────────────
-- The browser only ever says WHICH products and HOW MANY. Prices, stock, delivery fees and coupon
-- rules are all read here, inside the database, so none of them can be tampered with from the page.
--
-- p_items:  [{"product_id": "<uuid>", "quantity": 2}, ...]
-- p_lock:   true when placing an order (locks the product rows so two buyers cannot take the last item).
-- Errors are raised as 'CODE:detail' and mapped to friendly messages by the app.

create or replace function shop.normalize_email(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  l   text := lower(btrim(coalesce(p, '')));
  loc text := split_part(l, '@', 1);
  dom text := split_part(l, '@', 2);
begin
  -- "asha+deal@gmail.com" and "a.sha@gmail.com" are the same mailbox as "asha@gmail.com".
  loc := regexp_replace(loc, '\+.*$', '');
  if dom in ('gmail.com', 'googlemail.com') then
    loc := replace(loc, '.', '');
    dom := 'gmail.com';
  end if;
  return loc || '@' || dom;
end;
$$;

-- "12 Rose Society, Patan 384265" written any which way gives the same key. An address with too little Latin text to
-- tell households apart (written in Gujarati or Hindi, or just "12") gets NO key (an empty string), so two different
-- households in one PIN code are never mistaken for each other. Empty keys are ignored by every rule that uses them.
create or replace function shop.address_key(p_pincode text, p_address text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(regexp_replace(lower(coalesce(p_address, '')), '[^a-z0-9]', '', 'g')) < 12 then ''
    else coalesce(p_pincode, '') || ':' || left(regexp_replace(lower(coalesce(p_address, '')), '[^a-z0-9]', '', 'g'), 60)
  end;
$$;

-- Refund a counted hit (used when a sign-in succeeds, so only failures use up the allowance).
create or replace function shop.rate_limit_refund(p_key text)
returns void
language sql
set search_path = ''
as $$
  update shop.rate_limits set count = greatest(count - 1, 0) where key = p_key and reset_at >= now();
$$;

-- Old signatures are replaced by the one below.
drop function if exists shop.price_cart(jsonb, text, text, boolean);
drop function if exists shop.price_cart(jsonb, text, text, text, text);

-- Limits on a single web order. They exist so that one anonymous cash-on-delivery order can't empty
-- the shelves. The owner's own "take an order" screen is exempt.
--   at most 30 items, at most ₹50,000, and no more of one product than half its stock (never fewer than 3).
-- p_who: {"email", "phone", "address_key", "customer_id", "admin"}   (all optional)

create or replace function shop.price_cart(p_items jsonb, p_shipping text, p_coupon text, p_who jsonb default '{}'::jsonb, p_lock boolean default false)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s            shop.settings;
  ids          uuid[];
  line         jsonb;
  prod         shop.products;
  qty          int;
  lines        jsonb := '[]'::jsonb;
  subtotal     int := 0;
  units        int := 0;
  fee          int;
  disc         int := 0;
  cp           shop.coupons;
  applied      text := null;
  wanted       record;
  is_admin     boolean := coalesce((p_who->>'admin')::boolean, false);
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART:';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'TOO_MANY_LINES:';
  end if;
  if p_shipping is null or p_shipping not in ('standard', 'express') then
    raise exception 'BAD_SHIPPING:';
  end if;

  select * into s from shop.settings where id = 1;

  select array_agg(distinct (e->>'product_id')::uuid) into ids from jsonb_array_elements(p_items) e;
  -- Only an order being placed locks the products (in a fixed order, so orders can't deadlock).
  -- A price quote just reads, so quotes never queue behind each other or behind orders.
  if p_lock then
    perform 1 from shop.products where id = any(ids) order by id for update;
  end if;

  for line in select * from jsonb_array_elements(p_items) loop
    qty := (line->>'quantity')::int;
    if qty is null or qty < 1 or qty > 20 then
      raise exception 'BAD_QUANTITY:';
    end if;
    select * into prod from shop.products where id = (line->>'product_id')::uuid;
    if not found or prod.status <> 'active' then
      raise exception 'UNKNOWN_PRODUCT:%', coalesce(line->>'product_id', '');
    end if;
    -- A product without a price is quoted on WhatsApp; it can't go through an order that adds up a total.
    if prod.price is null then
      raise exception 'NOT_PRICED:%', prod.title;
    end if;
    lines := lines || jsonb_build_object(
      'product_id', prod.id, 'title', prod.title, 'unit_price', prod.price, 'quantity', qty,
      'image', prod.image, 'tint', prod.tint, 'handle', prod.handle);
    subtotal := subtotal + prod.price * qty;
    units := units + qty;
  end loop;

  if not is_admin and (units > 30 or subtotal > 50000) then
    raise exception 'ORDER_TOO_BIG:';
  end if;

  -- Stock is checked against the TOTAL asked for each product (the same product can sit on two lines).
  for wanted in
    select (l->>'product_id')::uuid as pid, sum((l->>'quantity')::int) as qty
    from jsonb_array_elements(lines) l group by 1
  loop
    select * into prod from shop.products where id = wanted.pid;
    if prod.track_stock and prod.stock < wanted.qty then
      raise exception 'OUT_OF_STOCK:%|%', prod.title, prod.stock;
    end if;
    if prod.track_stock and not is_admin and wanted.qty > greatest(3, ceil(prod.stock / 2.0)::int) then
      raise exception 'TOO_MANY_OF_ONE:%|%', prod.title, greatest(3, ceil(prod.stock / 2.0)::int);
    end if;
  end loop;

  -- Coupon. Every failure looks the same, so codes cannot be probed.
  if p_coupon is not null and p_coupon <> '' then
    if p_lock then
      select * into cp from shop.coupons where code = upper(p_coupon) for update;
    else
      select * into cp from shop.coupons where code = upper(p_coupon);
    end if;
    if not found
       or not cp.active
       or (cp.expires_at is not null and cp.expires_at < now())
       or (cp.max_uses is not null and cp.used >= cp.max_uses)
       or subtotal < cp.min_subtotal then
      raise exception 'BAD_COUPON:';
    end if;
    -- One use per person: the same mailbox (ignoring dots and +tags), phone number, delivery address or
    -- signed-in account can't use it twice. A cancelled order frees the code again.
    if cp.once_per_email and exists (
         select 1 from shop.orders o
          where o.coupon_code = cp.code and o.status <> 'cancelled'
            and ((coalesce(p_who->>'email', '') <> '' and o.email_norm = shop.normalize_email(p_who->>'email'))
              or (coalesce(p_who->>'phone', '') <> '' and o.phone = p_who->>'phone')
              or (coalesce(p_who->>'address_key', '') <> '' and o.address_key = p_who->>'address_key')
              or (coalesce(p_who->>'customer_id', '') <> '' and o.customer_id = (p_who->>'customer_id')::uuid))) then
      raise exception 'BAD_COUPON:';
    end if;
    disc := case when cp.kind = 'percent' then floor(subtotal::bigint * cp.value / 100.0)::int else least(cp.value, subtotal) end;
    applied := cp.code;
  end if;

  -- Delivery. Free standard delivery is judged on what the customer actually pays for the items
  -- (after any coupon), so a big coupon can't be used to unlock free delivery as well.
  fee := case
    when p_shipping = 'express' then s.shipping_express
    when s.free_shipping_from > 0 and subtotal - disc >= s.free_shipping_from then 0
    else s.shipping_flat
  end;

  return jsonb_build_object(
    'lines', lines, 'subtotal', subtotal, 'shipping_fee', fee, 'discount', disc,
    'total', subtotal - disc + fee, 'coupon_code', applied);
end;
$$;

create or replace function shop.place_order(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  priced   jsonb;
  oid      uuid;
  onum     bigint;
  l        jsonb;
  cust     uuid := nullif(p->>'customer_id', '')::uuid;
  idem     uuid := nullif(p->>'idem_key', '')::uuid;
  is_admin boolean := coalesce(nullif(p->>'source', ''), 'web') = 'admin';
  ekey     text := shop.normalize_email(p->>'email');
  akey     text := shop.address_key(p->>'pincode', p->>'address1');
  open_n   int;
  prev     record;
begin
  -- Never wait forever for a row another order is holding. (A cap on total run time is set by the caller, because a
  -- statement_timeout set from inside a running statement would only apply to the NEXT one.)
  perform set_config('lock_timeout', '5s', true);

  -- The same order submitted twice (a lost reply, a double tap) is one order.
  if idem is not null then
    select id, number, total, subtotal, discount, shipping_fee into prev from shop.orders where idem_key = idem;
    if found then
      return jsonb_build_object('id', prev.id, 'number', prev.number, 'total', prev.total, 'subtotal', prev.subtotal,
                                'discount', prev.discount, 'shipping_fee', prev.shipping_fee, 'duplicate', true);
    end if;
  end if;

  if not is_admin then
    -- Orders that share an email, a phone number or a delivery address go through one at a time (the locks are
    -- always taken in the same sorted order, so they can't deadlock), which is what makes the open-order limit
    -- impossible to race with parallel requests.
    perform pg_advisory_xact_lock(k) from (
      select distinct hashtext(x) as k
        from unnest(array['e:' || ekey, case when coalesce(p->>'phone', '') <> '' then 'p:' || (p->>'phone') end, case when akey <> '' then 'a:' || akey end]) x
       where x is not null
       order by 1) locks;

    -- Another request for the same order may have finished while this one waited for the locks.
    if idem is not null then
      select id, number, total, subtotal, discount, shipping_fee into prev from shop.orders where idem_key = idem;
      if found then
        return jsonb_build_object('id', prev.id, 'number', prev.number, 'total', prev.total, 'subtotal', prev.subtotal,
                                  'discount', prev.discount, 'shipping_fee', prev.shipping_fee, 'duplicate', true);
      end if;
    end if;

    select count(*) into open_n from shop.orders
     where status in ('placed', 'packed')
       and (email_norm = ekey
            or (coalesce(p->>'phone', '') <> '' and phone = p->>'phone')
            or (akey <> '' and address_key = akey));
    if open_n >= 3 then
      raise exception 'TOO_MANY_OPEN:';
    end if;
  end if;

  priced := shop.price_cart(p->'items', p->>'shipping', nullif(p->>'coupon', ''),
    jsonb_build_object('email', p->>'email', 'phone', p->>'phone', 'address_key', akey, 'customer_id', p->>'customer_id', 'admin', is_admin), true);

  -- "What you see is what you pay": if the price moved since the customer last saw it, say so instead of charging more.
  if nullif(p->>'expected_total', '') is not null and (p->>'expected_total')::int <> (priced->>'total')::int then
    raise exception 'PRICE_CHANGED:%', priced->>'total';
  end if;

  insert into shop.orders (customer_id, source, email, email_norm, phone, name, address1, address2, city, state, pincode, address_key,
                           shipping_method, shipping_fee, subtotal, discount, total, coupon_code, payment_status, idem_key)
  values (cust, case when is_admin then 'admin' else 'web' end, lower(p->>'email'), ekey, p->>'phone', p->>'name',
          p->>'address1', coalesce(p->>'address2', ''), p->>'city', coalesce(p->>'state', ''), p->>'pincode', akey,
          p->>'shipping', (priced->>'shipping_fee')::int, (priced->>'subtotal')::int, (priced->>'discount')::int,
          (priced->>'total')::int, priced->>'coupon_code', 'pending', idem)
  returning id, number into oid, onum;

  for l in select * from jsonb_array_elements(priced->'lines') loop
    insert into shop.order_items (order_id, product_id, title, unit_price, quantity, image, tint)
    values (oid, (l->>'product_id')::uuid, l->>'title', (l->>'unit_price')::int, (l->>'quantity')::int,
            coalesce(l->>'image', ''), coalesce(l->>'tint', '#F4E9D8'));
    update shop.products set stock = stock - (l->>'quantity')::int
      where id = (l->>'product_id')::uuid and track_stock;
  end loop;

  if priced->>'coupon_code' is not null then
    update shop.coupons set used = used + 1 where code = priced->>'coupon_code';
  end if;

  return jsonb_build_object('id', oid, 'number', onum, 'total', (priced->>'total')::int,
                            'subtotal', (priced->>'subtotal')::int, 'discount', (priced->>'discount')::int,
                            'shipping_fee', (priced->>'shipping_fee')::int,
                            'lines', (select jsonb_agg(jsonb_build_object('title', x->>'title', 'quantity', (x->>'quantity')::int)) from jsonb_array_elements(priced->'lines') x));
exception
  when unique_violation then
    -- Two submits of the same order raced: the other one won. Return it (this attempt is rolled back).
    if idem is not null then
      select id, number, total, subtotal, discount, shipping_fee into prev from shop.orders where idem_key = idem;
      if found then
        return jsonb_build_object('id', prev.id, 'number', prev.number, 'total', prev.total, 'subtotal', prev.subtotal,
                                  'discount', prev.discount, 'shipping_fee', prev.shipping_fee, 'duplicate', true);
      end if;
    end if;
    raise;
end;
$$;

-- Moves an order along: placed → packed → shipped → delivered, or cancelled (which puts the stock and the coupon use back).
create or replace function shop.set_order_status(p_id uuid, p_status text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  o     shop.orders;
  rank_ constant text[] := array['placed', 'packed', 'shipped', 'delivered'];
  from_i int;
  to_i   int;
begin
  perform set_config('lock_timeout', '5s', true);
  select * into o from shop.orders where id = p_id for update;
  if not found then raise exception 'NO_ORDER:'; end if;
  if p_status not in ('placed', 'packed', 'shipped', 'delivered', 'cancelled') then raise exception 'BAD_STATUS:'; end if;
  if o.status = p_status then return; end if;
  if o.status in ('cancelled', 'delivered') then raise exception 'LOCKED:%', o.status; end if;

  if p_status = 'cancelled' then
    if not o.restocked then
      -- Lock the products in the same order a new order does, so the two can never deadlock.
      perform 1 from shop.products
        where id in (select product_id from shop.order_items where order_id = o.id and product_id is not null)
        order by id for update;
      update shop.products pr set stock = pr.stock + i.q
        from (select product_id, sum(quantity) as q from shop.order_items where order_id = o.id and product_id is not null group by 1) i
        where pr.id = i.product_id and pr.track_stock;
      if o.coupon_code is not null then
        update shop.coupons set used = greatest(used - 1, 0) where code = o.coupon_code;
      end if;
    end if;
    update shop.orders set status = 'cancelled', cancelled_at = now(), restocked = true where id = o.id;
    return;
  end if;

  from_i := array_position(rank_, o.status);
  to_i   := array_position(rank_, p_status);
  if to_i <= from_i then raise exception 'BAD_STATUS:'; end if;

  update shop.orders set
    status       = p_status,
    packed_at    = case when to_i >= 2 then coalesce(packed_at, now()) else packed_at end,
    shipped_at   = case when to_i >= 3 then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when to_i >= 4 then coalesce(delivered_at, now()) else delivered_at end
  where id = o.id;
end;
$$;

update shop.orders set email_norm = shop.normalize_email(email) where email_norm = '';
update shop.orders set address_key = shop.address_key(pincode, address1) where address_key = '';

-- What a customer may see when tracking. Deliberately leaves out phone, street address and notes.
create or replace function shop.track_order(p_number bigint, p_email text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'number', o.number, 'placed_at', o.placed_at, 'stage', o.status,
    'packed_at', o.packed_at, 'shipped_at', o.shipped_at, 'delivered_at', o.delivered_at, 'cancelled_at', o.cancelled_at,
    'first_name', split_part(o.name, ' ', 1), 'city', o.city,
    'delivery', case o.shipping_method when 'express' then 'Express delivery' else 'Standard delivery' end,
    'courier', o.courier, 'tracking_number', o.tracking_number, 'tracking_url', o.tracking_url,
    'paid', o.payment_status = 'paid',
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', i.title, 'quantity', i.quantity, 'unit_price', i.unit_price,
                                                           'image', i.image, 'tint', i.tint) order by i.title)
                       from shop.order_items i where i.order_id = o.id), '[]'::jsonb),
    'subtotal', o.subtotal, 'discount', o.discount, 'shipping_total', o.shipping_fee, 'total', o.total)
  from shop.orders o
  where o.number = p_number and o.email = lower(p_email);
$$;

create or replace function shop.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists products_touch on shop.products;
create trigger products_touch before update on shop.products for each row execute function shop.touch_updated_at();

-- ── One-time data steps ────────────────────────────────────────────────────
-- Migrations can be applied over and over. A step that changes DATA (not structure) is written in its own file and
-- records its name here, so it runs once and never repeats (and never undoes the owner's later edits).

create table if not exists shop.applied_steps (
  name       text primary key,
  applied_at timestamptz not null default now()
);

-- ── Lock everything down ───────────────────────────────────────────────────

alter table shop.applied_steps      enable row level security;
alter table shop.categories         enable row level security;
alter table shop.products           enable row level security;
alter table shop.settings           enable row level security;
alter table shop.coupons            enable row level security;
alter table shop.admins             enable row level security;
alter table shop.customers          enable row level security;
alter table shop.customer_addresses enable row level security;
alter table shop.admin_sessions     enable row level security;
alter table shop.customer_sessions  enable row level security;
alter table shop.orders             enable row level security;
alter table shop.order_items        enable row level security;
alter table shop.rate_limits        enable row level security;
alter table shop.password_resets    enable row level security;
alter table shop.admin_audit        enable row level security;

revoke all on schema shop from public;
revoke all on all tables    in schema shop from public;
revoke all on all functions in schema shop from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema shop from anon;
    revoke all on all tables    in schema shop from anon;
    revoke all on all functions in schema shop from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on schema shop from authenticated;
    revoke all on all tables    in schema shop from authenticated;
    revoke all on all functions in schema shop from authenticated;
  end if;

  -- Product photos: a public bucket (anyone may view), small images only. Nobody can upload straight
  -- from a browser; uploads go through the admin-only server route.
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('products', 'products', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do update
      set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
  end if;
end $$;
