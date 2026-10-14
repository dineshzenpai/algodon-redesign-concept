import React, { useState } from 'react';
import { X, Minus, Plus } from 'lucide-react';

export default function CartDrawer({ isOpen, onClose }) {
  const [cart, setCart] = useState([
    { id: 1, name: 'The Heavy Wool Trousers', size: '2', price: 24000, qty: 1, img: 'https://images.unsplash.com/photo-1594938298596-eb5fd3822b58?auto=format&fit=crop&q=80&w=200' }
  ]);
  
  const [isCheckout, setIsCheckout] = useState(false);

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  const updateQty = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    alert('Order placed successfully (Mock)');
    setCart([]);
    setIsCheckout(false);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-ink/10 backdrop-blur-sm z-50 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-paper-white z-50 transform transition-transform duration-500 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-6 border-b border-stone/30">
          <h2 className="font-display text-2xl">{isCheckout ? 'Checkout' : 'Your Bag'}</h2>
          <button onClick={onClose} className="p-2 -mr-2 hover:text-clay-rose transition-colors">
            <X size={20} strokeWidth={1} />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-8">
          {!isCheckout ? (
            <>
              {cart.length === 0 ? (
                <p className="text-stone">Your bag is empty.</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-20 aspect-[3/4] bg-stone/10 overflow-hidden flex-shrink-0">
                      <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col justify-between flex-grow">
                      <div>
                        <h3 className="font-display text-lg leading-tight mb-1">{item.name}</h3>
                        <p className="text-xs text-stone">Size: {item.size}</p>
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <div className="flex items-center border border-stone/40">
                          <button onClick={() => updateQty(item.id, -1)} className="p-2 hover:bg-stone/10 transition-colors"><Minus size={14} /></button>
                          <span className="text-xs px-2 min-w-[2ch] text-center">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="p-2 hover:bg-stone/10 transition-colors"><Plus size={14} /></button>
                        </div>
                        <p className="text-sm">Rs. {(item.price * item.qty).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="flex flex-col gap-6">
              <div>
                <h3 className="font-display text-lg mb-4 border-b border-stone/30 pb-2">Shipping Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-stone mb-1">Email</label>
                    <input type="email" required className="w-full bg-bone border-none outline-none p-3 text-sm focus:ring-1 focus:ring-clay-rose rounded-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone mb-1">Full Name</label>
                    <input type="text" required className="w-full bg-bone border-none outline-none p-3 text-sm focus:ring-1 focus:ring-clay-rose rounded-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-stone mb-1">Address</label>
                    <textarea required rows="2" className="w-full bg-bone border-none outline-none p-3 text-sm focus:ring-1 focus:ring-clay-rose rounded-sm"></textarea>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-display text-lg mb-4 border-b border-stone/30 pb-2">Payment</h3>
                <div className="p-4 bg-bone text-center text-sm text-stone border border-stone/20">
                  Concept preview. Mock payment will be applied.
                </div>
              </div>
            </form>
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-6 border-t border-stone/30 bg-paper-white mt-auto">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm">Subtotal</span>
              <span className="text-lg">Rs. {subtotal.toLocaleString('en-IN')}</span>
            </div>
            {!isCheckout ? (
              <button 
                onClick={() => setIsCheckout(true)}
                className="w-full bg-ink text-bone py-4 text-sm hover:bg-clay-rose transition-colors"
              >
                Proceed to Checkout
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button 
                  type="submit"
                  form="checkout-form"
                  className="w-full bg-ink text-bone py-4 text-sm hover:bg-clay-rose transition-colors"
                >
                  Place order
                </button>
                <button 
                  type="button"
                  onClick={() => setIsCheckout(false)}
                  className="w-full py-4 text-sm text-stone hover:text-ink transition-colors"
                >
                  Back to Bag
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
