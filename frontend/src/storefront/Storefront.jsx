import { useEffect, useRef, lazy, Suspense } from 'react';
import { Header, CartDrawer, AccountDrawer, SizeGuide, Hero, Story, Footer, HelpModal } from './Design.jsx';
import { Catalog, Search, ProductDetailModal, PrintsSection } from './Catalog.jsx';
import { useStorefront } from './useStorefront.js';
import { useDialog } from '../shared/useDialog.js';
import { animate, stagger } from '../shared/motion.js';
import './styles.css';

const Admin = lazy(() => import('../admin/Admin.jsx'));

export default function Storefront() {
  const s = useStorefront(), dialog = useRef(null);
  useEffect(() => {
    dialog.current = s.panel ? document.getElementById({account:'accountDrawer',cart:'cartDrawer',size:'sizeGuideModal',search:'searchOverlay',admin:'adminModalOverlay'}[s.panel]) : null;
  }, [s.panel]);
  useDialog(s.panel, dialog, s.close);

  useEffect(() => {
    const animation = animate('.hero-copy h1, .hero-copy .eyebrow, .hero-copy p, .hero-actions', { opacity: [0, 1], y: [30, 0] }, { delay: stagger(.15), duration: .8, ease: [.22, 1, .36, 1] });
    return () => animation.cancel();
  }, []);

  return (
    <>
      <Header s={s} />
      <div className="scrim" id="scrim" hidden={!s.menuOpen && s.panel !== 'cart'} onClick={s.close} />
      <div id="authToast" className="auth-toast" role="status" aria-live="polite" hidden={!s.toast}>{s.toast}</div>
      <Search s={s} />
      <CartDrawer s={s} />
      <AccountDrawer s={s} />
      <SizeGuide s={s} />
      <HelpModal s={s} />
      <ProductDetailModal s={s} />
      {s.panel === 'admin' && (
        <div id="adminModalOverlay" role="dialog" aria-modal="true" aria-label="Admin Dashboard" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--surface, #fff)', overflow: 'auto' }}>
          <Suspense fallback={<div className="loading-screen" style={{ height: '100vh', display: 'grid', placeItems: 'center', fontFamily: "'Fraunces',serif", fontSize: '1.5rem' }}>Algodon Organic · Loading Store Administration…</div>}>
            <Admin onClose={s.close} isEmbedded={true} />
          </Suspense>
        </div>
      )}
      <Hero s={s} />
      <Catalog s={s} />
      <PrintsSection s={s} />
      <Story s={s} />
      <Footer s={s} />
    </>
  );
}
