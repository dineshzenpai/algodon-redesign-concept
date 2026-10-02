-- 01: Profiles, addresses, categories, products, variants, and images.
-- Additive schema: keeps the existing admin-panel tables and order_intents intact.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text not null default '',
  avatar_url text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text not null default '',
  city text not null,
  state_region text not null,
  postal_code text not null,
  country_code char(2) not null default 'IN',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists addresses_user_id_idx on public.addresses(user_id);
create unique index if not exists addresses_one_default_per_user_idx on public.addresses(user_id) where is_default;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Keep compatibility with the existing admin-panel categories table when present.
alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
alter table public.categories add column if not exists image_url text;
alter table public.categories add column if not exists sort_order integer not null default 0;
alter table public.categories add column if not exists active boolean not null default true;
alter table public.categories add column if not exists is_active boolean not null default true;
update public.categories set is_active=active where is_active is distinct from active;
create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists categories_active_sort_idx on public.categories(is_active, sort_order);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price is null or compare_at_price >= price),
  fit text check (fit is null or fit in ('slim','regular','relaxed')),
  fabric text not null default '',
  occasion text[] not null default '{}',
  care_instructions text not null default '',
  size_chart jsonb not null default '{}'::jsonb,
  -- Legacy admin-panel fields are retained so existing API routes remain compatible.
  sale_price numeric(10,2) check (sale_price is null or (sale_price >= 0 and sale_price <= price)),
  sku text unique,
  brand text not null default 'Algodon Organic',
  tags text[] not null default '{}',
  variants jsonb not null default '[]'::jsonb,
  stock_count integer not null default 0 check (stock_count >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  out_of_stock_hidden boolean not null default false,
  images jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  seo_title text not null default '',
  meta_description text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Add customer-catalog columns to an existing admin-panel products table.
alter table public.products add column if not exists fit text check (fit is null or fit in ('slim','regular','relaxed'));
alter table public.products add column if not exists fabric text not null default '';
alter table public.products add column if not exists occasion text[] not null default '{}';
alter table public.products add column if not exists care_instructions text not null default '';
alter table public.products add column if not exists size_chart jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists is_active boolean not null default false;
alter table public.products add column if not exists sale_price numeric(10,2);
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists brand text not null default 'Algodon Organic';
alter table public.products add column if not exists tags text[] not null default '{}';
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists stock_count integer not null default 0;
alter table public.products add column if not exists low_stock_threshold integer not null default 5;
alter table public.products add column if not exists out_of_stock_hidden boolean not null default false;
alter table public.products add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists published boolean not null default false;
alter table public.products add column if not exists seo_title text not null default '';
alter table public.products add column if not exists meta_description text not null default '';
update public.products set is_active=published where is_active is distinct from published;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='products_occasion_allowed' and conrelid='public.products'::regclass) then
    alter table public.products add constraint products_occasion_allowed
      check (occasion <@ array['casual','formal','party','ethnic']::text[]) not valid;
  end if;
end $$;
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_status_idx on public.products(is_active);
create index if not exists products_category_status_idx on public.products(category_id, is_active);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null default 'Default',
  sku text not null unique,
  stock integer not null default 0 check (stock >= 0),
  price_override numeric(10,2) check (price_override is null or price_override >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index if not exists product_variants_product_id_idx on public.product_variants(product_id);
create index if not exists product_variants_status_idx on public.product_variants(is_active);
create index if not exists product_variants_size_color_idx on public.product_variants(size, color);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text,
  image_url text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_images_product_id_idx on public.product_images(product_id, sort_order);
create unique index if not exists product_images_one_primary_idx on public.product_images(product_id) where is_primary;

do $$ declare t text; begin
  foreach t in array array['profiles','addresses','categories','products','product_variants','product_images'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create or replace function public.sync_legacy_catalog_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'categories' then
    if tg_op = 'INSERT' then
      new.is_active := new.is_active or new.active;
      new.active := new.is_active;
    elsif new.is_active is distinct from old.is_active and new.active is not distinct from old.active then
      new.active := new.is_active;
    else
      new.is_active := new.active;
    end if;
  else
    if tg_op = 'INSERT' then
      new.is_active := new.is_active or new.published;
      new.published := new.is_active;
    elsif new.is_active is distinct from old.is_active and new.published is not distinct from old.published then
      new.published := new.is_active;
    else
      new.is_active := new.published;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists sync_category_status on public.categories;
create trigger sync_category_status before insert or update of active,is_active on public.categories
for each row execute function public.sync_legacy_catalog_status();
drop trigger if exists sync_product_status on public.products;
create trigger sync_product_status before insert or update of published,is_active on public.products
for each row execute function public.sync_legacy_catalog_status();
