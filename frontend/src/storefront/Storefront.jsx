import { useEffect, useRef } from 'react';
import { Header, CartDrawer, AccountDrawer, SizeGuide, Hero, Story, Footer } from './Design.jsx';
import { Catalog, Search } from './Catalog.jsx';
import { useStorefront } from './useStorefront.js';
import { useDialog } from '../shared/useDialog.js';
import { animate, stagger } from '../shared/motion.js';
import './styles.css';

export default function Storefront() {
  const s=useStorefront(), dialog=useRef(null);
  useEffect(() => {
    dialog.current = s.panel ? document.getElementById({account:'accountDrawer',cart:'cartDrawer',size:'sizeGuideModal',search:'searchOverlay'}[s.panel]) : null;
  },[s.panel]);
  useDialog(s.panel,dialog,s.close);
  useEffect(() => {
    const animation=animate('.hero-copy h1, .hero-copy .eyebrow, .hero-copy p, .hero-actions',{opacity:[0,1],y:[30,0]},{delay:stagger(.15),duration:.8,ease:[.22,1,.36,1]});
    return () => animation.cancel();
  },[]);
  return <>
    <Header s={s} />
    <div className="scrim" id="scrim" hidden={!s.menuOpen && s.panel !== 'cart'} onClick={s.close} />
    <div id="authToast" className="auth-toast" role="status" aria-live="polite" hidden={!s.toast}>{s.toast}</div>
    <Search s={s} /><CartDrawer s={s} /><AccountDrawer s={s} /><SizeGuide s={s} />
    <Hero s={s} /><Catalog s={s} /><Story s={s} /><Footer s={s} />
  </>;
}
