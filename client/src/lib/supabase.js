import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export async function listProducts(filters = {}) {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env.');
  let query = supabase
    .from('products')
    .select('id,name,slug,description,price,compare_at_price,fit,fabric,occasion,care_instructions,size_chart,categories!inner(name,slug),product_images(id,image_url,alt_text,sort_order,is_primary),product_variants!inner(id,size,color,sku,stock,price_override,is_active)')
    .eq('is_active', true)
    .eq('product_variants.is_active', true)
    .order('created_at', { ascending: false });

  if (filters.category) query = query.eq('categories.slug', filters.category);
  if (filters.size) query = query.eq('product_variants.size', filters.size);
  if (filters.color) query = query.eq('product_variants.color', filters.color);
  if (filters.fit) query = query.eq('fit', filters.fit);
  if (Number.isFinite(filters.minPrice)) query = query.gte('price', filters.minPrice);
  if (Number.isFinite(filters.maxPrice)) query = query.lte('price', filters.maxPrice);
  if (filters.inStock) query = query.gt('product_variants.stock', 0);
  if (Number.isInteger(filters.limit)) query = query.limit(Math.min(Math.max(filters.limit, 1), 100));

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getProductBySlug(slug) {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env.');
  const { data, error } = await supabase
    .from('products')
    .select('*,categories(name,slug),product_images(id,image_url,alt_text,sort_order,is_primary),product_variants(id,size,color,sku,stock,price_override,is_active)')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('product_variants.is_active', true)
    .order('sort_order', { referencedTable: 'product_images', ascending: true })
    .single();
  if (error) throw error;
  return data;
}

export async function addToCart(variantId, quantity = 1) {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env.');
  const { data, error } = await supabase.rpc('add_to_cart', {
    p_variant_id: variantId,
    p_quantity: quantity
  });
  if (error) throw error;
  return data;
}

export async function placeOrder(addressId, couponCode = null) {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env.');
  const { data, error } = await supabase.rpc('place_order', {
    p_address_id: addressId,
    p_coupon_code: couponCode
  });
  if (error) throw error;
  return data;
}
