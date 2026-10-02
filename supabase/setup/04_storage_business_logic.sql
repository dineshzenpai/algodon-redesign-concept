-- 04: Secure product image storage, atomic cart/order functions, and reporting views.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
drop policy if exists product_images_admin_insert on storage.objects;
drop policy if exists product_images_admin_update on storage.objects;
drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
create policy product_images_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_admin_update on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());

create or replace function public.add_to_cart(p_variant_id uuid, p_quantity integer default 1)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_cart_id uuid; v_stock integer; v_existing integer;
begin
  if v_user_id is null then raise exception 'Sign in to add items to your cart.' using errcode = '28000'; end if;
  if p_quantity < 1 or p_quantity > 100 then raise exception 'Quantity must be between 1 and 100.' using errcode = '22023'; end if;
  select v.stock into v_stock from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = p_variant_id and v.is_active and p.is_active for update of v;
  if not found then raise exception 'This product option is unavailable.' using errcode = '22023'; end if;
  insert into public.carts(user_id) values (v_user_id) on conflict (user_id) do update set updated_at = now() returning id into v_cart_id;
  select quantity into v_existing from public.cart_items where cart_id = v_cart_id and variant_id = p_variant_id for update;
  if coalesce(v_existing,0) + p_quantity > v_stock then raise exception 'There is not enough stock for this quantity.' using errcode = '22023'; end if;
  insert into public.cart_items(cart_id, variant_id, quantity) values (v_cart_id,p_variant_id,p_quantity)
    on conflict (cart_id,variant_id) do update set quantity = public.cart_items.quantity + excluded.quantity, updated_at = now();
  return v_cart_id;
end;
$$;
revoke all on function public.add_to_cart(uuid,integer) from public, anon;
grant execute on function public.add_to_cart(uuid,integer) to authenticated;

create or replace function public.place_order(p_address_id uuid, p_coupon_code text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_cart_id uuid; v_order_id uuid; v_address jsonb;
  v_subtotal numeric(10,2) := 0; v_discount numeric(10,2) := 0; v_shipping numeric(10,2) := 0;
  v_shipping_discount numeric(10,2) := 0; v_tax numeric(10,2) := 0; v_tax_rate numeric(5,2) := 0; v_currency char(3) := 'INR';
  v_coupon public.coupons%rowtype; v_coupon_id uuid; v_code text := nullif(upper(trim(p_coupon_code)), '');
  v_total_uses integer; v_user_uses integer; v_eligible_count integer; v_cart_lines integer; v_valid_lines integer;
  v_eligible_subtotal numeric(10,2); v_email text; v_line record;
begin
  if v_user_id is null then raise exception 'Sign in before placing an order.' using errcode = '28000'; end if;
  select to_jsonb(a) - 'user_id' into v_address from public.addresses a where a.id = p_address_id and a.user_id = v_user_id;
  if v_address is null then raise exception 'Choose one of your saved addresses.' using errcode = '22023'; end if;
  select id into v_cart_id from public.carts where user_id = v_user_id for update;
  if v_cart_id is null or not exists (select 1 from public.cart_items where cart_id = v_cart_id) then raise exception 'Your cart is empty.' using errcode = '22023'; end if;
  select count(*) into v_cart_lines from public.cart_items where cart_id=v_cart_id;
  select count(*) into v_valid_lines from public.cart_items ci join public.product_variants v on v.id=ci.variant_id
    join public.products p on p.id=v.product_id where ci.cart_id=v_cart_id and v.is_active and p.is_active;
  if v_valid_lines <> v_cart_lines then raise exception 'One or more cart items are no longer available.' using errcode = '22023'; end if;
  select currency,shipping_fee,tax_rate into v_currency,v_shipping,v_tax_rate from public.store_settings where singleton=true;

  -- Lock every selected stock row in stable ID order before validating or decrementing stock.
  perform v.id from public.product_variants v join public.cart_items ci on ci.variant_id = v.id
    where ci.cart_id = v_cart_id order by v.id for update of v;
  for v_line in
    select ci.quantity, v.id variant_id, v.product_id, v.sku, v.size, v.color, v.stock,
           coalesce(v.price_override,p.price) unit_price, p.name product_name, p.category_id
    from public.cart_items ci join public.product_variants v on v.id = ci.variant_id
    join public.products p on p.id = v.product_id
    where ci.cart_id = v_cart_id and v.is_active and p.is_active order by v.id
  loop
    if v_line.stock < v_line.quantity then raise exception 'Insufficient stock for % (%).', v_line.product_name, v_line.size using errcode = '22023'; end if;
    v_subtotal := v_subtotal + v_line.unit_price * v_line.quantity;
  end loop;
  if v_subtotal <= 0 then raise exception 'Your cart has no available products.' using errcode = '22023'; end if;

  if v_code is not null then
    perform pg_advisory_xact_lock(hashtext(v_code));
    select * into v_coupon from public.coupons c where upper(c.code) = v_code and c.is_active for update;
    if not found or (v_coupon.starts_at is not null and v_coupon.starts_at > now()) or (v_coupon.ends_at is not null and v_coupon.ends_at < now()) then
      raise exception 'This coupon is not currently available.' using errcode = '22023';
    end if;
    if v_subtotal < v_coupon.minimum_order then raise exception 'Your order does not meet this coupon minimum.' using errcode = '22023'; end if;
    select count(*) into v_total_uses from public.coupon_redemptions where coupon_id = v_coupon.id;
    select count(*) into v_user_uses from public.coupon_redemptions where coupon_id = v_coupon.id and user_id = v_user_id;
    if v_coupon.usage_limit is not null and v_total_uses >= v_coupon.usage_limit then raise exception 'This coupon has reached its usage limit.' using errcode = '22023'; end if;
    if v_user_uses >= v_coupon.per_customer_limit then raise exception 'You have already used this coupon the maximum number of times.' using errcode = '22023'; end if;
    select count(*) into v_eligible_count
      from public.cart_items ci join public.product_variants v on v.id=ci.variant_id join public.products p on p.id=v.product_id
      where ci.cart_id=v_cart_id and (not exists(select 1 from public.coupon_products cp where cp.coupon_id=v_coupon.id)
        and not exists(select 1 from public.coupon_categories cc where cc.coupon_id=v_coupon.id)
        and cardinality(v_coupon.product_ids)=0 and cardinality(v_coupon.category_ids)=0
        or exists(select 1 from public.coupon_products cp where cp.coupon_id=v_coupon.id and cp.product_id=p.id)
        or exists(select 1 from public.coupon_categories cc where cc.coupon_id=v_coupon.id and cc.category_id=p.category_id)
        or p.id=any(v_coupon.product_ids) or p.category_id=any(v_coupon.category_ids));
    if v_eligible_count = 0 then raise exception 'This coupon does not apply to items in your cart.' using errcode = '22023'; end if;
    select coalesce(sum(coalesce(v.price_override,p.price)*ci.quantity),0) into v_eligible_subtotal
      from public.cart_items ci join public.product_variants v on v.id=ci.variant_id join public.products p on p.id=v.product_id
      where ci.cart_id=v_cart_id and (not exists(select 1 from public.coupon_products cp where cp.coupon_id=v_coupon.id)
        and not exists(select 1 from public.coupon_categories cc where cc.coupon_id=v_coupon.id)
        and cardinality(v_coupon.product_ids)=0 and cardinality(v_coupon.category_ids)=0
        or exists(select 1 from public.coupon_products cp where cp.coupon_id=v_coupon.id and cp.product_id=p.id)
        or exists(select 1 from public.coupon_categories cc where cc.coupon_id=v_coupon.id and cc.category_id=p.category_id)
        or p.id=any(v_coupon.product_ids) or p.category_id=any(v_coupon.category_ids));
    if v_coupon.discount_type = 'percentage' then
      v_discount := v_eligible_subtotal * v_coupon.discount_value / 100;
      if v_coupon.maximum_discount is not null then v_discount := least(v_discount,v_coupon.maximum_discount); end if;
    elsif v_coupon.discount_type = 'fixed' then
      v_discount := least(v_coupon.discount_value,v_eligible_subtotal);
    elsif v_coupon.discount_type = 'free_shipping' then
      v_shipping_discount := v_shipping;
      v_shipping := 0;
    end if;
    v_discount := least(v_discount,v_subtotal);
    v_coupon_id := v_coupon.id;
  end if;

  v_tax := round(greatest(0,v_subtotal-v_discount) * v_tax_rate / 100,2);
  insert into public.orders(user_id,address_snapshot,currency,subtotal,discount_amount,shipping_amount,tax_amount,total,coupon_id)
  values(v_user_id,v_address,v_currency,v_subtotal,v_discount+v_shipping_discount,v_shipping,v_tax,greatest(0,v_subtotal-v_discount+v_shipping+v_tax),v_coupon_id)
  returning id into v_order_id;

  for v_line in
    select ci.quantity, v.id variant_id, v.product_id, v.sku, v.size, v.color, v.stock,
           coalesce(v.price_override,p.price) unit_price, p.name product_name
    from public.cart_items ci join public.product_variants v on v.id=ci.variant_id join public.products p on p.id=v.product_id
    where ci.cart_id=v_cart_id and v.is_active and p.is_active order by v.id
  loop
    update public.product_variants set stock=stock-v_line.quantity, updated_at=now() where id=v_line.variant_id;
    insert into public.order_items(order_id,product_id,variant_id,product_name,sku,size,color,quantity,unit_price,line_total)
    values(v_order_id,v_line.product_id,v_line.variant_id,v_line.product_name,v_line.sku,v_line.size,v_line.color,v_line.quantity,v_line.unit_price,v_line.unit_price*v_line.quantity);
  end loop;
  if v_coupon_id is not null then
    select email into v_email from auth.users where id=v_user_id;
    insert into public.coupon_redemptions(coupon_id,user_id,customer_email,order_id,commerce_order_id,order_ref,discount_amount,redeemed_at,created_at)
    values(v_coupon_id,v_user_id,coalesce(v_email,''),v_order_id,v_order_id,v_order_id::text,v_discount+v_shipping_discount,now(),now());
  end if;
  delete from public.cart_items where cart_id=v_cart_id;
  return v_order_id;
end;
$$;
revoke all on function public.place_order(uuid,text) from public, anon;
grant execute on function public.place_order(uuid,text) to authenticated;

create or replace view public.low_stock_variants with (security_invoker = true) as
select v.id variant_id, v.product_id, p.name product_name, p.slug, v.size, v.color, v.sku, v.stock
from public.product_variants v join public.products p on p.id=v.product_id
where v.is_active and p.is_active and v.stock <= 5 and public.is_admin();
create or replace view public.sales_summary with (security_invoker = true) as
select date_trunc('day',o.created_at)::date sale_date, o.currency, count(*) order_count,
       coalesce(sum(o.total) filter (where o.status not in ('cancelled','returned','refunded')),0)::numeric(10,2) gross_sales,
       coalesce(sum(o.discount_amount),0)::numeric(10,2) discounts
from public.orders o where public.is_admin() group by date_trunc('day',o.created_at)::date,o.currency;
grant select on public.low_stock_variants, public.sales_summary to authenticated;
