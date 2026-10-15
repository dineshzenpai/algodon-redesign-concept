-- Validate changes against the locked row, so partial edits cannot corrupt stock.
create function public.admin_update_product(p_id uuid,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare current_row public.products%rowtype; next_row public.products%rowtype; columns text;
begin
  if p_patch is null or jsonb_typeof(p_patch)<>'object' or exists (
    select 1 from jsonb_object_keys(p_patch) k where k not in ('name','slug','description','price','sale_price','sku','brand','tags','variants','category_id','stock_count','low_stock_threshold','out_of_stock_hidden','images','published','seo_title','meta_description')
  ) then raise exception 'Invalid product fields.' using errcode='22023'; end if;
  select * into current_row from public.products where id=p_id for update;
  if not found then return null; end if;
  next_row := jsonb_populate_record(current_row,p_patch);
  if next_row.sale_price > next_row.price then raise exception 'Sale price cannot exceed regular price.' using errcode='22023'; end if;
  if jsonb_typeof(next_row.variants)<>'array' or (jsonb_array_length(next_row.variants)>0 and next_row.stock_count<>(select coalesce(sum((v->>'stock')::integer),0) from jsonb_array_elements(next_row.variants) v)) then
    raise exception 'Product stock must equal the sum of variant stock.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(next_row.variants) v group by v->>'size' having count(*)>1) then
    raise exception 'Variant sizes must be unique.' using errcode='22023';
  end if;
  select string_agg(quote_ident(key),',') into columns from jsonb_object_keys(p_patch) key;
  if columns is null then raise exception 'Provide product fields to update.' using errcode='22023'; end if;
  execute format('update public.products set (%s) = (select %s from jsonb_populate_record(null::public.products,$1)), updated_at=now() where id=$2 returning to_jsonb(products.*)',columns,columns)
    into p_patch using to_jsonb(next_row),p_id;
  return p_patch;
end;
$$;
revoke all on function public.admin_update_product(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_product(uuid,jsonb) to service_role;

create function public.admin_bulk_stock(p_items jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare item jsonb; product public.products%rowtype; variants jsonb; n integer; stock integer; updated integer:=0;
begin
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 500 then raise exception 'Invalid stock update.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) i group by i->>'id' having count(*)>1) then raise exception 'Duplicate product IDs.' using errcode='22023'; end if;
  perform id from public.products where id in(select (i->>'id')::uuid from jsonb_array_elements(p_items) i) order by id for update;
  for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
    stock := (item->>'stock_count')::integer;
    if stock is null or stock<0 then raise exception 'Stock must be non-negative.' using errcode='22023'; end if;
    select * into product from public.products where id=(item->>'id')::uuid;
    if not found then raise exception 'A selected product was not found.' using errcode='22023'; end if;
    n := jsonb_array_length(product.variants);
    select coalesce(jsonb_agg(value || jsonb_build_object('stock',stock/greatest(n,1)+case when ordinality<=stock%greatest(n,1) then 1 else 0 end) order by ordinality),'[]') into variants from jsonb_array_elements(product.variants) with ordinality;
    perform public.admin_update_product(product.id,jsonb_build_object('stock_count',stock,'variants',variants));
    updated := updated+1;
  end loop;
  return updated;
end;
$$;
revoke all on function public.admin_bulk_stock(jsonb) from public, anon, authenticated;
grant execute on function public.admin_bulk_stock(jsonb) to service_role;

alter table public.coupons add constraint coupon_percentage_range check(type<>'percentage' or value<=100) not valid;
alter table public.coupons add constraint coupon_date_range check(starts_at is null or ends_at is null or starts_at<ends_at) not valid;
