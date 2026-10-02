-- 03: Supabase Auth profile bootstrap and row-level security.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.prevent_profile_role_escalation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change profile roles.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation before update of role on public.profiles
for each row execute function public.prevent_profile_role_escalation();

do $$ declare t text; begin
  foreach t in array array['profiles','addresses','categories','products','product_variants','product_images','carts','cart_items','wishlists','store_settings','coupons','coupon_products','coupon_categories','coupon_redemptions','orders','order_items','reviews'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Remove these exact names first to make reruns safe.
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
drop policy if exists addresses_owner_all on public.addresses;
drop policy if exists categories_public_read on public.categories;
drop policy if exists categories_admin_write on public.categories;
drop policy if exists products_public_read on public.products;
drop policy if exists products_admin_write on public.products;
drop policy if exists variants_public_read on public.product_variants;
drop policy if exists variants_admin_write on public.product_variants;
drop policy if exists images_public_read on public.product_images;
drop policy if exists images_admin_write on public.product_images;
drop policy if exists carts_owner_all on public.carts;
drop policy if exists cart_items_owner_all on public.cart_items;
drop policy if exists wishlists_owner_all on public.wishlists;
drop policy if exists store_settings_admin_all on public.store_settings;
drop policy if exists coupons_admin_all on public.coupons;
drop policy if exists coupon_products_admin_all on public.coupon_products;
drop policy if exists coupon_categories_admin_all on public.coupon_categories;
drop policy if exists coupon_redemptions_admin_read on public.coupon_redemptions;
drop policy if exists orders_owner_read on public.orders;
drop policy if exists orders_admin_all on public.orders;
drop policy if exists order_items_owner_read on public.order_items;
drop policy if exists order_items_admin_all on public.order_items;
drop policy if exists reviews_public_read on public.reviews;
drop policy if exists reviews_owner_insert on public.reviews;
drop policy if exists reviews_owner_update on public.reviews;
drop policy if exists reviews_owner_delete on public.reviews;
drop policy if exists reviews_admin_all on public.reviews;

create policy profiles_select_self_or_admin on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy profiles_update_self_or_admin on public.profiles for update to authenticated using (id = (select auth.uid()) or public.is_admin()) with check (id = (select auth.uid()) or public.is_admin());

create policy addresses_owner_all on public.addresses for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());

create policy categories_public_read on public.categories for select to anon, authenticated using (is_active or public.is_admin());
create policy categories_admin_write on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_public_read on public.products for select to anon, authenticated using (is_active or public.is_admin());
create policy products_admin_write on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy variants_public_read on public.product_variants for select to anon, authenticated using (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active) or public.is_admin());
create policy variants_admin_write on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy images_public_read on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.is_active) or public.is_admin());
create policy images_admin_write on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy carts_owner_all on public.carts for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy cart_items_owner_all on public.cart_items for all to authenticated using (exists (select 1 from public.carts c where c.id = cart_id and (c.user_id = (select auth.uid()) or public.is_admin()))) with check (exists (select 1 from public.carts c where c.id = cart_id and (c.user_id = (select auth.uid()) or public.is_admin())));
create policy wishlists_owner_all on public.wishlists for all to authenticated using (user_id = (select auth.uid()) or public.is_admin()) with check (user_id = (select auth.uid()) or public.is_admin());
create policy store_settings_admin_all on public.store_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy coupons_admin_all on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coupon_products_admin_all on public.coupon_products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coupon_categories_admin_all on public.coupon_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy coupon_redemptions_admin_read on public.coupon_redemptions for select to authenticated using (public.is_admin());

create policy orders_owner_read on public.orders for select to authenticated using (user_id = (select auth.uid()));
create policy orders_admin_all on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_owner_read on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy order_items_admin_all on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy reviews_public_read on public.reviews for select to anon, authenticated using ((is_approved and exists (select 1 from public.products p where p.id = product_id and p.is_active)) or user_id = (select auth.uid()) or public.is_admin());
create policy reviews_owner_insert on public.reviews for insert to authenticated with check (user_id = (select auth.uid()) and not is_approved);
create policy reviews_owner_update on public.reviews for update to authenticated using (user_id = (select auth.uid()) and not is_approved) with check (user_id = (select auth.uid()) and not is_approved);
create policy reviews_owner_delete on public.reviews for delete to authenticated using (user_id = (select auth.uid()) and not is_approved);
create policy reviews_admin_all on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.categories, public.products, public.product_variants, public.product_images, public.reviews to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses, public.carts, public.cart_items, public.wishlists, public.reviews to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant select, insert, update, delete on public.categories, public.products, public.product_variants, public.product_images, public.coupons, public.coupon_products, public.coupon_categories, public.orders, public.order_items, public.reviews to authenticated;
grant select on public.coupon_redemptions to authenticated;
grant select, update on public.store_settings to authenticated;
