import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function AccountModal({ isOpen, onClose }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('login'); // login, register, orders
  
  if (!isOpen) return null;

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoggedIn(true);
    setActiveTab('orders');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveTab('login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bone/95 backdrop-blur-md" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-[420px] bg-paper-white shadow-none border border-stone/20 flex flex-col max-h-[90vh] overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-stone hover:text-clay-rose transition-colors z-10">
          <X size={20} strokeWidth={1} />
        </button>

        <div className="flex-grow overflow-y-auto p-8 md:p-10 hide-scrollbar">
          {!isLoggedIn ? (
            <div className="flex flex-col h-full justify-center">
              <h2 className="font-display text-3xl mb-8 text-center">{activeTab === 'login' ? 'Sign In' : 'Create Account'}</h2>
              
              <form onSubmit={handleLogin} className="flex flex-col gap-5">
                {activeTab === 'register' && (
                  <div>
                    <label className="block text-xs text-stone mb-1">Full Name</label>
                    <input type="text" required className="w-full bg-bone border-none outline-none p-3 text-sm focus:ring-1 focus:ring-clay-rose rounded-sm" />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-stone mb-1">Email</label>
                  <input type="email" required className="w-full bg-bone border-none outline-none p-3 text-sm focus:ring-1 focus:ring-clay-rose rounded-sm" />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs text-stone">Password</label>
                    {activeTab === 'login' && <button type="button" className="text-xs text-stone hover:text-ink">Forgot password?</button>}
                  </div>
                  <input type="password" required className="w-full bg-bone border-none outline-none p-3 text-sm focus:ring-1 focus:ring-clay-rose rounded-sm" />
                </div>
                
                <button type="submit" className="w-full bg-ink text-bone py-4 mt-2 text-sm hover:bg-clay-rose transition-colors">
                  {activeTab === 'login' ? 'Sign In' : 'Register'}
                </button>
              </form>
              
              <div className="mt-8 text-center text-sm">
                <button 
                  onClick={() => setActiveTab(activeTab === 'login' ? 'register' : 'login')}
                  className="text-stone hover:text-ink transition-colors border-b border-transparent hover:border-ink"
                >
                  {activeTab === 'login' ? 'Create an account' : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-8 border-b border-stone/30 pb-4">
                <h2 className="font-display text-2xl">Your Orders</h2>
                <button onClick={handleLogout} className="text-sm text-stone hover:text-ink transition-colors border-b border-transparent hover:border-ink">Sign Out</button>
              </div>
              
              <div className="flex flex-col gap-8">
                {/* Mock Order */}
                <div className="border border-stone/20 bg-bone/30 p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs text-stone uppercase tracking-wider mb-1">Order #AH-8492</p>
                      <p className="text-sm font-medium">1 Item • Rs. 24,000</p>
                    </div>
                    <p className="text-sm">Oct 12, 2026</p>
                  </div>
                  
                  <div className="border-t border-stone/20 pt-4 mt-2">
                    <p className="text-sm mb-4">Est. Delivery: <strong>Oct 15, 2026</strong> via DHL (JD939281)</p>
                    
                    {/* Status Stepper */}
                    <div className="flex items-center justify-between relative mt-8 mb-2">
                      <div className="absolute left-0 top-1/2 w-full h-[1px] bg-stone/30 -z-10 -translate-y-1/2" />
                      
                      {['Placed', 'Packed', 'Shipped', 'Out for delivery', 'Delivered'].map((step, i, arr) => {
                        const currentStep = 2; // 'Shipped' is active
                        const isActive = i === currentStep;
                        const isPast = i < currentStep;
                        
                        return (
                          <div key={step} className="flex flex-col items-center gap-2 relative bg-bone/30 px-1">
                            <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-clay-rose ring-4 ring-clay-rose/20' : isPast ? 'bg-ink' : 'bg-stone/30'}`} />
                            <span className={`text-[10px] uppercase tracking-wider absolute top-4 whitespace-nowrap ${isActive ? 'text-clay-rose font-medium' : isPast ? 'text-ink' : 'text-stone/60'}`}>
                              {step}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
