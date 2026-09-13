import React from 'react';
import { Link } from 'react-router-dom';

const MOCK_PRODUCTS = [
  { id: 1, name: 'The Heavy Wool Trousers', price: 24000, category: 'Bottoms', image1: 'https://images.unsplash.com/photo-1594938298596-eb5fd3822b58?auto=format&fit=crop&q=80&w=800', image2: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800', isHero: true },
  { id: 2, name: 'Structured Poplin Shirt', price: 16500, category: 'Tops', image1: 'https://images.unsplash.com/photo-1596452277051-78929e794bd7?auto=format&fit=crop&q=80&w=800', image2: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&q=80&w=800', isHero: false },
  { id: 3, name: 'Raw Denim Jacket', price: 32000, category: 'Outerwear', image1: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&q=80&w=800', image2: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?auto=format&fit=crop&q=80&w=800', isHero: false },
  { id: 4, name: 'Merino Rollneck', price: 18000, category: 'Knitwear', image1: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=800', image2: 'https://images.unsplash.com/photo-1556821832-6a682ff9722b?auto=format&fit=crop&q=80&w=800', isHero: false },
];

export default function PLP() {
  const heroProduct = MOCK_PRODUCTS.find(p => p.isHero);
  const gridProducts = MOCK_PRODUCTS.filter(p => !p.isHero);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <header className="mb-12 border-b border-stone/30 pb-6 flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="font-display text-4xl">Collection 01</h1>
          <p className="text-sm text-stone mt-2">12 Items</p>
        </div>
        <div className="flex gap-8 text-sm">
          <select className="bg-transparent border-none outline-none cursor-pointer focus:text-clay-rose">
            <option>Category</option>
            <option>Tops</option>
            <option>Bottoms</option>
            <option>Outerwear</option>
          </select>
          <select className="bg-transparent border-none outline-none cursor-pointer focus:text-clay-rose">
            <option>Size</option>
            <option>1 (S)</option>
            <option>2 (M)</option>
            <option>3 (L)</option>
          </select>
          <select className="bg-transparent border-none outline-none cursor-pointer focus:text-clay-rose">
            <option>Sort: Newest</option>
            <option>Sort: Price (Low to High)</option>
            <option>Sort: Price (High to Low)</option>
          </select>
        </div>
      </header>

      {/* Asymmetric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-4 lg:gap-8">
        
        {/* Large 2-column hero product block */}
        {heroProduct && (
          <div className="md:col-span-8 group mb-12 md:mb-0">
            <Link to={`/product/${heroProduct.id}`} className="block relative aspect-[4/5] overflow-hidden bg-stone/10">
              <img src={heroProduct.image1} alt={heroProduct.name} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" />
              <img src={heroProduct.image2} alt={heroProduct.name} className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
            </Link>
            <div className="mt-4 flex justify-between items-start">
              <div>
                <Link to={`/product/${heroProduct.id}`} className="font-display text-2xl hover:text-clay-rose transition-colors">{heroProduct.name}</Link>
                <p className="text-xs text-stone mt-1 uppercase tracking-wider">{heroProduct.category}</p>
              </div>
              <p className="text-sm">Rs. {heroProduct.price.toLocaleString('en-IN')}</p>
            </div>
          </div>
        )}

        {/* Tighter grid alongside/below */}
        <div className="md:col-span-4 grid grid-cols-1 gap-12 md:grid-cols-1">
          {/* Note: Brief asks for 2-column hero mixed with tighter 3-column grid below. 
              We'll place one item beside the hero to balance, and the rest in a 3-col below. */}
          {gridProducts.slice(0, 1).map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        
        {/* 3-Column Grid below */}
        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 lg:gap-8 mt-12 md:mt-4">
          {gridProducts.slice(1).map(p => (
            <ProductCard key={p.id} product={p} />
          ))}
          {gridProducts.slice(1).map(p => (
            <ProductCard key={p.id + 10} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }) {
  return (
    <div className="group">
      <Link to={`/product/${product.id}`} className="block relative aspect-[3/4] overflow-hidden bg-stone/10">
        <img src={product.image1} alt={product.name} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700" />
        <img src={product.image2} alt={product.name} className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
      </Link>
      <div className="mt-3 flex justify-between items-start">
        <div>
          <Link to={`/product/${product.id}`} className="font-display text-lg hover:text-clay-rose transition-colors">{product.name}</Link>
          <p className="text-xs text-stone mt-1 uppercase tracking-wider">{product.category}</p>
        </div>
        <p className="text-sm">Rs. {product.price.toLocaleString('en-IN')}</p>
      </div>
    </div>
  );
}
