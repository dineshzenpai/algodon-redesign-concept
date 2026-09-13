import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-[85vh] w-full bg-stone/20 overflow-hidden group">
        <img 
          src="https://images.unsplash.com/photo-1596452277051-78929e794bd7?auto=format&fit=crop&q=80&w=2000" 
          alt="Minimalist tailored coat" 
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 group-hover:opacity-90"
        />
        {/* Asymmetric Headline overlapping bottom left */}
        <div className="absolute bottom-12 left-6 md:left-12 max-w-xl z-10 mix-blend-difference text-paper-white">
          <h1 className="font-display text-5xl md:text-7xl leading-[0.9] tracking-tight mb-4">
            Structured form.<br />Raw intent.
          </h1>
          <Link to="/shop" className="inline-block border-b border-paper-white pb-1 hover:text-clay-rose hover:border-clay-rose transition-colors uppercase text-xs tracking-widest mt-4">
            Explore Collection 01
          </Link>
        </div>
      </section>

      {/* Curated Collections (Asymmetric grid) */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-6">
          <div className="md:col-span-5 flex flex-col justify-end pb-12">
            <h2 className="font-display text-4xl mb-4">The Heavy Wool Trousers</h2>
            <p className="text-stone mb-6 max-w-sm">Tailored with uncompromising precision. Designed to anchor the modern uniform with architectural weight.</p>
            <Link to="/product/1" className="text-sm border-b border-ink pb-1 w-max hover:text-clay-rose hover:border-clay-rose transition-colors">View Product</Link>
          </div>
          <div className="md:col-span-7 h-[600px] overflow-hidden group relative">
            <img 
              src="https://images.unsplash.com/photo-1594938298596-eb5fd3822b58?auto=format&fit=crop&q=80&w=1200" 
              alt="Wool trousers detail" 
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            />
            {/* Hover image cross-fade logic implemented here via overlapping images */}
            <img 
              src="https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=1200" 
              alt="Wool trousers alternative" 
              className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            />
          </div>
        </div>
      </section>

      {/* Editorial Story Block */}
      <section className="border-t border-stone/30 py-24 px-6 md:px-12 bg-paper-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="aspect-[3/4] overflow-hidden">
            <img 
              src="https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&q=80&w=1000" 
              alt="Atelier workspace" 
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
            />
          </div>
          <div>
            <h2 className="font-display text-3xl mb-6">Uncompromising Materials</h2>
            <p className="text-sm leading-relaxed mb-6">
              Our process begins and ends with the fabric. We source unblended, heavy-weight cottons and raw wools that hold their shape. There is no stretch. There is no synthetic compromise. The garments dictate a posture of their own, breaking in over years rather than months.
            </p>
            <Link to="/about" className="text-sm border-b border-ink pb-1 w-max hover:text-clay-rose hover:border-clay-rose transition-colors">Read the Manifesto</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
