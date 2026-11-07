import { useState } from 'react';
import { CartItems, AccountHistory } from './Panels.jsx';

export function Header({s}) {
  return (
    <>
      <div className="top-bar">Free shipping across India · Prints ship within 48 hours</div>
      <header id="siteHeader" className={`site${s.scrolled ? " scrolled" : ""}${s.menuOpen ? " menu-open" : ""}`}>
        <button className="hamburger" id="navToggle" aria-label="Open menu" aria-controls="primaryNav" onClick={() => s.setMenuOpen(!s.menuOpen)} aria-expanded={s.menuOpen}>
          <span></span><span></span><span></span>
        </button>
        <nav id="primaryNav" className={`primary${s.menuOpen ? " open" : ""}`}>
          <a href="#shirts" data-nav-link onClick={() => s.setMenuOpen(false)}>Shirts</a>
          <a href="#prints" data-nav-link onClick={() => s.setMenuOpen(false)}>Prints</a>
          <a href="#story" data-nav-link onClick={() => s.setMenuOpen(false)}>Our Story</a>
          <a href="#" id="sizeGuideLink" data-nav-link onClick={event => { event.preventDefault(); s.open("size"); }}>Size Guide</a>
        </nav>
        <a href="#" className="wordmark" onClick={event => { event.preventDefault(); window.scrollTo({top: 0, behavior: 'smooth'}); }}>
          ALGODON<span className="sub">ORGANIC</span>
        </a>
        <nav className="icons">
          <button className="icon-btn" id="searchToggle" aria-label="Search" onClick={() => s.open("search")}>Search</button>
          <div className="account-nav">
            {s.isAdmin && (
              <button
                type="button"
                className="btn btn-ghost"
                id="navAdminDashboardBtn"
                style={{ padding: "5px 11px", fontSize: "0.75rem", borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 700, marginRight: "8px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                onClick={() => s.open("admin")}
              >
                ⚙ Admin Dashboard
              </button>
            )}
            <button
              className="icon-btn"
              id="accountToggle"
              aria-label="Account"
              aria-haspopup="true"
              onClick={() => s.openAccount()}
              aria-expanded={s.accountMenu}
            >
              <img id="accountAvatar" alt="" hidden />
              <span id="accountNavLabel">
                {s.user ? (s.isAdmin ? "Admin ⚙" : (s.user.user_metadata?.full_name?.split(" ")[0] || "Profile")) : "Sign In"}
              </span>
            </button>
          </div>
          <button className="icon-btn" id="cartToggle" aria-label="Open cart" onClick={() => s.open("cart")}>
            Cart<span id="cartCount">{s.cart.reduce((total, item) => total + item.qty, 0)}</span>
          </button>
        </nav>
      </header>
    </>
  );
}

export function CartDrawer({s}) {
  return (
    <>
      <aside id="cartDrawer" role="dialog" aria-modal={s.panel === "cart"} aria-label="Shopping cart" inert={s.panel !== 'cart'} aria-hidden={s.panel !== 'cart'} className={`cart-drawer${s.panel === "cart" ? " open" : ""}`}>
        <div className="cart-head">
          <h3>Your Cart</h3>
          <button className="icon-btn" id="cartClose" aria-label="Close cart" onClick={s.close}>Close ✕</button>
        </div>
        <div className="cart-items" id="cartItems">
          <CartItems s={s} />
        </div>

        <div className="cart-foot">
          <div className="cart-subtotal"><span>Subtotal</span><span id="cartSubtotal">{s.money(s.subtotal)}</span></div>
          <div style={{ display: "flex", gap: "8px", margin: "12px 0" }}>
            <input
              id="couponCode"
              aria-label="Coupon code"
              placeholder="Coupon code (e.g. WELCOME10)"
              style={{ flex: "1", minWidth: "0", padding: "10px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", borderRadius: "4px" }}
              value={s.couponCode}
              onChange={event => s.setCouponCode(event.target.value)}
            />
            <button className="btn btn-ghost" type="button" id="applyCouponBtn" onClick={s.applyCoupon} disabled={s.busy === "coupon"}>
              {s.busy === "coupon" ? "Applying…" : "Apply"}
            </button>
          </div>
          <p id="couponMessage" className="cart-note" aria-live="polite" hidden={!s.couponMessage} style={{ color: s.coupon ? '#27ae60' : 'var(--accent)', fontWeight: 600 }}>
            {s.couponMessage}
          </p>
          <div className="cart-subtotal" id="cartDiscountRow" hidden={!s.coupon} style={{ color: '#27ae60' }}>
            <span>Discount ({s.coupon?.code})</span>
            <span id="cartDiscount">{`− ${s.money(s.coupon?.discount || 0)}`}</span>
          </div>
          <div className="cart-subtotal" style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
            <span>Pan-India Express Delivery</span>
            <span style={{ color: "#27ae60", fontWeight: 700 }}>FREE</span>
          </div>
          <div className="cart-subtotal" style={{ fontWeight: 700, fontSize: "1.1rem", borderTop: "1px solid var(--line)", paddingTop: "10px" }}>
            <span>Total Payable</span>
            <span>{s.money(s.total)}</span>
          </div>
          <button
            className="btn btn-solid"
            style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px", padding: "14px", marginTop: "12px", fontSize: "0.95rem" }}
            id="checkoutBtn"
            onClick={s.checkout}
            disabled={s.busy === "checkout" || !s.cart.length}
          >
            {s.busy === "checkout" ? "Opening Secure Checkout…" : s.cart.length ? `Secure Checkout · ${s.money(s.total)}` : "Secure Checkout"}
          </button>
          {s.cartNote && <p className="cart-note" id="cartNote" style={{ marginTop: "8px", textAlign: "center" }}>{s.cartNote}</p>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginTop: "8px", fontSize: "0.74rem", color: "var(--ink-soft)" }}>
            <span>🔒 256-bit Encrypted Checkout · Instant Razorpay Payment</span>
          </div>

          {/* Checkout Policies Mention */}
          <div className="cart-policy-notice" style={{ marginTop: "12px", padding: "10px 12px", background: "rgba(0,0,0,0.03)", borderRadius: "6px", border: "1px solid var(--line)" }}>
            <p style={{ margin: "0", fontSize: "0.74rem", color: "var(--ink-soft)", lineHeight: 1.45, textAlign: "center" }}>
              By checking out, you agree to Algodon’s{' '}
              <a href="#" style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 600 }} onClick={e => { e.preventDefault(); s.openHelp('refund'); }}>Refund Policy</a>,{' '}
              <a href="#" style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 600 }} onClick={e => { e.preventDefault(); s.openHelp('shipping'); }}>Shipping Policy</a>, and{' '}
              <a href="#" style={{ color: "var(--accent)", textDecoration: "underline", fontWeight: 600 }} onClick={e => { e.preventDefault(); s.openHelp('terms'); }}>Terms & Privacy</a>.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "6px", fontSize: "0.72rem", color: "var(--ink)", fontWeight: 500 }}>
              <span>✓ 7-Day Free Returns</span>
              <span>✓ Automated Razorpay Refund</span>
            </div>
          </div>

          <button className="btn btn-ghost" id="downloadInvoiceBtn" style={{ width: "100%", justifyContent: "center", marginTop: "10px", color: "var(--ink)", borderColor: "var(--line-strong)" }} hidden={!s.lastOrder} onClick={() => s.downloadInvoice(s.lastOrder)}>
            Download Invoice (PDF)
          </button>
        </div>
      </aside>
    </>
  );
}

export function AccountDrawer({s}) {
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <>
      <div
        className="modal-backdrop"
        id="accountDrawer"
        role="dialog"
        aria-modal="true"
        aria-label="Account"
        hidden={s.panel !== "account"}
        onClick={event => { if (event.target === event.currentTarget) s.close(); }}
      >
        <div
          className="modal"
          style={{
            padding: "0",
            maxWidth: "920px",
            width: "94%",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
            background: "#1e1a17",
            borderRadius: "22px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7)",
            position: "relative"
          }}
        >
          {/* Close button in top-right */}
          <button
            type="button"
            id="accountClose"
            aria-label="Close account panel"
            style={{
              position: "absolute",
              top: "16px",
              right: "18px",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              color: "#e8ded2",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              zIndex: "10",
              fontSize: "0.85rem",
              transition: "background 0.2s"
            }}
            onClick={s.close}
          >
            ✕
          </button>

          {/* Left Side: Photo with 100% Organic Cotton badge & 3 features at bottom */}
          <div
            className="modal-image-side"
            style={{
              flex: 1.1,
              minHeight: "560px",
              background: "url('/img/hero.jpg') center/cover no-repeat",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "36px 32px",
              boxSizing: "border-box"
            }}
          >
            {/* Dark gradient overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(18, 14, 11, 0.05) 0%, rgba(18, 14, 11, 0.35) 45%, rgba(18, 14, 11, 0.94) 100%)",
                pointerEvents: "none"
              }}
            />

            <div style={{ position: "relative", zIndex: 2 }}>
              {/* Badge: 100% Organic Cotton */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "#e8ded2", marginBottom: "8px", fontWeight: 500 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
                </svg>
                <span>100% Organic Cotton</span>
              </div>

              {/* Title: Natural Comfort, Everyday Style */}
              <h3 style={{ margin: "0 0 12px 0", fontFamily: "'Fraunces', serif", fontSize: "1.95rem", lineHeight: 1.2, fontWeight: 300, color: "#ffffff", letterSpacing: "-0.01em" }}>
                Natural Comfort,<br />Everyday Style
              </h3>

              {/* Tan accent line */}
              <div style={{ width: "42px", height: "2px", background: "#c5a880", marginBottom: "22px" }} />

              {/* 3 feature columns at bottom */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.12)", paddingTop: "18px" }}>
                {/* 1. Organic Materials */}
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255, 255, 255, 0.08)", display: "grid", placeItems: "center", color: "#c5a880" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
                      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "#ded6c9", lineHeight: 1.25, fontWeight: 500 }}>
                    Organic<br />Materials
                  </span>
                </div>

                {/* 2. Skin Friendly */}
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255, 255, 255, 0.08)", display: "grid", placeItems: "center", color: "#c5a880" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "#ded6c9", lineHeight: 1.25, fontWeight: 500 }}>
                    Skin<br />Friendly
                  </span>
                </div>

                {/* 3. Lasting Durability */}
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255, 255, 255, 0.08)", display: "grid", placeItems: "center", color: "#c5a880" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4Z"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "#ded6c9", lineHeight: 1.25, fontWeight: 500 }}>
                    Lasting<br />Durability
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Dark Luxury Form Pane */}
          <div
            className="account-form-pane"
            style={{
              flex: 1,
              padding: "40px 38px",
              background: "#1e1a17",
              color: "#f5f0eb",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              overflowY: "auto"
            }}
          >
            {/* 1. SIGNED OUT VIEW */}
            {!s.user && !s.guest && (
              <div className="account-body" id="accountSignedOut" style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", padding: 0 }}>
                <div style={{ marginBottom: "22px" }}>
                  <h2 id="authTitle" style={{ margin: "0 0 6px 0", fontFamily: "'Fraunces', serif", fontSize: "2rem", fontWeight: "300", color: "#ffffff", letterSpacing: "-0.01em" }}>
                    {s.authMode === "signup" ? "Create Account" : s.authMode === "reset" ? "Reset Password" : "Sign In"}
                  </h2>
                  <p style={{ margin: "0", fontSize: "0.85rem", color: "#a0978d", lineHeight: 1.4 }}>
                    {s.authMode === "reset"
                      ? "Enter your email to receive recovery instructions."
                      : "Access your profile, orders, and shipping address."}
                  </p>
                </div>

                {/* Continue with Google button */}
                <button
                  type="button"
                  id="googleSignInBtn"
                  onClick={s.signInWithGoogle}
                  disabled={s.busy === 'google_auth'}
                  style={{
                    width: "100%",
                    background: "#ffffff",
                    color: "#1f1f1f",
                    border: "none",
                    borderRadius: "9999px",
                    padding: "13px 20px",
                    fontSize: "0.92rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
                    marginBottom: "18px",
                    transition: "transform 0.15s, box-shadow 0.15s"
                  }}
                >
                  {s.busy === 'google_auth' ? (
                    <span>Connecting with Google…</span>
                  ) : (
                    <>
                      <svg width="19" height="19" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                {/* Divider: or sign in with email */}
                <div style={{ display: "flex", alignItems: "center", textAlign: "center", color: "#8c847a", fontSize: "0.78rem", marginBottom: "18px" }}>
                  <hr style={{ flex: 1, border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.12)" }} />
                  <span style={{ padding: "0 12px", whiteSpace: "nowrap" }}>or sign in with email</span>
                  <hr style={{ flex: 1, border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.12)" }} />
                </div>

                {/* Form */}
                <form id="signInForm" onSubmit={s.submitAuth} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {s.authMode === "signup" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#161311", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "10px", padding: "12px 14px" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c847a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        id="signUpName"
                        name="name"
                        placeholder="Full name"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        required
                        style={{ flex: 1, background: "transparent", border: "none", color: "#ffffff", fontSize: "0.88rem", outline: "none" }}
                      />
                    </div>
                  )}

                  {/* Email input */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#161311", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "10px", padding: "12px 14px" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c847a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    <input
                      type="email"
                      id="signInEmail"
                      name="email"
                      autoComplete="username email"
                      placeholder="Email address"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      required
                      style={{ flex: 1, background: "transparent", border: "none", color: "#ffffff", fontSize: "0.88rem", outline: "none" }}
                    />
                  </div>

                  {/* Password input with eye toggle */}
                  {s.authMode !== "reset" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#161311", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: "10px", padding: "12px 14px" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c847a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <input
                        type={showPassword ? "text" : "password"}
                        id="signInPassword"
                        name="password"
                        autoComplete={s.authMode === "signup" ? "new-password" : "current-password"}
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        style={{ flex: 1, background: "transparent", border: "none", color: "#ffffff", fontSize: "0.88rem", outline: "none" }}
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(prev => !prev)}
                        style={{ background: "none", border: "none", color: "#8c847a", cursor: "pointer", display: "grid", placeItems: "center", padding: "0" }}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                            <line x1="2" x2="22" y1="2" y2="22"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Remember me & Forgot password */}
                  {s.authMode === "signin" && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", margin: "2px 0 4px 0" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#b5ada2" }}>
                        <input
                          type="checkbox"
                          name="rememberMe"
                          checked={rememberMe}
                          onChange={e => setRememberMe(e.target.checked)}
                          style={{ accentColor: "#a77c52", width: "15px", height: "15px", cursor: "pointer" }}
                        />
                        <span>Remember me</span>
                      </label>
                      <button
                        type="button"
                        id="forgotPasswordBtn"
                        onClick={() => s.changeAuth("reset")}
                        style={{ background: "none", border: "none", color: "#c5a880", cursor: "pointer", padding: "0", fontSize: "0.82rem", fontWeight: 500 }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {s.authError && (
                    <p className="field-error" id="signInError" style={{ color: "#e76f51", fontSize: "0.8rem", margin: "0" }}>
                      {s.authError}
                    </p>
                  )}

                  {/* Sign In button */}
                  <button
                    type="submit"
                    disabled={Boolean(s.busy)}
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, #a77c52 0%, #8b5e34 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "12px",
                      padding: "14px",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      marginTop: "4px",
                      boxShadow: "0 4px 14px rgba(167, 124, 82, 0.35)",
                      transition: "opacity 0.15s, transform 0.15s"
                    }}
                  >
                    {s.busy === "auth"
                      ? "Please wait…"
                      : s.authMode === "signup"
                      ? "Create Account"
                      : s.authMode === "reset"
                      ? "Send Reset Link"
                      : "Sign In"}
                  </button>
                </form>

                {/* Footer link */}
                <div style={{ textAlign: "center", marginTop: "18px", fontSize: "0.84rem", color: "#a0978d" }}>
                  {s.authMode === "signup" ? (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => s.changeAuth("signin")}
                        style={{ background: "none", border: "none", color: "#ffffff", textDecoration: "underline", fontWeight: 600, cursor: "pointer", padding: "0" }}
                      >
                        Sign In
                      </button>
                    </>
                  ) : s.authMode === "reset" ? (
                    <button
                      type="button"
                      onClick={() => s.changeAuth("signin")}
                      style={{ background: "none", border: "none", color: "#c5a880", textDecoration: "underline", fontWeight: 500, cursor: "pointer", padding: "0" }}
                    >
                      ← Back to Sign In
                    </button>
                  ) : (
                    <>
                      Don't have an account?{" "}
                      <button
                        type="button"
                        id="createAccountLink"
                        onClick={() => s.changeAuth("signup")}
                        style={{ background: "none", border: "none", color: "#ffffff", textDecoration: "underline", fontWeight: 600, cursor: "pointer", padding: "0" }}
                      >
                        Create Account
                      </button>
                    </>
                  )}
                </div>

                <div style={{ textAlign: "center", marginTop: "14px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "12px" }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#c5a880", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer", textDecoration: "underline" }}
                    onClick={() => { s.setGuest(true); s.setAccountView('shipping'); }}
                  >
                    Checking out? Enter shipping address & contact phone →
                  </button>
                </div>
              </div>
            )}

            {/* 1B. GUEST SHIPPING & CONTACT NUMBER VIEW */}
            {!s.user && s.guest && (
              <div className="account-body" id="guestShippingView" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ marginBottom: "18px" }}>
                  <span className="eyebrow" style={{ color: "var(--accent)" }}>Checkout & Shipping</span>
                  <h2 style={{ margin: "4px 0 0", fontFamily: "'Fraunces', serif", fontSize: "1.7rem", fontWeight: "300" }}>
                    Delivery Address & Phone
                  </h2>
                  <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                    Please enter your delivery destination and contact phone number for courier dispatch.
                  </p>
                </div>

                <form className="checkout-form" id="guestCheckoutForm" style={{ border: "none", padding: "0" }} onSubmit={async (e) => {
                  e.preventDefault();
                  await s.saveAddress(e);
                  s.open('cart');
                }}>
                  <div className="field">
                    <label htmlFor="guestShipName">Full Name</label>
                    <input type="text" id="guestShipName" name="name" autoComplete="name" required value={s.address.name || ""} onChange={event => s.setAddress(previous => ({ ...previous, name: event.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="guestShipEmail">Email Address (for invoice & receipt)</label>
                    <input type="email" id="guestShipEmail" name="email" autoComplete="email" required value={s.address.email || ""} onChange={event => s.setAddress(previous => ({ ...previous, email: event.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="guestShipPhone">Phone Number (for courier delivery & SMS tracking)</label>
                    <input type="tel" id="guestShipPhone" name="phone" autoComplete="tel" placeholder="e.g. 9876543210" required value={s.address.phone || ""} onChange={event => s.setAddress(previous => ({ ...previous, phone: event.target.value }))} />
                    <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)", marginTop: "4px", display: "block" }}>
                      Required for delivery coordination and dispatch SMS updates.
                    </span>
                  </div>
                  <div className="form-row form-row-3">
                    <div className="field">
                      <label htmlFor="guestShipCity">City</label>
                      <input type="text" id="guestShipCity" name="city" required value={s.address.city || ""} onChange={event => s.setAddress(previous => ({ ...previous, city: event.target.value }))} />
                    </div>
                    <div className="field">
                      <label htmlFor="guestShipState">State</label>
                      <input type="text" id="guestShipState" name="state" required value={s.address.state || ""} onChange={event => s.setAddress(previous => ({ ...previous, state: event.target.value }))} />
                    </div>
                    <div className="field">
                      <label htmlFor="guestShipPin">PIN Code</label>
                      <input type="text" id="guestShipPin" name="pin" required value={s.address.pin || ""} onChange={event => s.setAddress(previous => ({ ...previous, pin: event.target.value }))} />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="guestShipAddress1">House no, Building, Street</label>
                    <input type="text" id="guestShipAddress1" name="address1" required value={s.address.address1 || ""} onChange={event => s.setAddress(previous => ({ ...previous, address1: event.target.value }))} />
                  </div>
                  <p className="field-error">{s.addressError}</p>
                  <button className="btn btn-solid" style={{ marginTop: "12px", width: "100%", justifyContent: "center" }} type="submit" disabled={s.busy === "address"}>
                    {s.busy === "address" ? "Saving…" : "Save & Proceed to Checkout →"}
                  </button>
                  <div style={{ textAlign: "center", marginTop: "14px" }}>
                    <button type="button" style={{ background: "none", border: "none", color: "var(--ink-soft)", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }} onClick={() => s.setGuest(false)}>
                      ← Back to Email Sign In
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. SIGNED IN VIEW */}
            {s.user && (
              <div className="account-body" id="accountSignedIn" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {/* 2A. ADMIN DASHBOARD ACCESS CARD */}
                {s.isAdmin ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div>
                        <span style={{ background: "var(--accent)", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "3px 8px", borderRadius: "4px", textTransform: "uppercase" }}>
                          Super Admin
                        </span>
                        <h3 style={{ margin: "6px 0 2px", fontFamily: "'Fraunces', serif", fontSize: "1.6rem", fontWeight: 400 }}>Store Administration</h3>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-soft)" }}>Signed in as {s.user.email}</p>
                      </div>
                    </div>

                    <div style={{ background: "var(--card)", border: "1px solid var(--accent)", borderRadius: "8px", padding: "18px 20px", marginBottom: "20px" }}>
                      <p style={{ margin: "0 0 14px", fontSize: "0.85rem", color: "var(--ink)", lineHeight: 1.5 }}>
                        You have full administrative privileges to manage products, categories, customer orders, coupons, and live store metrics.
                      </p>
                      <button
                        type="button"
                        className="btn btn-solid"
                        style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: "0.95rem" }}
                        onClick={() => s.open('admin')}
                      >
                        Open Store Admin Dashboard ⚙
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "12px", justifyContent: "center", fontSize: "0.82rem" }}
                        onClick={() => s.open('admin')}
                      >
                        📦 Catalog & Inventory
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "12px", justifyContent: "center", fontSize: "0.82rem" }}
                        onClick={() => s.open('admin')}
                      >
                        🏷️ Promo Coupons
                      </button>
                    </div>

                    <button type="button" className="btn btn-ghost" id="signOutBtn" style={{ width: "100%", justifyContent: "center", color: "var(--accent)" }} onClick={s.signOut}>
                      Sign Out of Administration
                    </button>
                  </div>
                ) : (
                  /* 2B. CUSTOMER PROFILE PAGE */
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                      <div>
                        <span className="eyebrow" style={{ color: "var(--accent)" }}>Customer Profile</span>
                        <h3 style={{ margin: "2px 0 0", fontFamily: "'Fraunces', serif", fontSize: "1.5rem" }}>
                          {s.user.user_metadata?.full_name || s.user.full_name || 'Welcome!'}
                        </h3>
                        <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--ink-soft)" }}>{s.user.email || s.user.phone}</p>
                      </div>
                    </div>

                    {/* Sub Navigation */}
                    <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--line)", marginBottom: "16px" }}>
                      <button
                        type="button"
                        onClick={() => s.setAccountView('profile')}
                        style={{ background: 'none', border: 'none', borderBottom: s.accountView === 'profile' || s.accountView === 'shipping' ? '2px solid var(--accent)' : '2px solid transparent', padding: '8px 12px', fontWeight: 600, fontSize: '0.82rem', color: s.accountView === 'profile' || s.accountView === 'shipping' ? 'var(--accent)' : 'var(--ink-soft)', cursor: 'pointer' }}
                      >
                        Shipping Address
                      </button>
                      <button
                        type="button"
                        onClick={() => s.setAccountView('orders')}
                        style={{ background: 'none', border: 'none', borderBottom: s.accountView === 'orders' ? '2px solid var(--accent)' : '2px solid transparent', padding: '8px 12px', fontWeight: 600, fontSize: '0.82rem', color: s.accountView === 'orders' ? 'var(--accent)' : 'var(--ink-soft)', cursor: 'pointer' }}
                      >
                        My Orders
                      </button>
                      <button
                        type="button"
                        onClick={() => s.setAccountView('wishlist')}
                        style={{ background: 'none', border: 'none', borderBottom: s.accountView === 'wishlist' ? '2px solid var(--accent)' : '2px solid transparent', padding: '8px 12px', fontWeight: 600, fontSize: '0.82rem', color: s.accountView === 'wishlist' ? 'var(--accent)' : 'var(--ink-soft)', cursor: 'pointer' }}
                      >
                        Wishlist
                      </button>
                    </div>

                    {/* Orders & Wishlist Sub-View */}
                    {(s.accountView === 'orders' || s.accountView === 'wishlist') && (
                      <section id="accountOrders" aria-live="polite">
                        <div id="accountRouteContent">
                          <AccountHistory s={s} />
                        </div>
                      </section>
                    )}

                    {/* Shipping Address Form */}
                    {(s.accountView === 'profile' || s.accountView === 'shipping') && (
                      <form className="checkout-form" id="checkoutForm" style={{ border: "none", padding: "0" }} onSubmit={s.saveAddress}>
                        <div className="field">
                          <label htmlFor="shipName">Full name</label>
                          <input type="text" id="shipName" name="name" autoComplete="name" required value={s.address.name || ""} onChange={event => s.setAddress(previous => ({ ...previous, name: event.target.value }))} />
                        </div>
                        <div className="field">
                          <label htmlFor="shipEmail">Email</label>
                          <input type="email" id="shipEmail" name="email" autoComplete="email" required value={s.address.email || ""} onChange={event => s.setAddress(previous => ({ ...previous, email: event.target.value }))} />
                        </div>
                        <div className="field">
                          <label htmlFor="shipPhone">Phone number (for courier delivery & SMS tracking)</label>
                          <input type="tel" id="shipPhone" name="phone" autoComplete="tel" placeholder="e.g. 9876543210" required value={s.address.phone || ""} onChange={event => s.setAddress(previous => ({ ...previous, phone: event.target.value }))} />
                          <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)", marginTop: "4px", display: "block" }}>
                            Required for delivery coordination and dispatch SMS updates.
                          </span>
                        </div>
                        <div className="form-row form-row-3">
                          <div className="field">
                            <label htmlFor="shipCity">City</label>
                            <input type="text" id="shipCity" name="city" required value={s.address.city || ""} onChange={event => s.setAddress(previous => ({ ...previous, city: event.target.value }))} />
                          </div>
                          <div className="field">
                            <label htmlFor="shipState">State</label>
                            <input type="text" id="shipState" name="state" required value={s.address.state || ""} onChange={event => s.setAddress(previous => ({ ...previous, state: event.target.value }))} />
                          </div>
                          <div className="field">
                            <label htmlFor="shipPin">PIN code</label>
                            <input type="text" id="shipPin" name="pin" required value={s.address.pin || ""} onChange={event => s.setAddress(previous => ({ ...previous, pin: event.target.value }))} />
                          </div>
                        </div>
                        <div className="field">
                          <label htmlFor="shipAddress1">House no, Building, Street</label>
                          <input type="text" id="shipAddress1" name="address1" required value={s.address.address1 || ""} onChange={event => s.setAddress(previous => ({ ...previous, address1: event.target.value }))} />
                        </div>
                        <p className="field-error" id="shipError">{s.addressError}</p>
                        <button className="btn btn-solid" id="saveAddressBtn" style={{ marginTop: "12px", width: "100%", justifyContent: "center" }} type="submit" disabled={s.busy === "address"}>
                          Save Shipping Details
                        </button>
                      </form>
                    )}

                    <button type="button" className="btn btn-ghost" id="signOutBtn" style={{ marginTop: "24px", width: "100%", justifyContent: "center" }} onClick={s.signOut}>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function HelpModal({s}) {
  if (s.panel !== 'help' || !s.helpTopic) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Help & Information"
      onClick={e => { if (e.target === e.currentTarget) s.closeHelp(); }}
    >
      <div className="modal" style={{ maxWidth: '640px', width: '92%', padding: '32px', position: 'relative', background: 'var(--surface)', borderRadius: '8px' }}>
        <button className="icon-btn" aria-label="Close help" onClick={s.closeHelp} style={{ position: 'absolute', top: '18px', right: '18px' }}>✕</button>

        {s.helpTopic === 'shipping' && (
          <div>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Help & Policies</span>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.6rem', margin: '4px 0 14px' }}>Pan-India Shipping & Delivery</h3>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>Free Express Shipping:</strong> Every order on Algodon Organic qualifies for 100% free delivery across India with zero minimum cart requirements.
            </p>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>48-Hour Dispatch:</strong> Each block-printed shirt is inspected, steam-pressed, and hand-packed in plastic-free recycled paper within 24–48 hours of order confirmation.
            </p>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>Couriers & Tracking:</strong> Dispatched via our tier-1 logistics partners BlueDart and Delhivery Express. Real-time SMS and email tracking links are delivered the moment your package departs the Rajasthan workshop. Delivery arrives within 2–4 business days.
            </p>
          </div>
        )}

        {(s.helpTopic === 'returns' || s.helpTopic === 'refund') && (
          <div>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Help & Policies</span>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.6rem', margin: '4px 0 14px' }}>7-Day Refund & Return Policy</h3>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>100% Hassle-Free Returns:</strong> If the fit, feel, or motif isn't exactly as expected, you have a full 7 days from the delivery date to request a free return or size exchange directly from your account page.
            </p>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>Automated Razorpay Refunds:</strong> Once return pickup is requested, our system automatically initiates the refund via Razorpay back to your original payment method (UPI / Credit Card / Debit Card / Netbanking). Funds typically credit within 2–5 business days with zero deduction or restocking fees.
            </p>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>Free Doorstep Pickup:</strong> Our logistics partners BlueDart and Delhivery will arrive at your address to collect the garment with plastic-free packaging.
            </p>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>Conditions:</strong> Shirts must be unwashed, unworn, and have all original organic cotton tags attached.
            </p>
          </div>
        )}

        {s.helpTopic === 'terms' && (
          <div>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Help & Policies</span>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.6rem', margin: '4px 0 14px' }}>Terms of Service</h3>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>Artisanal Craftsmanship:</strong> Algodon shirts are hand block-printed using hand-carved teakwood blocks and natural azo-free dyes. Subtle variations in pigment density and print alignment are hallmarks of genuine craft, not defects.
            </p>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>Secure Transactions:</strong> All transactions are securely processed through Razorpay Standard Web Checkout. We never store or inspect your raw card numbers or UPI MPIN.
            </p>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>Jurisdiction:</strong> Governed by the laws of Rajasthan, India. All disputes are subject to the exclusive jurisdiction of the courts in Jaipur.
            </p>
          </div>
        )}

        {s.helpTopic === 'privacy' && (
          <div>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Help & Policies</span>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.6rem', margin: '4px 0 14px' }}>Privacy Policy</h3>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>Customer Privacy Commitment:</strong> We collect your name, phone number, email address, and shipping address solely for one-time password (OTP) verification, order dispatch, and sending automated tax invoice receipts.
            </p>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              <strong>No Third-Party Sharing:</strong> We do not sell, rent, or share personal contact data with advertising brokers. 256-bit encryption safeguards every session.
            </p>
          </div>
        )}

        {s.helpTopic === 'contact' && (
          <div>
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Help & Policies</span>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.6rem', margin: '4px 0 14px' }}>Contact Algodon Concierge</h3>
            <p style={{ color: 'var(--ink)', lineHeight: 1.6, fontSize: '0.9rem' }}>
              We are a small-batch artisan menswear studio. Our concierge team personally reads and responds to every customer message.
            </p>
            <div style={{ background: 'var(--card)', padding: '16px', borderRadius: '6px', margin: '14px 0', fontSize: '0.88rem' }}>
              <div style={{ marginBottom: '8px' }}><strong>Email:</strong> concierge@algodonfashion.com</div>
              <div style={{ marginBottom: '8px' }}><strong>WhatsApp Concierge:</strong> +91 98290 14280 (10 AM – 7 PM IST)</div>
              <div><strong>Workshop:</strong> Sanganer & Bagru Craft Cluster, Jaipur, Rajasthan, India</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SizeGuide({s}) {
  return (
    <>
      <div className="modal-backdrop" id="sizeGuideModal" role="dialog" aria-modal="true" aria-label="Find Your Fit" hidden={s.panel !== "size"} onClick={event => { if (event.target === event.currentTarget) s.close(); }}>
        <div className="modal">
          <div className="modal-head">
            <h3>Find Your Fit</h3>
            <button className="icon-btn" id="sizeGuideClose" aria-label="Close size guide" onClick={s.close}>Close ✕</button>
          </div>
          <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", margin: "0" }}>Measurements in inches, laid flat.</p>
          <div className="table-responsive">
            <table>
              <thead><tr><th>Size</th><th>Chest</th><th>Length</th><th>Sleeve</th><th>Shoulder</th></tr></thead>
              <tbody>
                <tr><td>S</td><td>38</td><td>28.5</td><td>24</td><td>17.5</td></tr>
                <tr><td>M</td><td>40</td><td>29.5</td><td>24.5</td><td>18.25</td></tr>
                <tr><td>L</td><td>42</td><td>30.5</td><td>25</td><td>19</td></tr>
                <tr><td>XL</td><td>44</td><td>31.5</td><td>25.5</td><td>19.75</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export function Hero({s}) {
  return (
    <>
      <div className="hero">
        <img src="/img/hero.jpg" alt="Man in a golden-brown swirl print organic cotton shirt leaning on a railing by the sea" />
        <span className="hero-tag">100% Organic Cotton</span>
        <div className="hero-copy">
          <span className="eyebrow">Hand block-print motifs · Coconut shell buttons</span>
          <h1>Prints with a <em>past</em>,<br />cotton that <em>breathes</em>.</h1>
          <p>Every Algodon shirt starts as a motif drawn by hand — jali lattices, lotus blooms, paisley swirls — then set onto organic cotton, cut small-batch and finished with coconut shell buttons.</p>
          <div className="hero-actions">
            <a href="#shirts" className="btn btn-solid">Shop the Shirts</a>
            <a href="#prints" className="btn btn-ghost">Explore Motifs</a>
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
    </>
  );
}

export function Story({s}) {
  return (
    <>
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
    </>
  );
}

export function Footer({s}) {
  return (
    <>
      <footer>
        <div className="footer-grid">
          <div>
            <a href="#" className="wordmark" onClick={event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              ALGODON<span className="sub">ORGANIC</span>
            </a>
            <p className="blurb">Small-batch organic cotton shirts in hand block-print motifs, cut and finished in India.</p>
          </div>
          <div>
            <h4>Shop</h4>
            <ul>
              <li><a href="#shirts">All Shirts</a></li>
              <li><a href="#prints">New Prints</a></li>
              <li><a href="#shirts">Sale</a></li>
            </ul>
          </div>
          <div>
            <h4>Help & Policies</h4>
            <ul>
              <li><a href="#" onClick={event => { event.preventDefault(); s.open("size"); }}>Size Guide</a></li>
              <li><a href="#" onClick={event => { event.preventDefault(); s.openHelp("shipping"); }}>Shipping & Delivery</a></li>
              <li><a href="#" onClick={event => { event.preventDefault(); s.openHelp("refund"); }}>7-Day Refund Policy</a></li>
              <li><a href="#" onClick={event => { event.preventDefault(); s.openHelp("terms"); }}>Terms of Service</a></li>
              <li><a href="#" onClick={event => { event.preventDefault(); s.openHelp("privacy"); }}>Privacy Policy</a></li>
              <li><a href="#" onClick={event => { event.preventDefault(); s.openHelp("contact"); }}>Contact Concierge</a></li>
            </ul>
          </div>
          <div>
            <h4>Brand</h4>
            <ul>
              <li><a href="#story">Our Story</a></li>
              <li><a href="#prints">Artisan Motifs</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© Algodon Organic · 100% GOTS Certified Cotton</span>
          <span>Free Pan-India Delivery · Hand block-printed in Rajasthan</span>
        </div>
      </footer>
    </>
  );
}
