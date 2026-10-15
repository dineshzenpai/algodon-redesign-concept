import { useState } from 'react';
import { safeImageUrl } from '../shared/safety.js';

function ProductCard({product,s}) {
  const [selected,setSelected] = useState(''), [hint,setHint] = useState(''), [saved,setSaved] = useState(false), [saving,setSaving] = useState(false);
  const price=Number(product.sale_price ?? product.price), was=product.was ?? (product.sale_price != null && product.sale_price < product.price ? product.price : null);
  const sizes=product.variants?.length ? product.variants.map(item => item.size) : ['S','M','L','XL'];
  const image=safeImageUrl(product.images?.[0]) || '/img/product-golden-brown.jpg';
  async function save() {
    if (!s.user) { s.openAccount(); s.notify('Sign in to save products to your wishlist.'); return; }
    setSaving(true);
    try { await s.accountFetch('/api/account/wishlist/'+encodeURIComponent(product.id),{method:'PUT'}); setSaved(true); }
    catch(error) { setHint(error.message); } finally { setSaving(false); }
  }
  return <article className="card" id={'product-'+product.id} data-product={product.id} data-name={product.name} data-price={price} data-img={image}>
    <figure>{product.badge && <span className="badge-sale">{product.badge}</span>}<img src={image} alt={product.alt || product.name} /></figure>
    <div className="card-body"><span className="eyebrow">{product.brand || 'Algodon Organic'}</span><h3>{product.name}</h3>
      <div className="price-row">{was && <span className="was">{s.money(was)}</span>}<span className="now">{s.money(price)}</span></div>
      <div className="size-row" role="group" aria-label="Select size">{sizes.map(size => <button className={'size-chip'+(selected === size ? ' active' : '')} type="button" key={size} aria-pressed={selected === size} disabled={!product.concept && product.variants?.length > 0 && !product.variants.find(variant => variant.size === size)?.stock} onClick={() => { setSelected(size); setHint(''); }}>{size}</button>)}</div>
      <div className="size-hint" role="status">{hint}</div><button className="add-btn" type="button" disabled={product.concept || product.stock_count <= 0} onClick={() => setHint(selected ? s.addProduct(product,selected) : 'Pick a size first')}>{product.concept ? 'Coming soon' : product.stock_count <= 0 ? 'Out of Stock' : 'Add to Cart'}</button>
      {!product.concept && <button type="button" className="btn btn-ghost" disabled={saved || saving} onClick={save}>{saved ? 'Saved to wishlist' : 'Save to wishlist'}</button>}
    </div>
  </article>;
}
export function Catalog({s}) {
  return <section id="edit"><div className="section-head"><div><span className="eyebrow">The Print Edit</span><h2>Four motifs, one weave.</h2></div><a href="#edit" className="viewall">View all prints →</a></div><div className="grid" id="productGrid">{s.products.map(product => <ProductCard key={product.id} product={product} s={s} />)}</div></section>;
}
export function Search({s}) {
  const [query,setQuery] = useState('');
  const matches=s.products.filter(product => product.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="search-overlay" id="searchOverlay" hidden={s.panel !== 'search'} role="dialog" aria-modal="true" aria-label="Search the Print Edit">
    <div className="search-overlay-head"><span className="eyebrow">Search the Print Edit</span><button className="icon-btn" id="searchClose" aria-label="Close search" onClick={s.close}>Close ✕</button></div>
    <input type="text" id="searchInput" placeholder={'Try “jali” or “swirl”…'} autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} />
    <div className="search-results" id="searchResults">{matches.length ? matches.map(product => <button type="button" key={product.id} onClick={() => { s.close(); document.getElementById('product-'+product.id)?.scrollIntoView({behavior:'smooth',block:'center'}); }}><img src={safeImageUrl(product.images?.[0]) || '/img/product-golden-brown.jpg'} alt="" /><span>{product.name} — {s.money(product.sale_price ?? product.price)}</span></button>) : <p className="empty">No prints match “{query}”.</p>}</div>
  </div>;
}
