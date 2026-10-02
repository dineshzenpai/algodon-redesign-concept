-- 02: Carts, wishlists, orders, coupons, and reviews.
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create index if not exists cart_items_cart_id_idx on public.cart_items(cart_id);
create index if not exists cart_items_variant_id_idx on public.cart_items(variant_id);

create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists wishlists_user_id_idx on public.wishlists(user_id);

create table if not exists public.store_settings (
  singleton boolean primary key default true check (singleton),
  currency char(3) not null default 'INR',
  shipping_fee numeric(10,2) not null default 0 check (shipping_fee >= 0),
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.store_settings(singleton) values(true) on conflict(singleton) do nothing;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  -- Legacy aliases are retained for the existing admin API.
  type text not null default 'percentage' check (type in ('percentage','flat','free_shipping')),
  value numeric(10,2) not null default 0 check (value >= 0),
  discount_type text not null check (discount_type in ('percentage','fixed','free_shipping')),
  discount_value numeric(10,2) not null default 0 check (discount_value >= 0),
  minimum_order numeric(10,2) not null default 0 check (minimum_order >= 0),
  maximum_discount numeric(10,2) check (maximum_discount is null or maximum_discount >= 0),
  usage_limit integer check (usage_limit is null or usage_limit >= 0),
  per_customer_limit integer not null default 1 check (per_customer_limit >= 1),
  starts_at timestamptz,
  ends_at timestamptz,
  max_discount numeric(10,2),
  product_ids uuid[] not null default '{}',
  category_ids uuid[] not null default '{}',
  active boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
-- Existing admin schema uses type/value/active. Add the catalog aliases and keep both contracts usable.
alter table public.coupons add column if not exists type text not null default 'percentage';
alter table public.coupons add column if not exists value numeric(10,2) not null default 0;
alter table public.coupons add column if not exists discount_type text not null default 'percentage';
alter table public.coupons add column if not exists discount_value numeric(10,2) not null default 0;
alter table public.coupons add column if not exists minimum_order numeric(10,2) not null default 0;
alter table public.coupons add column if not exists maximum_discount numeric(10,2);
alter table public.coupons add column if not exists usage_limit integer;
alter table public.coupons add column if not exists per_customer_limit integer not null default 1;
alter table public.coupons add column if not exists starts_at timestamptz;
alter table public.coupons add column if not exists ends_at timestamptz;
alter table public.coupons add column if not exists max_discount numeric(10,2);
alter table public.coupons add column if not exists product_ids uuid[] not null default '{}';
alter table public.coupons add column if not exists category_ids uuid[] not null default '{}';
alter table public.coupons add column if not exists active boolean not null default false;
alter table public.coupons add column if not exists is_active boolean not null default false;
update public.coupons set
  discount_type=case when type='flat' then 'fixed' else type end,
  discount_value=value,
  maximum_discount=max_discount,
  is_active=active
where discount_value=0 or is_active is distinct from active;

create or replace function public.sync_legacy_coupon_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.discount_type <> 'percentage' or new.discount_value <> 0 or new.is_active then
      new.type := case when new.discount_type='fixed' then 'flat' else new.discount_type end;
      new.value := new.discount_value;
      new.max_discount := new.maximum_discount;
      new.active := new.is_active;
    else
      new.discount_type := case when new.type='flat' then 'fixed' else new.type end;
      new.discount_value := new.value;
      new.maximum_discount := coalesce(new.maximum_discount,new.max_discount);
      new.is_active := new.active;
    end if;
  elsif new.discount_type is distinct from old.discount_type or new.discount_value is distinct from old.discount_value or new.is_active is distinct from old.is_active or new.maximum_discount is distinct from old.maximum_discount then
    new.type := case when new.discount_type='fixed' then 'flat' else new.discount_type end;
    new.value := new.discount_value;
    new.max_discount := new.maximum_discount;
    new.active := new.is_active;
  else
    new.discount_type := case when new.type='flat' then 'fixed' else new.type end;
    new.discount_value := new.value;
    new.maximum_discount := coalesce(new.maximum_discount,new.max_discount);
    new.is_active := new.active;
  end if;
  return new;
end;
$$;
drop trigger if exists sync_legacy_coupon_fields on public.coupons;
create trigger sync_legacy_coupon_fields before insert or update on public.coupons
for each row execute function public.sync_legacy_coupon_fields();

create table if not exists public.coupon_products (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (coupon_id, product_id)
);
create table if not exists public.coupon_categories (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (coupon_id, category_id)
);
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete restrict,
  customer_email text not null default '',
  order_ref text,
  order_id uuid,
  commerce_order_id uuid,
  discount_amount numeric(10,2) not null check (discount_amount >= 0),
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.coupon_redemptions add column if not exists user_id uuid references public.profiles(id) on delete restrict;
alter table public.coupon_redemptions add column if not exists customer_email text not null default '';
alter table public.coupon_redemptions add column if not exists order_ref text;
alter table public.coupon_redemptions add column if not exists order_id uuid;
alter table public.coupon_redemptions add column if not exists commerce_order_id uuid;
alter table public.coupon_redemptions add column if not exists discount_amount numeric(10,2) not null default 0;
alter table public.coupon_redemptions add column if not exists redeemed_at timestamptz not null default now();
alter table public.coupon_redemptions add column if not exists created_at timestamptz not null default now();
create index if not exists coupon_redemptions_coupon_id_idx on public.coupon_redemptions(coupon_id);
create index if not exists coupon_redemptions_user_coupon_idx on public.coupon_redemptions(user_id, coupon_id);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  address_snapshot jsonb not null,
  status text not null default 'pending' check (status in ('pending','confirmed','packed','shipped','delivered','cancelled','returned','refunded')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  currency char(3) not null default 'INR',
  subtotal numeric(10,2) not null check (subtotal >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  shipping_amount numeric(10,2) not null default 0 check (shipping_amount >= 0),
  tax_amount numeric(10,2) not null default 0 check (tax_amount >= 0),
  total numeric(10,2) not null check (total >= 0),
  coupon_id uuid references public.coupons(id) on delete set null,
  tracking_number text not null default '',
  courier_name text not null default '',
  customer_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_id_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at desc);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_coupon_id_idx on public.orders(coupon_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='coupon_redemptions_commerce_order_id_fkey' and conrelid='public.coupon_redemptions'::regclass) then
    alter table public.coupon_redemptions add constraint coupon_redemptions_commerce_order_id_fkey foreign key (commerce_order_id) references public.orders(id) on delete set null;
  end if;
end $$;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  sku text not null,
  size text not null,
  color text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_items_variant_id_idx on public.order_items(variant_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text not null default '',
  body text not null default '',
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists reviews_product_approved_idx on public.reviews(product_id, is_approved, created_at desc);
create index if not exists reviews_user_id_idx on public.reviews(user_id);

do $$ declare t text; begin
  foreach t in array array['carts','cart_items','store_settings','coupons','orders','reviews'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
