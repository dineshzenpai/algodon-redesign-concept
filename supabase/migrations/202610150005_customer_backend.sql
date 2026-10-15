create table public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 200),
  phone text not null default '' check (length(phone) <= 30),
  addresses jsonb not null default '[]' check (jsonb_typeof(addresses) = 'array' and jsonb_array_length(addresses) <= 10),
  updated_at timestamptz not null default now()
);
create table public.customer_cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null check (length(size) between 1 and 40),
  qty integer not null check (qty between 1 and 100),
  created_at timestamptz not null default now(),
  primary key(user_id, product_id, size)
);
create table public.customer_wishlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, product_id)
);
create table public.newsletter_signups (
  email text primary key check (email = lower(trim(email)) and length(email) between 3 and 320),
  created_at timestamptz not null default now()
);
alter table public.order_intents add column customer_user_id uuid references auth.users(id) on delete set null;
create index order_intents_customer_user_idx on public.order_intents(customer_user_id, created_at desc);
do $$ declare t text; begin
  foreach t in array array['customer_profiles','customer_cart_items','customer_wishlist','newsletter_signups'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

create function public.customer_replace_cart(p_user_id uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user_id is null or p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid cart.' using errcode = '22023';
  end if;
  -- Serialize replacements even when the user has no existing cart rows.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  delete from public.customer_cart_items where user_id = p_user_id;
  insert into public.customer_cart_items(user_id,product_id,size,qty)
  select p_user_id,(item->>'id')::uuid,item->>'size',(item->>'qty')::integer from jsonb_array_elements(p_items) item;
end;
$$;
revoke all on function public.customer_replace_cart(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.customer_replace_cart(uuid,jsonb) to service_role;

create function public.customer_create_order(p_user_id uuid,p_items jsonb,p_customer jsonb,p_coupon_code text default null,p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb; scoped_key text;
begin
  if p_user_id is null then raise exception 'Customer is required.' using errcode='22023'; end if;
  scoped_key := case when p_idempotency_key is null then null
    else 'account:' || p_user_id::text || ':' || encode(sha256(convert_to(p_idempotency_key,'UTF8')),'hex') end;
  if scoped_key is null then
    result := public.storefront_create_order(p_items,p_customer,p_coupon_code);
  else
    result := public.storefront_create_order(p_items,p_customer,p_coupon_code,scoped_key);
  end if;
  update public.order_intents set customer_user_id=p_user_id
    where id=(result->>'id')::uuid and (customer_user_id is null or customer_user_id=p_user_id);
  if not found then raise exception 'Order ownership conflict.' using errcode='42501'; end if;
  return result;
end;
$$;
revoke all on function public.customer_create_order(uuid,jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.customer_create_order(uuid,jsonb,jsonb,text,text) to service_role;
