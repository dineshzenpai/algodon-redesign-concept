-- Forward-only checkout corrections; variant labels are case-sensitive.
create or replace function public.storefront_create_order(p_items jsonb, p_customer jsonb, p_coupon_code text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item_elem jsonb;
  agg_record record;
  product_row public.products%rowtype;
  coupon_row public.coupons%rowtype;
  order_items jsonb := '[]'::jsonb;
  order_total numeric(12,2) := 0;
  applicable_total numeric(12,2) := 0;
  discount_total numeric(12,2) := 0;
  line_price numeric(12,2);
  v_email text := lower(trim(coalesce(p_customer->>'email','')));
  total_uses integer;
  customer_uses integer;
  order_key text;
  variant_idx integer;
  curr_variant_stock integer;
  item_id_text text;
  item_size text;
  item_qty integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Cart is empty or too large.' using errcode = '22023';
  end if;
  if length(v_email) < 5 or length(v_email) > 320 or length(coalesce(p_customer->>'name','')) < 1 then
    raise exception 'Enter valid customer details.' using errcode = '22023';
  end if;
  if exists (select 1 from public.customer_admin_flags f where lower(f.email) = v_email and f.blocked) then
    raise exception 'This customer account cannot place orders.' using errcode = '42501';
  end if;

  -- 1. Validate all line items structure, UUID format, and types before acquiring locks
  for item_elem in select value from jsonb_array_elements(p_items) loop
    item_id_text := coalesce(item_elem->>'id', '');
    item_size := coalesce(item_elem->>'size', '');
    if jsonb_typeof(item_elem->'qty') is distinct from 'number' or coalesce(item_elem->>'qty', '') !~ '^[0-9]{1,3}$' then
      raise exception 'Invalid product quantity.' using errcode = '22023';
    end if;
    item_qty := (item_elem->>'qty')::integer;
    if item_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid product identifier.' using errcode = '22023';
    end if;
    if item_qty < 1 or item_qty > 100 or length(trim(item_size)) < 1 or length(item_size) > 40 then
      raise exception 'Invalid product quantity or size.' using errcode = '22023';
    end if;
  end loop;

  -- 2. If coupon supplied, acquire advisory transaction lock on coupon hash to prevent race conditions
  if nullif(trim(p_coupon_code),'') is not null then
    perform pg_advisory_xact_lock(hashtext(upper(trim(p_coupon_code))));
    select * into coupon_row from public.coupons where code = upper(trim(p_coupon_code)) and active for update;
    if not found or (coupon_row.starts_at is not null and coupon_row.starts_at > now()) or (coupon_row.ends_at is not null and coupon_row.ends_at < now()) then
      raise exception 'This coupon is not currently available.' using errcode = '22023';
    end if;
  end if;

  -- 3. Deterministic row locking: Lock all distinct products in ascending UUID order
  -- This eliminates deadlocks between concurrent checkouts ordering the same products in different sequence.
  perform 1 from public.products
  where id in (
    select distinct (val->>'id')::uuid
    from jsonb_array_elements(p_items) as val
  ) and published
  order by id asc
  for update;

  -- 4. Process items aggregated by product and size to handle repeated cart lines safely
  for agg_record in
    select
      (val->>'id')::uuid as product_id,
      coalesce(val->>'size', '') as size,
      sum((val->>'qty')::integer)::integer as total_qty
    from jsonb_array_elements(p_items) as val
    group by (val->>'id')::uuid, coalesce(val->>'size', '')
    order by (val->>'id')::uuid asc, coalesce(val->>'size', '') asc
  loop
    select * into product_row from public.products where id = agg_record.product_id and published for update;
    if not found then
      raise exception 'A product in your cart is no longer available.' using errcode = '22023';
    end if;

    line_price := coalesce(product_row.sale_price, product_row.price);

    if jsonb_array_length(product_row.variants) > 0 then
      select ordinality::integer into variant_idx
      from jsonb_array_elements(product_row.variants) with ordinality v
      where v.value->>'size' = agg_record.size limit 1;

      if variant_idx is null then
        raise exception 'A selected size is no longer available.' using errcode = '22023';
      end if;

      curr_variant_stock := coalesce((product_row.variants->(variant_idx - 1)->>'stock')::integer, 0);
      if curr_variant_stock < agg_record.total_qty then
        raise exception 'A selected size is out of stock.' using errcode = '22023';
      end if;

      if product_row.stock_count < agg_record.total_qty then
        raise exception 'A product is out of stock.' using errcode = '22023';
      end if;

      update public.products
      set variants = jsonb_set(
            variants,
            array[(variant_idx - 1)::text, 'stock'],
            to_jsonb(curr_variant_stock - agg_record.total_qty)
          ),
          stock_count = stock_count - agg_record.total_qty,
          updated_at = now()
      where id = product_row.id;
    else
      if product_row.stock_count < agg_record.total_qty then
        raise exception 'A product is out of stock.' using errcode = '22023';
      end if;

      update public.products
      set stock_count = stock_count - agg_record.total_qty,
          updated_at = now()
      where id = product_row.id;
    end if;

    order_total := order_total + line_price * agg_record.total_qty;

    if nullif(trim(p_coupon_code),'') is null
       or ((cardinality(coupon_row.product_ids) = 0 or product_row.id = any(coupon_row.product_ids))
           and (cardinality(coupon_row.category_ids) = 0 or product_row.category_id = any(coupon_row.category_ids))) then
      applicable_total := applicable_total + line_price * agg_record.total_qty;
    end if;

    order_items := order_items || jsonb_build_array(
      jsonb_build_object(
        'id', product_row.id,
        'name', product_row.name,
        'size', agg_record.size,
        'qty', agg_record.total_qty,
        'price', line_price
      )
    );
  end loop;

  -- 5. Validate coupon limits & discount calculation
  if nullif(trim(p_coupon_code),'') is not null then
    if order_total < coupon_row.minimum_order then
      raise exception 'Your order does not meet the coupon minimum.' using errcode = '22023';
    end if;
    if applicable_total <= 0 then
      raise exception 'This coupon does not apply to cart items.' using errcode = '22023';
    end if;

    select count(*) into total_uses from public.coupon_redemptions where coupon_id = coupon_row.id;
    select count(*) into customer_uses from public.coupon_redemptions where coupon_id = coupon_row.id and lower(customer_email) = v_email;

    if coupon_row.usage_limit is not null and total_uses >= coupon_row.usage_limit then
      raise exception 'This coupon has reached its usage limit.' using errcode = '22023';
    end if;
    if coupon_row.per_customer_limit is not null and customer_uses >= coupon_row.per_customer_limit then
      raise exception 'You have reached this coupon limit.' using errcode = '22023';
    end if;

    if coupon_row.type = 'percentage' then
      discount_total := applicable_total * coupon_row.value / 100;
    elsif coupon_row.type = 'flat' then
      discount_total := coupon_row.value;
    end if;

    if coupon_row.max_discount is not null then
      discount_total := least(discount_total, coupon_row.max_discount);
    end if;
    discount_total := least(round(discount_total, 2), applicable_total);
  end if;

  -- 6. Insert order intent
  insert into public.order_intents(items, subtotal, customer, status, payment_status, discount, coupon_code, created_at, updated_at)
  values(order_items, order_total, p_customer, 'Pending', 'Pending', discount_total, coalesce(upper(trim(p_coupon_code)), ''), now(), now())
  returning id::text into order_key;

  -- 7. Record coupon redemption atomically
  if nullif(trim(p_coupon_code),'') is not null then
    insert into public.coupon_redemptions(coupon_id, customer_email, order_ref, discount_amount)
    values(coupon_row.id, v_email, order_key, discount_total);
  end if;

  return jsonb_build_object(
    'id', order_key,
    'items', order_items,
    'subtotal', order_total,
    'discount', discount_total,
    'customer', p_customer,
    'status', 'Pending',
    'coupon_code', coalesce(upper(trim(p_coupon_code)), '')
  );
end;
$$;

revoke all on function public.storefront_create_order(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.storefront_create_order(jsonb,jsonb,text) to service_role;

-- No automatic expiry: a committed key must never silently become a new order.
create table public.checkout_idempotency (
  key text primary key check (key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'),
  request_hash bytea not null,
  result jsonb,
  created_at timestamptz not null default now()
);
alter table public.checkout_idempotency enable row level security;
revoke all on public.checkout_idempotency from public, anon, authenticated, service_role;

create function public.storefront_create_order(p_items jsonb, p_customer jsonb, p_coupon_code text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  canonical_items jsonb;
  fingerprint bytea;
  saved public.checkout_idempotency%rowtype;
  response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' then
    raise exception 'Invalid Idempotency-Key.' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Cart is empty or too large.' using errcode = '22023';
  end if;
  -- Canonicalize order/duplicates, UUID case, and coupon case. Never fingerprint prices.
  select jsonb_agg(jsonb_build_object('id', id, 'size', size, 'qty', qty) order by id, size)
  into canonical_items from (
    select (value->>'id')::uuid as id, value->>'size' as size, sum((value->>'qty')::numeric) as qty
    from jsonb_array_elements(p_items) group by 1,2
  ) lines;
  fingerprint := sha256(convert_to(jsonb_build_object('items', canonical_items, 'customer', p_customer,
    'coupon', upper(trim(coalesce(p_coupon_code,''))))::text, 'UTF8'));
  -- Unique-index arbitration waits for the other transaction to commit or roll back.
  insert into public.checkout_idempotency(key, request_hash) values (p_idempotency_key, fingerprint)
  on conflict (key) do nothing;
  select * into saved from public.checkout_idempotency where key = p_idempotency_key for update;
  if saved.request_hash <> fingerprint then
    raise exception 'Idempotency-Key already used for a different checkout request.' using errcode = 'P4090';
  end if;
  if saved.result is not null then return saved.result; end if;
  response := public.storefront_create_order(p_items, p_customer, p_coupon_code);
  update public.checkout_idempotency set result = response where key = p_idempotency_key;
  return response;
end;
$$;
revoke all on function public.storefront_create_order(jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.storefront_create_order(jsonb,jsonb,text,text) to service_role;
