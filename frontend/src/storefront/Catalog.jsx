import { useState } from 'react';
import { safeImageUrl } from '../shared/safety.js';

export function ProductCard({product, s}) {
  const [selected, setSelected] = useState('');
  const [hint, setHint] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const price = Number(product.sale_price ?? product.price);
  const was = product.was ?? (product.sale_price != null && product.sale_price < product.price ? product.price : null);
  const sizes = product.variants?.length ? product.variants.map(item => item.size) : ['S','M','L','XL'];
  const image = safeImageUrl(product.images?.[0]) || '/img/product-golden-brown.jpg';

  async function save() {
    if (!s.user) {
      s.openAccount();
      s.notify('Sign in to save products to your wishlist.');
      return;
    }
    setSaving(true);
    try {
      await s.accountFetch('/api/account/wishlist/' + encodeURIComponent(product.id), { method: 'PUT' });
      setSaved(true);
      s.notify(`Added ${product.name} to your wishlist.`);
    } catch(error) {
      setHint(error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleAddToCart() {
    if (!selected) {
      setHint('Please pick a size first');
      return;
    }
    const err = s.addProduct(product, selected);
    if (err) setHint(err);
    else setHint('');
  }

  return (
    <article className="card" id={'product-' + product.id} data-product={product.id} data-name={product.name} data-price={price} data-img={image}>
      <figure onClick={() => s.openProductModal?.(product)} style={{ cursor: 'pointer' }} title="Click to view full product details">
        {product.badge && <span className="badge-sale">{product.badge}</span>}
        <img src={image} alt={product.alt || product.name} loading="lazy" />
      </figure>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="eyebrow">{product.brand || 'Algodon Organic'}</span>
          {product.rating && (
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              ★ {product.rating} <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>({product.ratingCount || 120})</span>
            </span>
          )}
        </div>
        <h3 onClick={() => s.openProductModal?.(product)} style={{ cursor: 'pointer' }} title="Click to view details">
          {product.name}
        </h3>
        <div className="price-row">
          {was && <span className="was">{s.money(was)}</span>}
          <span className="now">{s.money(price)}</span>
        </div>
        <div className="size-row" role="group" aria-label="Select size">
          {sizes.map(size => (
            <button
              className={'size-chip' + (selected === size ? ' active' : '')}
              type="button"
              key={size}
              aria-pressed={selected === size}
              onClick={() => { setSelected(size); setHint(''); }}
            >
              {size}
            </button>
          ))}
        </div>
        <div className="size-hint" role="status">{hint}</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <button
            className="add-btn"
            type="button"
            style={{ flex: 1 }}
            disabled={product.stock_count <= 0}
            onClick={handleAddToCart}
          >
            {product.stock_count <= 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0 12px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
            onClick={() => s.openProductModal?.(product)}
            title="View specifications, fabric details, size chart and reviews"
          >
            Details ↗
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--ink-soft)', border: 'none', padding: '4px' }}
          disabled={saved || saving}
          onClick={save}
        >
          {saved ? '✓ Saved to wishlist' : '♡ Save to wishlist'}
        </button>
      </div>
    </article>
  );
}

export function ProductDetailModal({s}) {
  const product = s.activeProduct;
  const [selectedSize, setSelectedSize] = useState('M');
  const [activeTab, setActiveTab] = useState('specs'); // 'specs' | 'craft' | 'reviews'
  const [modalHint, setModalHint] = useState('');

  if (!product) return null;

  const price = Number(product.sale_price ?? product.price);
  const was = product.was ?? (product.sale_price != null && product.sale_price < product.price ? product.price : null);
  const image = safeImageUrl(product.images?.[0]) || '/img/product-golden-brown.jpg';
  const variants = product.variants || [
    { size: 'S', stock: 15, chest: '38"', length: '28.5"', sleeve: '24"' },
    { size: 'M', stock: 18, chest: '40"', length: '29.5"', sleeve: '24.5"' },
    { size: 'L', stock: 12, chest: '42"', length: '30.5"', sleeve: '25"' },
    { size: 'XL', stock: 10, chest: '44"', length: '31.5"', sleeve: '25.5"' }
  ];
  const currentVariant = variants.find(v => v.size === selectedSize) || variants[0];

  function handleAddToCart() {
    const err = s.addProduct(product, selectedSize);
    if (err) setModalHint(err);
    else {
      setModalHint('');
      s.closeProductModal();
    }
  }

  function handleBuyNow() {
    const err = s.addProduct(product, selectedSize);
    if (err) setModalHint(err);
    else {
      s.closeProductModal();
      s.open('cart');
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 120 }}
      onClick={e => { if (e.target === e.currentTarget) s.closeProductModal(); }}
    >
      <div
        className="modal"
        style={{
          maxWidth: '960px',
          width: '95%',
          maxHeight: '92vh',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '28px',
          padding: '28px',
          overflowY: 'auto',
          position: 'relative',
          background: 'var(--surface)',
          borderRadius: '10px',
          border: '1px solid var(--line-strong)'
        }}
      >
        <button
          className="icon-btn"
          aria-label="Close product details"
          onClick={s.closeProductModal}
          style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, background: 'var(--card)', borderRadius: '50%', padding: '6px 10px' }}
        >
          ✕
        </button>

        {/* Product Media Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ borderRadius: '8px', overflow: 'hidden', background: 'var(--card)', position: 'relative' }}>
            {product.badge && <span className="badge-sale" style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>{product.badge}</span>}
            <img src={image} alt={product.alt || product.name} style={{ width: '100%', height: '420px', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ border: '2px solid var(--accent)', borderRadius: '6px', overflow: 'hidden', width: '64px', height: '76px' }}>
              <img src={image} alt="Thumbnail 1" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden', width: '64px', height: '76px', opacity: 0.85 }}>
              <img src="/img/story-texture.jpg" alt="Fabric close-up" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden', width: '64px', height: '76px', opacity: 0.85 }}>
              <img src="/img/story-label.jpg" alt="Collar label and buttons" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
          <div style={{ background: 'rgba(196, 92, 60, 0.08)', padding: '12px 14px', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--ink)' }}>
            <strong>100% GOTS Certified Organic Cotton</strong> · Zero synthetic microplastics · Coconut shell buttons.
          </div>
        </div>

        {/* Product Details & Actions Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 700 }}>{product.category || 'Artisan Block-Print'}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 700 }}>★ {product.rating || 4.9} ({product.ratingCount || 128} verified reviews)</span>
            </div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.8rem', margin: '4px 0 8px', fontWeight: 400 }}>{product.name}</h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--ink-soft)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {product.description || 'Authentic hand block-printed organic cotton shirt with coconut shell buttons.'}
            </p>
            <div className="price-row" style={{ alignItems: 'baseline', gap: '12px' }}>
              <span className="now" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--ink)' }}>{s.money(price)}</span>
              {was && <span className="was" style={{ fontSize: '1.05rem', textDecoration: 'line-through', color: 'var(--ink-soft)' }}>{s.money(was)}</span>}
              {was && <span style={{ color: '#27ae60', fontWeight: 700, fontSize: '0.85rem' }}>Save {s.money(was - price)} ({Math.round(((was - price)/was)*100)}% off)</span>}
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--ink-soft)', margin: '4px 0 0' }}>Inclusive of all taxes · Free shipping across India</p>
          </div>

          {/* Size Selection */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '0.85rem' }}>Select Size</strong>
              <span style={{ fontSize: '0.76rem', color: 'var(--ink-soft)' }}>
                {currentVariant ? `Chest: ${currentVariant.chest} | Length: ${currentVariant.length}` : ''}
              </span>
            </div>
            <div className="size-row" role="group" aria-label="Select size">
              {variants.map(v => (
                <button
                  type="button"
                  key={v.size}
                  className={'size-chip' + (selectedSize === v.size ? ' active' : '')}
                  onClick={() => { setSelectedSize(v.size); setModalHint(''); }}
                  style={{ minWidth: '44px', height: '40px', fontSize: '0.9rem', fontWeight: 600 }}
                >
                  {v.size}
                </button>
              ))}
            </div>
            {modalHint && <p style={{ color: 'var(--accent)', fontSize: '0.8rem', margin: '6px 0 0' }}>{modalHint}</p>}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="btn btn-solid"
              style={{ flex: 1, justifyContent: 'center', padding: '14px', fontSize: '0.95rem' }}
              onClick={handleAddToCart}
            >
              Add to Cart
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1, justifyContent: 'center', padding: '14px', fontSize: '0.95rem', borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700 }}
              onClick={handleBuyNow}
            >
              Buy Now ⚡
            </button>
          </div>

          {/* Delivery & Assurance Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '12px', background: 'var(--card)', borderRadius: '6px', fontSize: '0.72rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--ink)' }}>🚚 Free Delivery</div>
              <div style={{ color: 'var(--ink-soft)' }}>Dispatched in 24–48 hrs</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--ink)' }}>🔄 7-Day Returns</div>
              <div style={{ color: 'var(--ink-soft)' }}>Easy size exchange</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--ink)' }}>🔒 Safe Checkout</div>
              <div style={{ color: 'var(--ink-soft)' }}>Razorpay UPI & Cards</div>
            </div>
          </div>

          {/* Tabs for Meesho/Myntra Rich Content */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('specs')}
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'specs' ? '2px solid var(--accent)' : '2px solid transparent', padding: '8px 12px', fontWeight: 600, fontSize: '0.82rem', color: activeTab === 'specs' ? 'var(--accent)' : 'var(--ink-soft)', cursor: 'pointer' }}
              >
                Specifications
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('craft')}
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'craft' ? '2px solid var(--accent)' : '2px solid transparent', padding: '8px 12px', fontWeight: 600, fontSize: '0.82rem', color: activeTab === 'craft' ? 'var(--accent)' : 'var(--ink-soft)', cursor: 'pointer' }}
              >
                Artisan Craft
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reviews')}
                style={{ background: 'none', border: 'none', borderBottom: activeTab === 'reviews' ? '2px solid var(--accent)' : '2px solid transparent', padding: '8px 12px', fontWeight: 600, fontSize: '0.82rem', color: activeTab === 'reviews' ? 'var(--accent)' : 'var(--ink-soft)', cursor: 'pointer' }}
              >
                Reviews ({product.reviewCount || 42})
              </button>
            </div>

            {activeTab === 'specs' && (
              <div style={{ fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                <div><span style={{ color: 'var(--ink-soft)' }}>Fabric:</span> <strong>{product.fabric || '100% Organic Cotton'}</strong></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Weave:</span> <strong>{product.weave || '60s Cambric'}</strong></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Collar:</span> <strong>{product.collar || 'Cuban Camp Collar'}</strong></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Sleeves:</span> <strong>{product.sleeves || 'Full Sleeves'}</strong></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Buttons:</span> <strong>{product.buttons || 'Natural Coconut Shell'}</strong></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Fit:</span> <strong>{product.fit || 'Relaxed Casual Fit'}</strong></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Care:</span> <strong>Machine wash cold, shade dry</strong></div>
                <div><span style={{ color: 'var(--ink-soft)' }}>Origin:</span> <strong>{product.origin || 'Rajasthan, India'}</strong></div>
              </div>
            )}

            {activeTab === 'craft' && (
              <div style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--ink)' }}>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>Hand-carved Teakwood Blocks:</strong> Every print begins as a pencil sketch, transferred to seasoned teakwood and chiselled by master craftsmen in Bagru and Sanganer.
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>Botanical & Mineral Dyes:</strong> Ochre from iron rust, pinks from madder roots, and deep browns from fermented tamarind seeds. Gentle on skin and zero synthetic run-off into rivers.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Zero Single-Use Plastics:</strong> From coconut shell buttons to compostable packaging tape, every Algodon shirt is plastic-free.
                </p>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                {(product.reviews || [
                  { name: 'Arvind R.', location: 'Mumbai', stars: 5, date: '2 weeks ago', text: 'The organic cotton feels so light and breathable! Standout summer aesthetic.' },
                  { name: 'Vikram S.', location: 'Bengaluru', stars: 5, date: '1 month ago', text: 'Remarkable artisan craftsmanship. Received compliments from colleagues.' }
                ]).map((rev, idx) => (
                  <div key={idx} style={{ background: 'var(--card)', padding: '10px 12px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong>{rev.name} · <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>{rev.location} (Verified Buyer)</span></strong>
                      <span style={{ color: 'var(--accent)' }}>{'★'.repeat(rev.stars || 5)}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--ink-soft)', lineHeight: 1.4 }}>"{rev.text}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrintsSection({s}) {
  const prints = [
    {
      title: 'Golden-Brown Swirl',
      subtitle: 'Shot on the coast, printed inland.',
      description: 'Drawn from coastal waves and desert sand drifts. Teakwood blocks dipped in natural mineral earth pigments.',
      img: '/img/product-golden-brown.jpg',
      target: 'golden-brown'
    },
    {
      title: 'Rajasthan Jali',
      subtitle: 'Palace architectural lattice motif.',
      description: 'Geometric perforated screen patterns that allow air and sunlight to pass freely. Hand-printed in rose pink.',
      img: '/img/product-jali.jpg',
      target: 'jali'
    },
    {
      title: 'Rangeen Pakshee',
      subtitle: 'The avian plumage of Rajasthan.',
      description: 'Colourful multi-block stamping representing desert migratory birds in madder, saffron, and indigo.',
      img: '/img/product-pakshee.jpg',
      target: 'pakshee'
    },
    {
      title: 'Kamal Ka Phool',
      subtitle: 'Dabu mud-resist sacred lotus.',
      description: 'Sacred lotus flowers created with traditional mud-resist pastes, washed in flowing desert waters.',
      img: '/img/product-kamal.jpg',
      target: 'kamal'
    }
  ];

  return (
    <section id="prints" style={{ padding: 'clamp(40px, 7vw, 90px) clamp(20px, 5vw, 60px)', background: 'var(--surface)' }}>
      <div className="section-head" style={{ marginBottom: '32px' }}>
        <div>
          <span className="eyebrow">Artisan Motifs · Wooden Block Craft</span>
          <h2>Four motifs, one weave.</h2>
          <p style={{ color: 'var(--ink-soft)', maxWidth: '640px', margin: '8px 0 0', fontSize: '0.95rem' }}>
            Unlike factory screen-prints, each Algodon motif is stamped by hand onto GOTS-certified organic cotton.
          </p>
        </div>
        <a href="#shirts" className="viewall">Shop all shirts →</a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
        {prints.map(p => (
          <div key={p.title} style={{ background: 'var(--card)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '260px', overflow: 'hidden' }}>
              <img src={p.img} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <span className="eyebrow" style={{ color: 'var(--accent)', marginBottom: '4px' }}>{p.subtitle}</span>
              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.3rem', margin: '0 0 8px' }}>{p.title}</h3>
              <p style={{ color: 'var(--ink-soft)', fontSize: '0.84rem', lineHeight: 1.5, margin: '0 0 16px', flex: 1 }}>{p.description}</p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem' }}
                onClick={() => {
                  const targetEl = document.querySelector(`[data-product*="${p.target}"]`) || document.getElementById('shirts') || document.getElementById('edit');
                  targetEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                Shop {p.title} →
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Catalog({s}) {
  return (
    <section id="shirts">
      <div id="edit"></div>
      <div className="section-head">
        <div>
          <span className="eyebrow">The Print Edit</span>
          <h2>100% Organic Hand Block-Print Shirts</h2>
        </div>
        <a href="#prints" className="viewall">Explore the motifs →</a>
      </div>
      <div className="grid" id="productGrid">
        {s.products.map(product => (
          <ProductCard key={product.id} product={product} s={s} />
        ))}
      </div>
    </section>
  );
}

export function Search({s}) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', 'Swirls & Waves', 'Geometric Jali', 'Flora & Fauna'];

  const matches = s.products.filter(product => {
    const matchesQuery = query.trim() === '' ||
      product.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      (product.category && product.category.toLowerCase().includes(query.trim().toLowerCase())) ||
      (product.description && product.description.toLowerCase().includes(query.trim().toLowerCase()));

    const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <div
      className="search-overlay"
      id="searchOverlay"
      hidden={s.panel !== 'search'}
      role="dialog"
      aria-modal="true"
      aria-label="Search the Print Edit"
      style={{
        background: 'rgba(28, 22, 18, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      <div className="search-overlay-head">
        <span className="eyebrow" style={{ color: 'var(--accent)' }}>Search Algodon Organic Shirts</span>
        <button className="icon-btn" id="searchClose" aria-label="Close search" onClick={s.close}>Close ✕</button>
      </div>

      <input
        type="text"
        id="searchInput"
        placeholder={'Try “jali”, “swirl”, “lotus” or “bird”…'}
        autoComplete="off"
        value={query}
        onChange={event => setQuery(event.target.value)}
        style={{ color: '#fff', borderBottomColor: 'rgba(255, 255, 255, 0.3)' }}
      />

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '720px', margin: '0 auto 24px' }}>
        {categories.map(cat => (
          <button
            type="button"
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              background: activeCategory === cat ? 'var(--accent)' : 'rgba(255, 255, 255, 0.1)',
              color: activeCategory === cat ? '#fff' : 'rgba(255, 255, 255, 0.85)',
              border: '1px solid ' + (activeCategory === cat ? 'var(--accent)' : 'rgba(255, 255, 255, 0.2)'),
              borderRadius: '20px',
              padding: '6px 16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="search-results" id="searchResults">
        {matches.length ? (
          matches.map(product => (
            <button
              type="button"
              key={product.id}
              onClick={() => {
                s.close();
                s.openProductModal?.(product);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '8px',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <img
                src={safeImageUrl(product.images?.[0]) || '/img/product-golden-brown.jpg'}
                alt=""
                style={{ width: '48px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
              />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{product.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.65)' }}>{product.category || 'Organic Cotton'} · 100% GOTS</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>{s.money(product.sale_price ?? product.price)}</span>
                {product.was && <div style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'rgba(255, 255, 255, 0.5)' }}>{s.money(product.was)}</div>}
              </div>
            </button>
          ))
        ) : (
          <p className="empty" style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
            No shirts match “{query}” in {activeCategory}.
          </p>
        )}
      </div>
    </div>
  );
}
