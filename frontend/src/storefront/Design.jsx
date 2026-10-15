import { CartItems, AccountHistory } from './Panels.jsx';

export function Header({s}) {
  return <>
<div className="top-bar">Free shipping across India · Prints ship within 48 hours</div>
<header id="siteHeader" className={`site${s.scrolled ? " scrolled" : ""}${s.menuOpen ? " menu-open" : ""}`}>
  <button className="hamburger" id="navToggle" aria-label="Open menu" aria-controls="primaryNav" onClick={() => s.setMenuOpen(!s.menuOpen)} aria-expanded={s.menuOpen}>
    <span></span><span></span><span></span>
  </button>
  <nav id="primaryNav" className={`primary${s.menuOpen ? " open" : ""}`}>
    <a href="#edit" data-nav-link onClick={() => s.setMenuOpen(false)}>Shirts</a>
    <a href="#edit" data-nav-link onClick={() => s.setMenuOpen(false)}>Prints</a>
    <a href="#story" data-nav-link onClick={() => s.setMenuOpen(false)}>Our Story</a>
    <a href="#" id="sizeGuideLink" data-nav-link onClick={event => { event.preventDefault(); s.open("size"); }}>Size Guide</a>
  </nav>
  <a href="#" className="wordmark">ALGODON<span className="sub">ORGANIC</span></a>
  <nav className="icons">
    <button className="icon-btn" id="searchToggle" aria-label="Search" onClick={() => s.open("search")}>Search</button>
    <div className="account-nav">
      <button className="icon-btn" id="accountToggle" aria-label="Account" aria-haspopup="true" onClick={() => s.user ? s.setAccountMenu(!s.accountMenu) : s.openAccount()} aria-expanded={s.accountMenu}><img id="accountAvatar" alt="" hidden /><span id="accountNavLabel">{s.user ? (s.user.user_metadata?.full_name?.split(" ")[0] || "Account") : "Account"}</span></button>
      <div className="account-menu" id="accountMenu" hidden={!s.accountMenu}>
        <a href="/orders">Orders</a><a href="/wishlist">Wishlist</a><button type="button" id="navLogoutBtn" onClick={s.signOut}>Logout</button>
      </div>
    </div>
    <button className="icon-btn" id="cartToggle" aria-label="Open cart" onClick={() => s.open("cart")}>Cart<span id="cartCount">{s.cart.reduce((total,item) => total + item.qty, 0)}</span></button>
  </nav>
</header>
  </>;
}

export function CartDrawer({s}) {
  return <>
<aside id="cartDrawer" role="dialog" aria-modal={s.panel === "cart"} aria-label="Shopping cart" inert={s.panel !== 'cart'} aria-hidden={s.panel !== 'cart'} className={`cart-drawer${s.panel === "cart" ? " open" : ""}`}>
  <div className="cart-head">
    <h3>Your Cart</h3>
    <button className="icon-btn" id="cartClose" aria-label="Close cart" onClick={s.close}>Close ✕</button>
  </div>
  <div className="cart-items" id="cartItems"><CartItems s={s} /></div>



  <div className="cart-foot">
    <div className="cart-subtotal"><span>Subtotal</span><span id="cartSubtotal">{s.money(s.total)}</span></div>
    <div style={{"display": "flex", "gap": "8px", "margin": "12px 0"}}>
      <input id="couponCode" aria-label="Coupon code" placeholder="Coupon code" style={{"flex": "1", "minWidth": "0", "padding": "10px", "border": "1px solid var(--line)", "background": "var(--surface)", "color": "var(--ink)"}} value={s.couponCode} onChange={event => s.setCouponCode(event.target.value)} />
      <button className="btn btn-ghost" type="button" id="applyCouponBtn" onClick={s.applyCoupon} disabled={s.busy === "coupon"}>Apply</button>
    </div>
    <p id="couponMessage" className="cart-note" aria-live="polite" hidden={!s.couponMessage}>{s.couponMessage}</p>
    <div className="cart-subtotal" id="cartDiscountRow" hidden={!s.coupon}><span>Discount</span><span id="cartDiscount">{`− ${s.money(s.coupon?.discount || 0)}`}</span></div>
    <button className="btn btn-solid" style={{"width": "100%", "justifyContent": "center"}} id="checkoutBtn" onClick={s.checkout} disabled={s.busy === "checkout"}>{s.busy === "checkout" ? "Saving order…" : "Checkout"}</button>
    <p className="cart-note" id="cartNote">{s.cartNote}</p>
    <button className="btn btn-ghost" id="downloadInvoiceBtn" style={{"width": "100%", "justifyContent": "center", "marginTop": "10px", "color": "var(--ink)", "borderColor": "var(--line-strong)"}} hidden={!s.lastOrder} onClick={() => s.downloadInvoice(s.lastOrder)}>Download Invoice (PDF)</button>
    <button className="btn btn-ghost" id="emailInvoiceBtn" style={{"width": "100%", "justifyContent": "center", "marginTop": "10px", "color": "var(--ink)", "borderColor": "var(--line-strong)"}} hidden>Email Invoice Details</button>
  </div>
</aside>
  </>;
}

export function AccountDrawer({s}) {
  return <>
<div className="modal-backdrop" id="accountDrawer" role="dialog" aria-modal="true" aria-label="Account" hidden={s.panel !== "account"} onClick={event => { if(event.target === event.currentTarget) s.close(); }}>
  <div className="modal" style={{"padding": "0", "maxWidth": "850px", "width": "90%", "maxHeight": "90vh", "display": "flex", "flexDirection": "row", "overflow": "hidden", "background": "var(--surface)", "position": "relative"}}>


    <button className="icon-btn" id="accountClose" aria-label="Close account panel" style={{"position": "absolute", "top": "16px", "right": "24px", "zIndex": "10"}} onClick={s.close}>Close ✕</button>


    <div className="modal-image-side"></div>


    <div className="account-form-pane">
      <div className="account-body" id="accountSignedOut" style={{"display": "flex", "flexDirection": "column", "justifyContent": "center", "height": "100%"}} hidden={s.authMode !== "recovery" && Boolean(s.user || s.guest)}>
        <h2 id="authTitle" style={{"textAlign": "center", "marginBottom": "24px", "fontFamily": "'Fraunces', serif", "fontSize": "2rem", "fontWeight": "300"}}>{({signin:"Sign In",signup:"Create Account",reset:"Reset password",recovery:"Set a new password"})[s.authMode]}</h2>

        <button type="button" id="googleSignInBtn" className="btn btn-ghost" style={{"width": "100%", "justifyContent": "center", "marginBottom": "16px", "display": "flex", "gap": "10px", "alignItems": "center"}} hidden={true}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg>
          Continue with Google
        </button>
        <div id="googleSignInDivider" style={{"display": "flex", "alignItems": "center", "textAlign": "center", "color": "var(--ink-soft)", "fontSize": "0.75rem", "marginBottom": "16px"}} hidden={true}>
          <hr style={{"flex": "1", "border": "none", "borderTop": "1px solid var(--line)"}} />
          <span style={{"padding": "0 10px"}}>or</span>
          <hr style={{"flex": "1", "border": "none", "borderTop": "1px solid var(--line)"}} />
        </div>

        <form className="checkout-form" id="signInForm" style={{"border": "none", "padding": "0"}} hidden={!["signin","reset"].includes(s.authMode)} onSubmit={s.submitAuth}>
          <div className="field">
            <label htmlFor="signInEmail">Email</label>
            <input type="email" id="signInEmail" name="email" autoComplete="email" required />
          </div>
          <div className="field" id="signInPasswordField" hidden={s.authMode === "reset"}>
            <div style={{"display": "flex", "justifyContent": "space-between", "alignItems": "baseline"}}>
              <label htmlFor="signInPassword">Password</label>
              <button type="button" id="forgotPasswordBtn" style={{"font": "inherit", "fontSize": ".75rem", "color": "var(--ink-soft)", "border": "0", "padding": "0", "background": "none", "cursor": "pointer"}} onClick={() => s.changeAuth("reset")}>Forgot password?</button>
            </div>
            <input type="password" id="signInPassword" name="password" autoComplete="current-password" required={s.authMode !== "reset"} />
          </div>
          <p className="field-error" id="signInError">{s.authError}</p>
          <button type="submit" className="btn btn-solid" style={{"justifyContent": "center", "padding": "14px", "marginTop": "8px"}} disabled={Boolean(s.busy)}>{s.busy === "auth" ? "Please wait…" : s.authMode === "reset" ? "Send reset link" : "Sign In"}</button>
        </form>

        <form className="checkout-form" id="signUpForm" style={{"border": "none", "padding": "0"}} hidden={s.authMode !== "signup"} onSubmit={s.submitAuth}>
          <div className="field">
            <label htmlFor="signUpName">Full name</label>
            <input type="text" id="signUpName" name="name" autoComplete="name" required />
          </div>
          <div className="field">
            <label htmlFor="signUpEmail">Email</label>
            <input type="email" id="signUpEmail" name="email" autoComplete="email" required />
          </div>
          <div className="field" style={{"flexDirection": "row", "alignItems": "center", "gap": "8px", "marginTop": "4px"}}>
            <input type="checkbox" id="signUpNewsletter" name="newsletter" defaultChecked style={{"width": "auto", "margin": "0", "padding": "0"}} />
            <label htmlFor="signUpNewsletter" style={{"fontSize": "0.75rem", "color": "var(--ink-soft)", "margin": "0", "cursor": "pointer"}}>Keep me updated on news and exclusive offers</label>
          </div>
          <div className="field">
            <label htmlFor="signUpPassword">Password</label>
            <input type="password" id="signUpPassword" name="password" autoComplete="new-password" minLength="12" maxLength="128" required />
          </div>
          <p className="field-error" id="signUpError">{s.authError}</p>
          <button type="submit" className="btn btn-solid" style={{"justifyContent": "center", "padding": "14px", "marginTop": "8px"}} disabled={Boolean(s.busy)}>Create Account</button>
        </form>

        <form className="checkout-form" id="recoveryForm" style={{"border": "0", "padding": "0"}} hidden={s.authMode !== "recovery"} onSubmit={s.submitAuth}>
          <div className="field"><label htmlFor="recoveryPassword">New password</label><input id="recoveryPassword" name="password" type="password" autoComplete="new-password" minLength="12" maxLength="128" required /></div>
          <div className="field"><label htmlFor="recoveryConfirm">Confirm new password</label><input id="recoveryConfirm" name="confirm" type="password" autoComplete="new-password" minLength="12" maxLength="128" required /></div>
          <p className="field-error" id="recoveryError" role="status">{s.authError}</p>
          <button type="submit" className="btn btn-solid" style={{"justifyContent": "center"}} disabled={Boolean(s.busy)}>Update password</button>
        </form>
        <div id="authLinks" style={{"textAlign": "center", "marginTop": "24px", "fontSize": "0.85rem", "display": "flex", "flexDirection": "column", "gap": "10px"}} hidden={s.authMode === "recovery"}>
          <button type="button" id="authToggleBtn" style={{"background": "none", "border": "none", "borderBottom": "1px solid transparent", "color": "var(--ink-soft)", "cursor": "pointer", "padding": "0", "font": "inherit"}} onClick={() => s.changeAuth(s.authMode === "signin" ? "signup" : "signin")}>{s.authMode === "signin" ? "Create an account" : "Back to sign in"}</button>
          <button type="button" id="guestShippingBtn" style={{"background": "none", "border": "none", "borderBottom": "1px solid var(--line-strong)", "color": "var(--accent)", "cursor": "pointer", "padding": "4px 0", "font": "inherit", "fontSize": "0.82rem", "alignSelf": "center"}} onClick={s.showShipping}>Continue as Guest (Shipping Details) →</button>
          <button type="button" id="guestOrdersBtn" style={{"background": "none", "border": "none", "color": "var(--ink-soft)", "cursor": "pointer", "padding": "4px 0", "font": "inherit", "fontSize": "0.82rem", "alignSelf": "center"}} onClick={() => s.showHistory("orders")}>View Placed Orders →</button>
        </div>
      </div>

      <div className="account-body" id="accountSignedIn" style={{"height": "100%"}} hidden={s.authMode === "recovery" || (!s.user && !s.guest)}>
        <div id="signedInHeader" hidden={s.guest}>
          <p style={{"fontSize": "0.72rem", "letterSpacing": "0.1em", "color": "var(--ink-soft)", "margin": "0", "textTransform": "uppercase"}}>Signed in as</p>
          <p id="accountEmail" style={{"fontWeight": "700", "fontSize": "0.95rem", "marginBottom": "16px"}}>{s.user?.email}</p>
        </div>
        <div id="guestModeHeader" style={{"display": "flex", "justifyContent": "space-between", "alignItems": "center", "marginBottom": "16px"}} hidden={!s.guest}>
          <div>
            <h3 style={{"margin": "0", "fontFamily": "'Fraunces',serif", "fontSize": "1.4rem", "fontWeight": "400"}}>Guest Checkout</h3>
            <p style={{"margin": "2px 0 0", "fontSize": "0.75rem", "color": "var(--ink-soft)"}}>Shipping details for your order</p>
          </div>
          <button type="button" id="backToSignInBtn" className="btn btn-ghost" style={{"fontSize": "0.75rem", "padding": "6px 10px"}} onClick={() => { s.setGuest(false); s.changeAuth("signin"); }}>Sign In</button>
        </div>
        <section id="accountOrders" aria-live="polite" hidden={s.accountView === "shipping"}>
          <div style={{"display": "flex", "justifyContent": "space-between", "alignItems": "center", "marginBottom": "14px"}}>
            <h3 id="accountRouteTitle" style={{"margin": "0"}}>{s.accountView === "wishlist" ? "Your wishlist" : "Your orders"}</h3>
            <button type="button" id="backFromOrdersBtn" className="btn btn-ghost" style={{"fontSize": "0.75rem", "padding": "6px 12px"}} onClick={() => s.setAccountView("shipping")}>← Back</button>
          </div>
          <div id="accountRouteContent"><AccountHistory s={s} /></div>
        </section>

        <form className="checkout-form" id="checkoutForm" style={{"border": "none", "padding": "0"}} hidden={s.accountView !== "shipping"} onSubmit={s.saveAddress}>
          <h4 style={{"marginTop": "0"}}>Shipping Details</h4>
          <div className="field">
            <label htmlFor="shipName">Full name</label>
            <input type="text" id="shipName" name="name" autoComplete="name" required value={s.address.name || ""} onChange={event => s.setAddress(previous => ({...previous,name:event.target.value}))} />
          </div>
          <div className="field">
            <label htmlFor="shipEmail">Email</label>
            <input type="email" id="shipEmail" name="email" autoComplete="email" required value={s.address.email || ""} onChange={event => s.setAddress(previous => ({...previous,email:event.target.value}))} />
            <div style={{"display": "flex", "alignItems": "center", "gap": "8px", "marginTop": "6px"}}>
              <input type="checkbox" id="shipNewsletter" name="newsletter" style={{"width": "auto", "margin": "0", "padding": "0"}} checked={s.newsletterOptIn} onChange={event => s.setNewsletterOptIn(event.target.checked)} />
              <label htmlFor="shipNewsletter" style={{"fontSize": "0.75rem", "color": "var(--ink-soft)", "margin": "0", "cursor": "pointer"}}>Email me with news and offers</label>
            </div>
          </div>
          <div className="field">
            <label htmlFor="shipPhone">Phone</label>
            <input type="tel" id="shipPhone" name="phone" autoComplete="tel" required value={s.address.phone || ""} onChange={event => s.setAddress(previous => ({...previous,phone:event.target.value}))} />
          </div>
          <div className="form-row form-row-3">
            <div className="field">
              <label htmlFor="shipCity">City</label>
              <input type="text" id="shipCity" name="city" required value={s.address.city || ""} onChange={event => s.setAddress(previous => ({...previous,city:event.target.value}))} />
            </div>
            <div className="field">
              <label htmlFor="shipState">State</label>
              <input type="text" id="shipState" name="state" required value={s.address.state || ""} onChange={event => s.setAddress(previous => ({...previous,state:event.target.value}))} />
            </div>
            <div className="field">
              <label htmlFor="shipPin">PIN code</label>
              <input type="text" id="shipPin" name="pin" required value={s.address.pin || ""} onChange={event => s.setAddress(previous => ({...previous,pin:event.target.value}))} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="shipAddress1">House no, Building, Street</label>
            <input type="text" id="shipAddress1" name="address1" required value={s.address.address1 || ""} onChange={event => s.setAddress(previous => ({...previous,address1:event.target.value}))} />
          </div>
          <div className="field">
            <label htmlFor="shipAddress2">Apartment, suite, unit (optional)</label>
            <input type="text" id="shipAddress2" name="address2" value={s.address.address2 || ""} onChange={event => s.setAddress(previous => ({...previous,address2:event.target.value}))} />
          </div>
          <p className="field-error" id="shipError">{s.addressError}</p>
          <button className="btn btn-solid" id="saveAddressBtn" style={{"marginTop": "14px", "width": "100%", "justifyContent": "center"}} type={"submit"} disabled={s.busy === "address"}>Save & Return to Cart</button>
        </form>
        <button type="button" className="btn btn-ghost" id="signOutBtn" style={{"marginTop": "24px", "width": "100%", "justifyContent": "center"}} onClick={s.signOut} hidden={!s.user}>Sign Out</button>
      </div>
    </div>
  </div>
</div>
  </>;
}

export function SizeGuide({s}) {
  return <>
<div className="modal-backdrop" id="sizeGuideModal" role="dialog" aria-modal="true" aria-label="Find Your Fit" hidden={s.panel !== "size"} onClick={event => { if(event.target === event.currentTarget) s.close(); }}>
  <div className="modal">
    <div className="modal-head">
      <h3>Find Your Fit</h3>
      <button className="icon-btn" id="sizeGuideClose" aria-label="Close size guide" onClick={s.close}>Close ✕</button>
    </div>
    <p style={{"color": "var(--ink-soft)", "fontSize": "0.9rem", "margin": "0"}}>Measurements in inches, laid flat.</p>
    <div className="table-responsive">
      <table>
        <thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Sleeve</th></tr></thead>
        <tbody>
          <tr><td>S</td><td>38</td><td>28.5</td><td>24</td></tr>
          <tr><td>M</td><td>40</td><td>29.5</td><td>24.5</td></tr>
          <tr><td>L</td><td>42</td><td>30.5</td><td>25</td></tr>
          <tr><td>XL</td><td>44</td><td>31.5</td><td>25.5</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
  </>;
}

export function Hero({s}) {
  return <>
<div className="hero">
  <img src="/img/hero.jpg" alt="Man in a golden-brown swirl print organic cotton shirt leaning on a railing by the sea" />
  <span className="hero-tag">100% Organic Cotton</span>
  <div className="hero-copy">
    <span className="eyebrow">Hand block-print motifs · Coconut shell buttons</span>
    <h1>Prints with a <em>past</em>,<br />cotton that <em>breathes</em>.</h1>
    <p>Every Algodon shirt starts as a motif drawn by hand — jali lattices, lotus blooms, paisley swirls — then set onto organic cotton, cut small-batch and finished with coconut shell buttons.</p>
    <div className="hero-actions">
      <a href="#edit" className="btn btn-solid">Shop the Print Edit</a>
      <a href="#story" className="btn btn-ghost">Read Our Story</a>
    </div>
  </div>
</div>
<div className="marquee-wrap" aria-hidden="true">
  <div className="marquee">
    <span>Golden-Brown Swirl</span>
    <span>Rajasthan Jali</span>
    <span>Kamal Ka Phool</span>
    <span>Rangeen Pakshee</span>
    <span>Golden-Brown Swirl</span>
    <span>Rajasthan Jali</span>
    <span>Kamal Ka Phool</span>
    <span>Rangeen Pakshee</span>
  </div>
</div>
  </>;
}

export function Story({s}) {
  return <>
<section id="story" className="story">
  <img src="/img/story-label.jpg" alt="Close-up of the Algodon Organic woven label inside a pink jali print collar" />
  <div>
    <span className="eyebrow">Made With Intention</span>
    <h2>Block print, not boilerplate.</h2>
    <p>Each motif is drawn before it's ever printed — the swirl, the lattice, the lotus — then set onto cotton grown and woven without shortcuts. No synthetic fibre blends, no plastic buttons.</p>
    <p>The label inside every collar says the same thing the shirt does: this was made on purpose.</p>
    <div className="story-facts">
      <div><strong>100%</strong><span>Organic cotton, every shirt</span></div>
      <div><strong>4</strong><span>Motifs drawn in-house this season</span></div>
      <div><strong>0</strong><span>Plastic buttons — coconut shell only</span></div>
    </div>
  </div>
</section>
<figure className="band">
  <img src="/img/story-texture.jpg" alt="Close-up of the golden-brown swirl print catching the light" />
  <figcaption>Shot on the coast, printed inland — Golden-Brown Swirl</figcaption>
</figure>
<section className="trust">
  <div className="item">
    <div className="icon">→</div>
    <div>
      <h3>Ships Pan-India</h3>
      <p>Free shipping on every order, dispatched within 48 hours.</p>
    </div>
  </div>
  <div className="item">
    <div className="icon">↔</div>
    <div>
      <h3>Find Your Fit</h3>
      <p>New to Algodon? Our size guide gets you right the first time.</p>
    </div>
  </div>
  <div className="item">
    <div className="icon">?</div>
    <div>
      <h3>Talk to Us</h3>
      <p>Questions on fit, care or a custom order — we reply ourselves.</p>
    </div>
  </div>
</section>
  </>;
}

export function Footer({s}) {
  return <>
<footer>
  <div className="footer-grid">
    <div>
      <a href="#" className="wordmark">ALGODON<span className="sub">ORGANIC</span></a>
      <p className="blurb">Small-batch organic cotton shirts in hand block-print motifs, cut and finished in India.</p>
      <form className="newsletter" id="newsletterForm" onSubmit={s.subscribe}>
        <input type="email" id="newsletterEmail" placeholder="Your email" required aria-label="Email for 10% off" />
        <button type="submit" id="newsletterSubmit" disabled={s.busy === "newsletter"}>Get 10% Off</button>
      </form>
      <p className="newsletter-msg" id="newsletterMsg">{s.newsletterMessage}</p>
      <p className="newsletter-msg" id="signupCount" hidden></p>
    </div>
    <div>
      <h4>Shop</h4>
      <ul>
        <li><a href="#edit">All Shirts</a></li>
        <li><a href="#edit">New Prints</a></li>
        <li><a href="#edit">Sale</a></li>
      </ul>
    </div>
    <div>
      <h4>Help</h4>
      <ul>
        <li><a href="#" onClick={event => { event.preventDefault(); s.open("size"); }}>Size Guide</a></li>
        <li><a href="#">Shipping</a></li>
        <li><a href="#">Contact</a></li>
      </ul>
    </div>
    <div>
      <h4>Brand</h4>
      <ul>
        <li><a href="#story">Our Story</a></li>
        <li><a href="#edit">The Prints</a></li>
      </ul>
    </div>
  </div>
  <div className="footer-bottom">
    <span>© Algodon Organic</span>
    <span>Design concept — prepared for review</span>
  </div>
</footer>
  </>;
}
