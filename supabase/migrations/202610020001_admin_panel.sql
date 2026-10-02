-- Algodon Organic admin panel. Run in Supabase SQL Editor before deploying the API.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'manager', 'support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_login_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists admin_login_attempts_lookup_idx
  on public.admin_login_attempts(email_hash, ip_hash, attempted_at desc);

create or replace function public.admin_login_is_locked(p_email_hash text, p_ip_hash text)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select count(*) >= 5 from public.admin_login_attempts
  where email_hash = p_email_hash and ip_hash = p_ip_hash
    and attempted_at > now() - interval '15 minutes';
$$;
create or replace function public.admin_record_login_failure(p_email_hash text, p_ip_hash text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.admin_login_attempts(email_hash, ip_hash) values (p_email_hash, p_ip_hash);
$$;
create or replace function public.admin_clear_login_failures(p_email_hash text, p_ip_hash text)
returns void language sql security definer set search_path = public, pg_temp as $$
  delete from public.admin_login_attempts where email_hash = p_email_hash and ip_hash = p_ip_hash;
$$;
revoke all on function public.admin_login_is_locked(text, text) from public, anon, authenticated;
revoke all on function public.admin_record_login_failure(text, text) from public, anon, authenticated;
revoke all on function public.admin_clear_login_failures(text, text) from public, anon, authenticated;
grant execute on function public.admin_login_is_locked(text, text) to service_role;
grant execute on function public.admin_record_login_failure(text, text) to service_role;
grant execute on function public.admin_clear_login_failures(text, text) to service_role;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  sale_price numeric(12,2) check (sale_price is null or (sale_price >= 0 and sale_price <= price)),
  sku text unique,
  brand text not null default 'Algodon Organic',
  tags text[] not null default '{}',
  variants jsonb not null default '[]'::jsonb,
  category_id uuid references public.categories(id) on delete set null,
  stock_count integer not null default 0 check (stock_count >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  out_of_stock_hidden boolean not null default false,
  images jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  seo_title text not null default '',
  meta_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_published_updated_idx on public.products(published, updated_at desc);
create index if not exists products_name_search_idx on public.products using gin (to_tsvector('simple', name || ' ' || description));

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percentage', 'flat', 'free_shipping')),
  value numeric(12,2) not null default 0 check (value >= 0),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  max_discount numeric(12,2) check (max_discount is null or max_discount >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit >= 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit >= 0),
  product_ids uuid[] not null default '{}',
  category_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  customer_email text not null,
  order_id uuid,
  order_ref text,
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  redeemed_at timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id, redeemed_at desc);
create index if not exists coupon_redemptions_customer_idx on public.coupon_redemptions(coupon_id, lower(customer_email));

-- Order intents already used by the storefront are extended in place.
create table if not exists public.order_intents (
  id uuid primary key default gen_random_uuid(),
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  customer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.order_intents add column if not exists status text not null default 'Pending';
alter table public.order_intents add column if not exists payment_status text not null default 'Pending';
alter table public.order_intents add column if not exists payment_method text not null default '';
alter table public.order_intents add column if not exists tracking_number text not null default '';
alter table public.order_intents add column if not exists courier_name text not null default '';
alter table public.order_intents add column if not exists internal_notes text not null default '';
alter table public.order_intents add column if not exists discount numeric(12,2) not null default 0;
alter table public.order_intents add column if not exists coupon_code text not null default '';
alter table public.order_intents add column if not exists updated_at timestamptz not null default now();
create index if not exists order_intents_created_idx on public.order_intents(created_at desc);
create index if not exists order_intents_status_created_idx on public.order_intents(status, created_at desc);
create index if not exists order_intents_customer_email_idx on public.order_intents ((lower(customer->>'email')));

create table if not exists public.customer_admin_flags (
  email text primary key,
  blocked boolean not null default false,
  note text not null default '',
  updated_at timestamptz not null default now()
);

create or replace view public.customer_admin_summary as
select lower(o.customer->>'email') as email,
       (array_agg(o.customer->>'name' order by o.created_at desc))[1] as name,
       (array_agg(o.customer->>'phone' order by o.created_at desc))[1] as phone,
       count(*)::bigint as orders,
       coalesce(sum(case when coalesce(o.status,'Pending') not in ('Cancelled','Returned','Refunded') then coalesce(o.subtotal,0)-coalesce(o.discount,0) else 0 end),0) as total_spent,
       max(o.created_at) as last_order_at,
       coalesce(jsonb_agg(distinct jsonb_build_object('address1',o.customer->>'address1','address2',o.customer->>'address2','city',o.customer->>'city','state',o.customer->>'state','pin',o.customer->>'pin')) filter (where o.customer->>'address1' is not null), '[]'::jsonb) as addresses,
       coalesce(f.blocked,false) as blocked,
       coalesce(f.note,'') as note
from public.order_intents o
left join public.customer_admin_flags f on lower(f.email)=lower(o.customer->>'email')
where nullif(trim(o.customer->>'email'),'') is not null
group by lower(o.customer->>'email'),f.blocked,f.note;
revoke all on public.customer_admin_summary from public, anon, authenticated;
grant select on public.customer_admin_summary to service_role;

create table if not exists public.admin_activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_activity_logs_created_idx on public.admin_activity_logs(created_at desc);

do $$ declare t text; begin
  foreach t in array array['admin_users','admin_login_attempts','categories','products','coupons','coupon_redemptions','customer_admin_flags','admin_activity_logs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
-- Only the server service-role client accesses admin data; never expose its key to the browser.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('admin-product-images', 'admin-product-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Atomic checkout for catalog products: price, stock, customer blocks and coupon
-- limits are checked in one database transaction, never trusted from the browser.
create or replace function public.storefront_create_order(p_items jsonb, p_customer jsonb, p_coupon_code text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  line jsonb;
  product_row public.products%rowtype;
  coupon_row public.coupons%rowtype;
  order_items jsonb := '[]'::jsonb;
  order_total numeric(12,2) := 0;
  applicable_total numeric(12,2) := 0;
  discount_total numeric(12,2) := 0;
  line_price numeric(12,2);
  line_qty integer;
  line_name text;
  line_size text;
  v_email text := lower(trim(coalesce(p_customer->>'email','')));
  total_uses integer;
  customer_uses integer;
  order_key text;
  variant_idx integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Cart is empty or too large.' using errcode = '22023';
  end if;
  if length(v_email) < 5 or length(v_email) > 320 or length(coalesce(p_customer->>'name','')) < 1 then
    raise exception 'Enter valid customer details.' using errcode = '22023';
  end if;
  if exists (select 1 from public.customer_admin_flags f where lower(f.email) = v_email and f.blocked) then
    raise exception 'This customer account cannot place orders.' using errcode = '42501';
  end if;

  if nullif(trim(p_coupon_code),'') is not null then
    perform pg_advisory_xact_lock(hashtext(upper(trim(p_coupon_code))));
    select * into coupon_row from public.coupons where code = upper(trim(p_coupon_code)) and active for update;
    if not found or (coupon_row.starts_at is not null and coupon_row.starts_at > now()) or (coupon_row.ends_at is not null and coupon_row.ends_at < now()) then
      raise exception 'This coupon is not currently available.' using errcode = '22023';
    end if;
  end if;

  for line in select value from jsonb_array_elements(p_items) loop
    line_qty := (line->>'qty')::integer;
    line_size := coalesce(line->>'size','');
    if line_qty < 1 or line_qty > 100 or length(line_size) > 40 then raise exception 'Invalid product quantity or size.' using errcode = '22023'; end if;
    select * into product_row from public.products where id = (line->>'id')::uuid and published for update;
    if not found then raise exception 'A product in your cart is no longer available.' using errcode = '22023'; end if;
    line_price := coalesce(product_row.sale_price, product_row.price);
    line_name := product_row.name;
    if jsonb_array_length(product_row.variants) > 0 then
      select ordinality::integer into variant_idx from jsonb_array_elements(product_row.variants) with ordinality v
      where v.value->>'size' = line_size limit 1;
      if variant_idx is null then raise exception 'A selected size is no longer available.' using errcode = '22023'; end if;
      if coalesce((product_row.variants->(variant_idx-1)->>'stock')::integer, 0) < line_qty then raise exception 'A selected size is out of stock.' using errcode = '22023'; end if;
      update public.products set variants = jsonb_set(variants, array[(variant_idx-1)::text,'stock'], to_jsonb(((variants->(variant_idx-1)->>'stock')::integer)-line_qty)), stock_count = greatest(0, stock_count-line_qty), updated_at = now() where id = product_row.id;
    else
      if product_row.stock_count < line_qty then raise exception 'A product is out of stock.' using errcode = '22023'; end if;
      update public.products set stock_count = stock_count-line_qty, updated_at = now() where id = product_row.id;
    end if;
    order_total := order_total + line_price * line_qty;
    if nullif(trim(p_coupon_code),'') is null or (cardinality(coupon_row.product_ids)=0 and cardinality(coupon_row.category_ids)=0) or product_row.id = any(coupon_row.product_ids) or product_row.category_id = any(coupon_row.category_ids) then
      applicable_total := applicable_total + line_price * line_qty;
    end if;
    order_items := order_items || jsonb_build_array(jsonb_build_object('id',product_row.id,'name',line_name,'size',line_size,'qty',line_qty,'price',line_price));
  end loop;

  if nullif(trim(p_coupon_code),'') is not null then
    if order_total < coupon_row.minimum_order then raise exception 'Your order does not meet the coupon minimum.' using errcode = '22023'; end if;
    if applicable_total <= 0 then raise exception 'This coupon does not apply to cart items.' using errcode = '22023'; end if;
    select count(*) into total_uses from public.coupon_redemptions where coupon_id = coupon_row.id;
    select count(*) into customer_uses from public.coupon_redemptions where coupon_id = coupon_row.id and lower(customer_email) = v_email;
    if coupon_row.usage_limit is not null and total_uses >= coupon_row.usage_limit then raise exception 'This coupon has reached its usage limit.' using errcode = '22023'; end if;
    if coupon_row.per_customer_limit is not null and customer_uses >= coupon_row.per_customer_limit then raise exception 'You have reached this coupon limit.' using errcode = '22023'; end if;
    if coupon_row.type = 'percentage' then discount_total := applicable_total * coupon_row.value / 100;
    elsif coupon_row.type = 'flat' then discount_total := coupon_row.value;
    end if;
    if coupon_row.max_discount is not null then discount_total := least(discount_total, coupon_row.max_discount); end if;
    discount_total := least(round(discount_total,2), applicable_total);
  end if;

  insert into public.order_intents(items,subtotal,customer,status,payment_status,discount,coupon_code,created_at,updated_at)
    values(order_items,order_total,p_customer,'Pending','Pending',discount_total,coalesce(upper(trim(p_coupon_code)),''),now(),now()) returning id::text into order_key;
  if nullif(trim(p_coupon_code),'') is not null then
    insert into public.coupon_redemptions(coupon_id,customer_email,order_ref,discount_amount) values(coupon_row.id,v_email,order_key,discount_total);
  end if;
  return jsonb_build_object('id',order_key,'items',order_items,'subtotal',order_total,'discount',discount_total,'customer',p_customer,'status','Pending','coupon_code',coalesce(upper(trim(p_coupon_code)),''));
end;
$$;
revoke all on function public.storefront_create_order(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.storefront_create_order(jsonb,jsonb,text) to service_role;

create or replace function public.admin_dashboard_summary(p_from timestamptz, p_to timestamptz)
returns jsonb language sql security definer set search_path = public, pg_temp as $$
with selected_orders as (
  select * from public.order_intents where created_at >= p_from and created_at <= p_to
), customers as (
  select lower(customer->>'email') as email, count(*) as order_count
  from selected_orders where nullif(trim(customer->>'email'),'') is not null group by lower(customer->>'email')
), top_products as (
  select item->>'name' as name, sum(coalesce((item->>'qty')::numeric,0)) as quantity
  from selected_orders o cross join lateral jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) item
  where coalesce(o.status,'Pending') not in ('Cancelled','Returned','Refunded')
  group by item->>'name' order by quantity desc limit 5
), category_sales as (
  select coalesce(c.name,'Uncategorized') as name,
         sum(coalesce((item->>'qty')::numeric,0) * coalesce((item->>'price')::numeric,0)) as amount
  from selected_orders o cross join lateral jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) item
  left join public.products p on p.id::text=item->>'id'
  left join public.categories c on c.id=p.category_id
  where coalesce(o.status,'Pending') not in ('Cancelled','Returned','Refunded')
  group by coalesce(c.name,'Uncategorized') order by amount desc limit 10
)
select jsonb_build_object(
  'kpis', jsonb_build_object(
    'revenue', coalesce((select sum(coalesce(subtotal,0)-coalesce(discount,0)) from selected_orders where coalesce(status,'Pending') not in ('Cancelled','Returned','Refunded')),0),
    'orders', (select count(*) from selected_orders),
    'averageOrderValue', coalesce((select sum(coalesce(subtotal,0)-coalesce(discount,0)) from selected_orders where coalesce(status,'Pending') not in ('Cancelled','Returned','Refunded')) / nullif((select count(*) from selected_orders where coalesce(status,'Pending') not in ('Cancelled','Returned','Refunded')),0),0),
    'newCustomers', (select count(*) from customers),
    'repeatCustomerRate', coalesce((select count(*) filter (where order_count>1)::numeric / nullif(count(*),0) from customers),0)
  ),
  'revenueByDay', coalesce((select jsonb_agg(jsonb_build_object('date', day, 'amount', amount) order by day) from (select created_at::date as day, sum(coalesce(subtotal,0)-coalesce(discount,0)) as amount from selected_orders where coalesce(status,'Pending') not in ('Cancelled','Returned','Refunded') group by created_at::date) d),'[]'::jsonb),
  'ordersByStatus', coalesce((select jsonb_object_agg(status,count) from (select coalesce(status,'Pending') as status,count(*) as count from selected_orders group by coalesce(status,'Pending')) s),'{}'::jsonb),
  'topProducts', coalesce((select jsonb_agg(jsonb_build_object('name',name,'quantity',quantity)) from top_products),'[]'::jsonb),
  'salesByCategory', coalesce((select jsonb_agg(jsonb_build_object('name',name,'amount',amount)) from category_sales),'[]'::jsonb),
  'lowStock', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'stock_count',stock_count,'low_stock_threshold',low_stock_threshold)) from (select id,name,stock_count,low_stock_threshold from public.products where stock_count<=low_stock_threshold order by stock_count asc limit 10) p),'[]'::jsonb)
);
$$;
revoke all on function public.admin_dashboard_summary(timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.admin_dashboard_summary(timestamptz,timestamptz) to service_role;

create or replace function public.admin_reorder_categories(p_items jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then raise exception 'Invalid category order.' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    update public.categories set sort_order=(item->>'sort_order')::integer, updated_at=now() where id=(item->>'id')::uuid;
  end loop;
end;
$$;
revoke all on function public.admin_reorder_categories(jsonb) from public, anon, authenticated;
grant execute on function public.admin_reorder_categories(jsonb) to service_role;
