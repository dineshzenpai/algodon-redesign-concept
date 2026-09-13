import React, { useState } from 'react';

export default function PDP({ setIsCartOpen }) {
  const images = [
    'https://images.unsplash.com/photo-1594938298596-eb5fd3822b58?auto=format&fit=crop&q=80&w=1200',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=1200',
    'https://images.unsplash.com/photo-1594938328870-9623159c8c99?auto=format&fit=crop&q=80&w=1200'
  ];

  const [activeImage, setActiveImage] = useState(images[0]);
  const [selectedSize, setSelectedSize] = useState('2');
  const [isCareExpanded, setIsCareExpanded] = useState(false);

  const handleAddToCart = () => {
    // Mock add to cart logic
    setIsCartOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-24">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-24">
        
        {/* Image Gallery */}
        <div className="md:col-span-7 flex flex-col-reverse md:flex-row gap-4">
          {/* Thumbnails */}
          <div className="flex md:flex-col gap-4 w-full md:w-24 overflow-x-auto md:overflow-visible">
            {images.map((img, i) => (
              <button 
                key={i} 
                onClick={() => setActiveImage(img)}
                className={`flex-shrink-0 w-20 md:w-24 aspect-[3/4] overflow-hidden ${activeImage === img ? 'opacity-100 ring-1 ring-ink ring-offset-2 ring-offset-bone' : 'opacity-60 hover:opacity-100'}`}
              >
                <img src={img} alt={`Thumbnail ${i+1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          {/* Main Image */}
          <div className="flex-grow aspect-[3/4] overflow-hidden bg-stone/10">
            <img src={activeImage} alt="Main product" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Product Info */}
        <div className="md:col-span-5 flex flex-col justify-start">
          <h1 className="font-display text-4xl lg:text-5xl mb-2">The Heavy Wool Trousers</h1>
          <p className="text-xl mb-8">Rs. 24,000</p>
          
          <p className="text-sm leading-relaxed mb-8">
            Tailored with uncompromising precision. Designed to anchor the modern uniform with architectural weight. Featuring a high rise, single pleat, and a wide, structured leg that refuses to drape softly.
          </p>

          {/* Size Selector */}
          <div className="mb-10">
            <div className="flex justify-between items-center mb-4 text-sm">
              <span className="text-stone">Size</span>
              <button className="underline hover:text-clay-rose transition-colors">Size Guide</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['1', '2', '3', '4'].map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`py-3 text-sm transition-colors border ${selectedSize === size ? 'border-ink bg-ink text-bone' : 'border-stone/40 hover:border-ink'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleAddToCart}
            className="w-full bg-ink text-bone py-4 text-sm hover:bg-clay-rose transition-colors mb-12"
          >
            Add to bag
          </button>

          {/* Expandable Details */}
          <div className="border-t border-stone/30">
            <button 
              className="w-full py-6 flex justify-between items-center text-sm font-display text-lg"
              onClick={() => setIsCareExpanded(!isCareExpanded)}
            >
              <span>Fabric & Care</span>
              <span>{isCareExpanded ? '−' : '+'}</span>
            </button>
            {isCareExpanded && (
              <div className="pb-6 text-sm text-stone leading-relaxed space-y-4">
                <p>100% Raw Heavyweight Wool (800gsm).</p>
                <p>Dry clean only. Do not wash, bleach, or tumble dry. Iron on low heat if absolutely necessary, but we recommend letting the fabric settle naturally.</p>
                <p>Woven in Japan. Tailored in London.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
