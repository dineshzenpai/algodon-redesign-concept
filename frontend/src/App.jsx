import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import PLP from './pages/PLP';
import PDP from './pages/PDP';
import CartDrawer from './components/CartDrawer';
import AccountModal from './components/AccountModal';

export default function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-bone text-ink">
        {/* Navigation */}
        <header className="border-b border-stone/30 py-4 px-6 flex justify-between items-center sticky top-0 bg-bone/90 backdrop-blur-sm z-40">
          <Link to="/" className="text-2xl font-display uppercase tracking-wide">Atelier Hestia</Link>
          <nav className="flex gap-6 text-sm">
            <Link to="/shop" className="hover:text-clay-rose transition-colors">Shop</Link>
            <button onClick={() => setIsAccountOpen(true)} className="hover:text-clay-rose transition-colors">Account</button>
            <button onClick={() => setIsCartOpen(true)} className="hover:text-clay-rose transition-colors">Cart</button>
          </nav>
        </header>

        {/* Main Content */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<PLP />} />
            <Route path="/product/:id" element={<PDP setIsCartOpen={setIsCartOpen} />} />
            <Route path="/about" element={
              <div className="max-w-4xl mx-auto px-6 py-20">
                <h1 className="font-display text-4xl mb-6">About the Atelier</h1>
                <p className="text-stone leading-relaxed mb-6">
                  Architectural tailoring for the modern context. Sourced from unblended, pure organic cotton and raw materials that hold structural integrity. Conceived for quiet permanence.
                </p>
                <Link to="/shop" className="inline-block border-b border-ink pb-1 hover:text-clay-rose hover:border-clay-rose transition-colors">Explore the Collection</Link>
              </div>
            } />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-stone/30 py-12 px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div>
            <h3 className="font-display text-lg mb-4">Atelier Hestia</h3>
            <p className="text-stone">Architectural tailoring for the modern context.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/shop" className="hover:text-clay-rose transition-colors w-max">Shop Collection</Link>
            <Link to="/about" className="hover:text-clay-rose transition-colors w-max">About the Atelier</Link>
          </div>
          <div className="flex flex-col gap-2">
            <a href="#" className="hover:text-clay-rose transition-colors w-max">Customer Care</a>
            <a href="#" className="hover:text-clay-rose transition-colors w-max">Returns</a>
          </div>
        </footer>

        {/* Global Drawers/Modals */}
        <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
        <AccountModal isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
      </div>
    </Router>
  );
}
