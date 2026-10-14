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
  price       int  not null check (price between 0 and 1000000),
  compare_at  int  check (compare_at is null or compare_at between 0 and 1000000),
  categories  text[] not null default '{}',
  recipients  text[] not null default '{}',
  occasions   text[] not null default '{}',
  details     text[] not null default '{}',
  tint        text not null default '#F4E9D8' check (tint ~ '^#[0-9A-Fa-f]{6}$'),
  badge       text not null default '' check (char_length(badge) <= 24),
  rank        int  not null default 100,
  is_new      boolean not null default false,
  hidden      boolean not null default false,           -- kept out of listings (the gift-wrap service)
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

create table if not exists shop.settings (
  id                int primary key default 1 check (id = 1),
  shipping_flat     int not null default 79  check (shipping_flat between 0 and 100000),
  shipping_express  int not null default 149 check (shipping_express between 0 and 100000),
  free_shipping_from int not null default 999 check (free_shipping_from between 0 and 1000000),
  updated_at        timestamptz not null default now()
);
insert into shop.settings (id) values (1) on conflict do nothing;

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
  wrap       jsonb
);
create index if not exists order_items_order on shop.order_items (order_id);

-- ── Abuse protection ───────────────────────────────────────────────────────

create table if not exists shop.rate_limits (
  key      text primary key,
  count    int not null,
  reset_at timestamptz not null
);

-- True while the caller is within `p_max` hits per `p_window_seconds`.
create or replace function shop.rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
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
    delete from shop.rate_limits where reset_at < now() - interval '1 hour';
    delete from shop.admin_sessions where expires_at < now();
    delete from shop.customer_sessions where expires_at < now();
  end if;

  return c <= p_max;
end;
$$;

-- ── Pricing and ordering ───────────────────────────────────────────────────
-- The browser only ever says WHICH products and HOW MANY. Prices, stock, delivery fees and coupon
-- rules are all read here, inside the database, so none of them can be tampered with from the page.
--
-- p_items:  [{"product_id": "<uuid>", "quantity": 2, "wrap": {...} | null}, ...]
-- p_lock:   true when placing an order (locks the product rows so two buyers cannot take the last item).
-- Errors are raised as 'CODE:detail' and mapped to friendly messages by the app.

create or replace function shop.price_cart(p_items jsonb, p_shipping text, p_coupon text, p_lock boolean)
returns jsonb
language plpgsql
as $$
declare
  s            shop.settings;
  ids          uuid[];
  line         jsonb;
  prod         shop.products;
  qty          int;
  lines        jsonb := '[]'::jsonb;
  subtotal     int := 0;
  fee          int;
  disc         int := 0;
  cp           shop.coupons;
  applied      text := null;
  wanted       record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART:';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'TOO_MANY_LINES:';
  end if;
  if p_shipping not in ('standard', 'express') then
    raise exception 'BAD_SHIPPING:';
  end if;

  select * into s from shop.settings where id = 1;

  -- Lock in a fixed order so concurrent orders cannot deadlock.
  select array_agg(distinct (e->>'product_id')::uuid) into ids from jsonb_array_elements(p_items) e;
  perform 1 from shop.products where id = any(ids) order by id for update;

  for line in select * from jsonb_array_elements(p_items) loop
    qty := (line->>'quantity')::int;
    if qty is null or qty < 1 or qty > 20 then
      raise exception 'BAD_QUANTITY:';
    end if;
    select * into prod from shop.products where id = (line->>'product_id')::uuid;
    if not found or prod.status <> 'active' then
      raise exception 'UNKNOWN_PRODUCT:%', coalesce(line->>'product_id', '');
    end if;
    lines := lines || jsonb_build_object(
      'product_id', prod.id, 'title', prod.title, 'unit_price', prod.price, 'quantity', qty,
      'image', prod.image, 'tint', prod.tint, 'wrap', line->'wrap', 'handle', prod.handle);
    subtotal := subtotal + prod.price * qty;
  end loop;

  -- Stock is checked against the TOTAL asked for each product (the same product can sit on two lines).
  for wanted in
    select (l->>'product_id')::uuid as pid, sum((l->>'quantity')::int) as qty
    from jsonb_array_elements(lines) l group by 1
  loop
    select * into prod from shop.products where id = wanted.pid;
    if prod.track_stock and prod.stock < wanted.qty then
      raise exception 'OUT_OF_STOCK:%|%', prod.title, prod.stock;
    end if;
  end loop;

  -- Delivery: standard is free over the threshold; express always costs its flat fee.
  fee := case
    when p_shipping = 'express' then s.shipping_express
    when s.free_shipping_from > 0 and subtotal >= s.free_shipping_from then 0
    else s.shipping_flat
  end;

  -- Coupon. Every failure looks the same, so codes cannot be probed.
  if p_coupon is not null and p_coupon <> '' then
    select * into cp from shop.coupons where code = upper(p_coupon) for update;
    if not found
       or not cp.active
       or (cp.expires_at is not null and cp.expires_at < now())
       or (cp.max_uses is not null and cp.used >= cp.max_uses)
       or subtotal < cp.min_subtotal then
      raise exception 'BAD_COUPON:';
    end if;
    disc := case when cp.kind = 'percent' then floor(subtotal * cp.value / 100.0)::int else least(cp.value, subtotal) end;
    applied := cp.code;
  end if;

  return jsonb_build_object(
    'lines', lines, 'subtotal', subtotal, 'shipping_fee', fee, 'discount', disc,
    'total', subtotal - disc + fee, 'coupon_code', applied);
end;
$$;

create or replace function shop.place_order(p jsonb)
returns jsonb
language plpgsql
as $$
declare
  priced   jsonb;
  oid      uuid;
  onum     bigint;
  l        jsonb;
  cust     uuid := nullif(p->>'customer_id', '')::uuid;
begin
  priced := shop.price_cart(p->'items', p->>'shipping', nullif(p->>'coupon', ''), true);

  insert into shop.orders (customer_id, source, email, phone, name, address1, address2, city, state, pincode,
                           shipping_method, shipping_fee, subtotal, discount, total, coupon_code, payment_status)
  values (cust, coalesce(nullif(p->>'source', ''), 'web'), lower(p->>'email'), p->>'phone', p->>'name',
          p->>'address1', coalesce(p->>'address2', ''), p->>'city', coalesce(p->>'state', ''), p->>'pincode',
          p->>'shipping', (priced->>'shipping_fee')::int, (priced->>'subtotal')::int, (priced->>'discount')::int,
          (priced->>'total')::int, priced->>'coupon_code', 'pending')
  returning id, number into oid, onum;

  for l in select * from jsonb_array_elements(priced->'lines') loop
    insert into shop.order_items (order_id, product_id, title, unit_price, quantity, image, tint, wrap)
    values (oid, (l->>'product_id')::uuid, l->>'title', (l->>'unit_price')::int, (l->>'quantity')::int,
            coalesce(l->>'image', ''), coalesce(l->>'tint', '#F4E9D8'),
            case when jsonb_typeof(l->'wrap') = 'object' then l->'wrap' end);
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
end;
$$;

-- Moves an order along: placed → packed → shipped → delivered, or cancelled (which puts the stock back).
create or replace function shop.set_order_status(p_id uuid, p_status text)
returns void
language plpgsql
as $$
declare
  o     shop.orders;
  rank_ constant text[] := array['placed', 'packed', 'shipped', 'delivered'];
  from_i int;
  to_i   int;
begin
  select * into o from shop.orders where id = p_id for update;
  if not found then raise exception 'NO_ORDER:'; end if;
  if p_status not in ('placed', 'packed', 'shipped', 'delivered', 'cancelled') then raise exception 'BAD_STATUS:'; end if;
  if o.status = p_status then return; end if;
  if o.status in ('cancelled', 'delivered') then raise exception 'LOCKED:%', o.status; end if;

  if p_status = 'cancelled' then
    if not o.restocked then
      update shop.products pr set stock = pr.stock + i.q
        from (select product_id, sum(quantity) as q from shop.order_items where order_id = o.id and product_id is not null group by 1) i
        where pr.id = i.product_id and pr.track_stock;
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

-- What a customer may see when tracking. Deliberately leaves out phone, street address and notes.
create or replace function shop.track_order(p_number bigint, p_email text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'number', o.number, 'placed_at', o.placed_at, 'stage', o.status,
    'packed_at', o.packed_at, 'shipped_at', o.shipped_at, 'delivered_at', o.delivered_at, 'cancelled_at', o.cancelled_at,
    'first_name', split_part(o.name, ' ', 1), 'city', o.city,
    'delivery', case o.shipping_method when 'express' then 'Express delivery' else 'Standard delivery' end,
    'courier', o.courier, 'tracking_number', o.tracking_number, 'tracking_url', o.tracking_url,
    'paid', o.payment_status = 'paid',
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', i.title, 'quantity', i.quantity, 'unit_price', i.unit_price,
                                                           'image', i.image, 'tint', i.tint, 'gift_wrapped', i.wrap is not null) order by i.title)
                       from shop.order_items i where i.order_id = o.id), '[]'::jsonb),
    'subtotal', o.subtotal, 'discount', o.discount, 'shipping_total', o.shipping_fee, 'total', o.total)
  from shop.orders o
  where o.number = p_number and o.email = lower(p_email);
$$;

create or replace function shop.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists products_touch on shop.products;
create trigger products_touch before update on shop.products for each row execute function shop.touch_updated_at();

-- ── Lock everything down ───────────────────────────────────────────────────

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
