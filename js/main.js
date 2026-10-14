import { animate, inView, spring, stagger } from 'motion';

(function() {
  "use strict";

  /* ---------- Supabase (email accounts and store data) ---------- */
  // Loaded from config.js
  var sb = (window.supabase && window.supabase.createClient && window.APP_CONFIG &&
    window.APP_CONFIG.SUPABASE_URL && window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY)
    ? window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY)
    : null;

  /* ---------- Firebase (Google accounts and customer profiles) ---------- */
  var firebaseContext = null;
  var firebaseAuth = null;
  var firebaseUser = null;
  var firebaseSdkPromise = import("../src/lib/auth-context.js").then(function (context) {
    firebaseContext = context;
    firebaseAuth = context.auth;
    return context;
  });
  function loadFirebaseAuth() { return firebaseSdkPromise; }

  var header = document.getElementById("siteHeader");
  window.addEventListener("scroll", function () {
    header.classList.toggle("scrolled", window.scrollY > 12);
  }, { passive: true });

  /* ---------- mobile nav ---------- */
  var navToggle = document.getElementById("navToggle");
  var primaryNav = document.getElementById("primaryNav");
  var scrim = document.getElementById("scrim");

  function openNav() {
    primaryNav.classList.add("open");
    navToggle.setAttribute("aria-expanded", "true");
    scrim.hidden = false;
  }
  function closeNav() {
    primaryNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    if (searchOverlay.hidden && cartDrawer.className.indexOf("open") === -1) scrim.hidden = true;
  }
  navToggle.addEventListener("click", function () {
    primaryNav.classList.contains("open") ? closeNav() : openNav();
  });
  document.querySelectorAll("[data-nav-link]").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  /* ---------- search overlay ---------- */
  var searchToggle = document.getElementById("searchToggle");
  var searchOverlay = document.getElementById("searchOverlay");
  var searchClose = document.getElementById("searchClose");
  var searchInput = document.getElementById("searchInput");
  var searchResults = document.getElementById("searchResults");
  var cards = Array.prototype.slice.call(document.querySelectorAll("#productGrid .card"));

  function renderSearch(query) {
    var q = query.trim().toLowerCase();
    searchResults.innerHTML = "";
    var matches = cards.filter(function (c) {
      return !q || c.dataset.name.toLowerCase().indexOf(q) !== -1;
    });
    if (!matches.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No prints match “" + query + "”.";
      searchResults.appendChild(empty);
      return;
    }
    matches.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      var img = document.createElement("img");
      img.src = c.dataset.img;
      img.alt = "";
      var span = document.createElement("span");
      span.textContent = c.dataset.name + " — Rs. " + Number(c.dataset.price).toLocaleString("en-IN");
      btn.appendChild(img);
      btn.appendChild(span);
      btn.addEventListener("click", function () {
        closeSearch();
        c.scrollIntoView({ behavior: "smooth", block: "center" });
        c.style.transition = "box-shadow 0.3s ease";
        c.style.boxShadow = "0 0 0 3px var(--accent)";
        setTimeout(function () { c.style.boxShadow = ""; }, 1400);
      });
      searchResults.appendChild(btn);
    });
  }

  function openSearch() {
    searchOverlay.hidden = false;
    scrim.hidden = true;
    renderSearch("");
    searchInput.value = "";
    searchInput.focus();
  }
  function closeSearch() { searchOverlay.hidden = true; }

  searchToggle.addEventListener("click", openSearch);
  searchClose.addEventListener("click", closeSearch);
  searchInput.addEventListener("input", function () { renderSearch(searchInput.value); });

  /* ---------- size guide modal ---------- */
  var sizeGuideLink = document.getElementById("sizeGuideLink");
  var sizeGuideModal = document.getElementById("sizeGuideModal");
  var sizeGuideClose = document.getElementById("sizeGuideClose");
  function openSizeGuide() {
    if (!sizeGuideModal) return;
    sizeGuideModal.hidden = false;
    animate(sizeGuideModal.querySelector(".modal"), { opacity: [0, 1], scale: [0.95, 1] }, { duration: 0.4, easing: spring() });
    animate(sizeGuideModal, { backgroundColor: ["rgba(0,0,0,0)", "rgba(33,28,22,0.95)"] }, { duration: 0.4 });
  }
  function closeSizeGuide() {
    if (!sizeGuideModal || sizeGuideModal.hidden) return;
    animate(sizeGuideModal.querySelector(".modal"), { opacity: 0, scale: 0.95 }, { duration: 0.2 }).finished.then(function() {
      sizeGuideModal.hidden = true;
    });
    animate(sizeGuideModal, { backgroundColor: "rgba(0,0,0,0)" }, { duration: 0.2 });
  }
  if (sizeGuideLink) {
    sizeGuideLink.addEventListener("click", function (e) {
      e.preventDefault();
      openSizeGuide();
    });
  }
  if (sizeGuideClose) sizeGuideClose.addEventListener("click", closeSizeGuide);
  if (sizeGuideModal) {
    sizeGuideModal.addEventListener("click", function (e) {
      if (e.target === sizeGuideModal) closeSizeGuide();
    });
  }


  /* ---------- cart ---------- */
  var CART_KEY = "algodon_demo_cart";
  var COUPON_KEY = "algodon_demo_coupon";
  var activeCoupon = null;
  try { activeCoupon = JSON.parse(localStorage.getItem(COUPON_KEY) || 'null'); } catch (e) { activeCoupon = null; }
  var cartToggle = document.getElementById("cartToggle");
  var cartDrawer = document.getElementById("cartDrawer");
  var cartClose = document.getElementById("cartClose");
  var cartItemsEl = document.getElementById("cartItems");
  var cartSubtotalEl = document.getElementById("cartSubtotal");
  var cartCountEl = document.getElementById("cartCount");
  var checkoutBtn = document.getElementById("checkoutBtn");
  var cartNote = document.getElementById("cartNote");
  var downloadInvoiceBtn = document.getElementById("downloadInvoiceBtn");
  var emailInvoiceBtn = document.getElementById("emailInvoiceBtn");
  var couponCodeInput = document.getElementById("couponCode");
  var applyCouponBtn = document.getElementById("applyCouponBtn");
  var couponMessage = document.getElementById("couponMessage");
  var cartDiscountRow = document.getElementById("cartDiscountRow");
  var cartDiscount = document.getElementById("cartDiscount");

  /* ---------- shared database (order intents + newsletter signups) ---------- */
  
  
  var lastInvoice = null;

  function buildInvoicePdf(invoiceNo, dateStr, items, subtotal, customer, discount) {
    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) return null;
    var doc = new jsPDFCtor({ unit: "pt", format: "a4" });
    var left = 48, y = 64, lineH = 18;
    doc.setFont("times", "italic");
    doc.setFontSize(22);
    doc.text("Algodon Organic", left, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 108, 92);
    y += 16;
    doc.text("Hand block-print organic cotton shirts — India", left, y);
    y += 34;
    doc.setDrawColor(220, 208, 184);
    doc.line(left, y, 547, y);
    y += 24;
    doc.setTextColor(40, 34, 28);
    doc.setFontSize(14);
    doc.text("Invoice (concept preview)", left, y);
    y += 20;
    doc.setFontSize(10);
    doc.setTextColor(90, 80, 68);
    doc.text("Invoice No: " + invoiceNo, left, y);
    doc.text("Date: " + dateStr, 350, y);
    y += 26;

    if (customer) {
      doc.setFontSize(9);
      doc.setTextColor(140, 128, 110);
      doc.text("BILL TO / SHIP TO", left, y);
      y += 14;
      doc.setFontSize(10);
      doc.setTextColor(40, 34, 28);
      doc.text(customer.name, left, y);
      y += 14;
      doc.setTextColor(90, 80, 68);
      doc.text(customer.address1 + (customer.address2 ? ", " + customer.address2 : ""), left, y, { maxWidth: 280 });
      y += 14;
      doc.text(customer.city + ", " + customer.state + " " + customer.pin, left, y);
      y += 14;
      doc.text(customer.phone + "  ·  " + customer.email, left, y);
      y += 20;
    }

    doc.setFontSize(9);
    doc.setTextColor(140, 128, 110);
    doc.text("ITEM", left, y);
    doc.text("SIZE", 300, y);
    doc.text("QTY", 360, y);
    doc.text("PRICE", 420, y);
    doc.text("TOTAL", 490, y);
    y += 8;
    doc.setDrawColor(220, 208, 184);
    doc.line(left, y, 547, y);
    y += 18;

    doc.setTextColor(40, 34, 28);
    doc.setFontSize(10);
    items.forEach(function (item) {
      doc.text(item.name, left, y);
      doc.text(item.size, 300, y);
      doc.text(String(item.qty), 360, y);
      doc.text("Rs. " + item.price.toLocaleString("en-IN"), 420, y);
      doc.text("Rs. " + (item.qty * item.price).toLocaleString("en-IN"), 490, y);
      y += lineH;
    });

    y += 10;
    doc.setDrawColor(220, 208, 184);
    doc.line(350, y, 547, y);
    y += 20;
    doc.setFontSize(12);
    doc.text("Subtotal", 350, y);
    doc.text("Rs. " + subtotal.toLocaleString("en-IN"), 490, y);
    y += 18;
    if (discount > 0) {
      doc.setTextColor(82, 118, 91);
      doc.text("Discount", 350, y);
      doc.text("− Rs. " + discount.toLocaleString("en-IN"), 490, y);
      y += 18;
      doc.setTextColor(40, 34, 28);
    }
    doc.setFontSize(9);
    doc.setTextColor(140, 128, 110);
    doc.text("Shipping", 350, y);
    doc.text("Free", 490, y);
    y += 24;
    doc.setDrawColor(40, 34, 28);
    doc.line(350, y, 547, y);
    y += 20;
    doc.setFontSize(13);
    doc.setTextColor(40, 34, 28);
    doc.text("Total", 350, y);
    doc.text("Rs. " + Math.max(0, subtotal - (discount || 0)).toLocaleString("en-IN"), 490, y);

    y += 50;
    doc.setFontSize(8);
    doc.setTextColor(150, 138, 120);
    doc.text("This is a concept invoice generated for design review — not a tax-valid receipt and no payment was taken.", left, y, { maxWidth: 500 });

    return doc;
  }

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) { return []; }
  }
  function saveCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
    if (firebaseUser && firebaseContext) {
      firebaseContext.syncCartToCloud(firebaseUser, cart).catch(function (error) {
        console.error("Could not sync the cart to Firebase:", error);
      });
    }
  }
  function formatRs(n) { return "Rs. " + n.toLocaleString("en-IN"); }

  function renderCart() {
    var cart = loadCart();
    cartItemsEl.innerHTML = "";
    var count = 0, subtotal = 0;
    if (!cart.length) {
      var empty = document.createElement("p");
      empty.className = "cart-empty";
      empty.textContent = "Your cart is empty — the print edit is right there.";
      cartItemsEl.appendChild(empty);
    }
    cart.forEach(function (item, idx) {
      count += item.qty;
      subtotal += item.qty * item.price;
      var row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML =
        '<img src="' + item.img + '" alt="" />' +
        '<div class="meta">' +
          '<span class="name">' + item.name + "</span>" +
          '<span class="size">Size ' + item.size + "</span>" +
          '<div class="qty-row">' +
            '<button type="button" data-action="dec" aria-label="Decrease quantity">−</button>' +
            '<span>' + item.qty + "</span>" +
            '<button type="button" data-action="inc" aria-label="Increase quantity">+</button>' +
          "</div>" +
          '<button type="button" class="remove-link" data-action="remove">Remove</button>' +
        "</div>" +
        '<div class="price">' + formatRs(item.qty * item.price) + "</div>";
      row.querySelector('[data-action="inc"]').addEventListener("click", function () {
        cart[idx].qty += 1; saveCart(cart); renderCart();
      });
      row.querySelector('[data-action="dec"]').addEventListener("click", function () {
        cart[idx].qty -= 1;
        if (cart[idx].qty <= 0) cart.splice(idx, 1);
        saveCart(cart); renderCart();
      });
      row.querySelector('[data-action="remove"]').addEventListener("click", function () {
        cart.splice(idx, 1); saveCart(cart); renderCart();
      });
      cartItemsEl.appendChild(row);
    });
    cartCountEl.textContent = String(count);
    try { animate(cartCountEl, { scale: [1, 1.35, 1] }, { duration: 0.28 }); } catch (e) {}

    var discountAmount = 0;
    if (activeCoupon) {
      if (activeCoupon.type === 'percentage') {
        discountAmount = Math.round(subtotal * 0.1);
        activeCoupon.discount = discountAmount;
      } else if (activeCoupon.type === 'flat') {
        discountAmount = Math.min(subtotal, Number(activeCoupon.discount || 200));
        activeCoupon.discount = discountAmount;
      } else if (activeCoupon.type === 'free_shipping') {
        discountAmount = 0;
      } else {
        discountAmount = Number(activeCoupon.discount || 0);
      }
    }
    var finalTotal = Math.max(0, subtotal - discountAmount);
    cartSubtotalEl.textContent = formatRs(finalTotal);
    cartDiscountRow.hidden = !activeCoupon;
    cartDiscount.textContent = activeCoupon ? "− " + formatRs(discountAmount) : "− Rs. 0";
    if (activeCoupon && couponCodeInput) couponCodeInput.value = activeCoupon.code;
  }

  applyCouponBtn.addEventListener("click", async function () {
    var cart = loadCart();
    couponMessage.hidden = false;
    couponMessage.textContent = "";
    var code = (couponCodeInput.value || "").trim().toUpperCase();
    if (!code) {
      couponMessage.textContent = "Enter a coupon code (e.g. ALGODON10 or WELCOME200).";
      return;
    }
    if (!cart.length) {
      couponMessage.textContent = "Add an item to your cart before applying a coupon.";
      return;
    }
    var emailInput = document.getElementById("shipEmail");
    var email = (emailInput && emailInput.value.trim()) || "guest@algodon.store";
    applyCouponBtn.disabled = true;
    try {
      var response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          email: email,
          items: cart.map(function(i){ return { id: i.id, qty: i.qty }; })
        })
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Coupon could not be applied.');
      activeCoupon = result;
      localStorage.setItem(COUPON_KEY, JSON.stringify(result));
      couponMessage.textContent = result.type === 'free_shipping' ? 'Free shipping coupon applied.' : 'Coupon applied — ' + formatRs(result.discount) + ' off.';
      renderCart();
    } catch (error) {
      var subtotal = cart.reduce(function (s, it) { return s + (it.qty * it.price); }, 0);
      if (code === 'ALGODON10') {
        activeCoupon = { valid: true, code: 'ALGODON10', type: 'percentage', discount: Math.round(subtotal * 0.1), freeShipping: false };
        localStorage.setItem(COUPON_KEY, JSON.stringify(activeCoupon));
        couponMessage.textContent = 'Coupon applied — ' + formatRs(activeCoupon.discount) + ' off.';
        renderCart();
      } else if (code === 'WELCOME200') {
        activeCoupon = { valid: true, code: 'WELCOME200', type: 'flat', discount: 200, freeShipping: false };
        localStorage.setItem(COUPON_KEY, JSON.stringify(activeCoupon));
        couponMessage.textContent = 'Coupon applied — Rs. 200 off.';
        renderCart();
      } else if (code === 'FREESHIP') {
        activeCoupon = { valid: true, code: 'FREESHIP', type: 'free_shipping', discount: 0, freeShipping: true };
        localStorage.setItem(COUPON_KEY, JSON.stringify(activeCoupon));
        couponMessage.textContent = 'Free shipping coupon applied.';
        renderCart();
      } else {
        activeCoupon = null;
        localStorage.removeItem(COUPON_KEY);
        couponMessage.textContent = error.message || 'Invalid coupon code. Try ALGODON10 or WELCOME200.';
        renderCart();
      }
    } finally {
      applyCouponBtn.disabled = false;
    }
  });

  function openCart() { closeAccount(); cartDrawer.classList.add("open"); scrim.hidden = false; }
  function closeCart() { cartDrawer.classList.remove("open"); scrim.hidden = true; }
  cartToggle.addEventListener("click", openCart);
  cartClose.addEventListener("click", closeCart);
  /* ---------- shipping address ---------- */
  var ADDRESS_KEY = "algodon_demo_address";
  var checkoutForm = document.getElementById("checkoutForm");
  var shipError = document.getElementById("shipError");
  var shipFields = ["shipName", "shipEmail", "shipPhone", "shipAddress1", "shipAddress2", "shipCity", "shipState", "shipPin"];

  (function prefillAddress() {
    try {
      var saved = JSON.parse(localStorage.getItem(ADDRESS_KEY));
      if (!saved) return;
      shipFields.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && saved[id]) el.value = saved[id];
      });
      if (saved.shipAddress && !document.getElementById("shipAddress1")?.value) {
        var addr1 = document.getElementById("shipAddress1");
        if (addr1) addr1.value = saved.shipAddress;
      }
    } catch (e) {}
  })();

  function readCustomer() {
    var addr1 = (document.getElementById("shipAddress1") || document.getElementById("shipAddress"))?.value || "";
    var addr2 = document.getElementById("shipAddress2")?.value || "";
    return {
      name: (document.getElementById("shipName")?.value || "").trim(),
      email: (document.getElementById("shipEmail")?.value || "").trim(),
      phone: (document.getElementById("shipPhone")?.value || "").trim(),
      address1: addr1.trim(),
      address2: addr2.trim(),
      city: (document.getElementById("shipCity")?.value || "").trim(),
      state: (document.getElementById("shipState")?.value || "").trim(),
      pin: (document.getElementById("shipPin")?.value || "").trim()
    };
  }

  checkoutBtn.addEventListener("click", function () {
    var cart = loadCart();
    if (!cart.length) {
      checkoutBtn.textContent = "Your cart is empty";
      setTimeout(function () { checkoutBtn.textContent = "Checkout"; }, 1800);
      return;
    }
    var customer = readCustomer();
    if (!customer.name || !customer.email || !customer.phone || !customer.address1 || !customer.city || !customer.state || !customer.pin) {
      cartNote.style.color = "var(--accent)";
      cartNote.textContent = "Please fill your shipping details to complete checkout.";
      setTimeout(function() { cartNote.style.color = ""; }, 3000);
      showGuestShipping();
      return;
    }
    document.getElementById("shipError").textContent = "";
    try {
      var toSave = {};
      shipFields.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) toSave[id] = el.value;
      });
      localStorage.setItem(ADDRESS_KEY, JSON.stringify(toSave));
    } catch (e) {}

    var subtotal = cart.reduce(function (sum, i) { return sum + i.qty * i.price; }, 0);
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Saving order…";
    
    var useManagedCheckout = cart.every(function (item) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id); });
    if (activeCoupon && !useManagedCheckout && !sb) {
      // In demo mode without catalog, calculate coupon discount locally if available
    }
    var orderPromise;
    if (useManagedCheckout) {
      orderPromise = fetch('/api/checkout/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart.map(function(i){return {id:i.id,size:i.size,qty:i.qty};}), customer: customer, coupon_code: activeCoupon && activeCoupon.code || '' }) }).then(async function(response) { var result=await response.json(); if(!response.ok) throw new Error(result.error || 'Could not place order.'); return { data: result.data }; });
    } else if (sb) {
      orderPromise = sb.from("order_intents").insert([{
        items: cart.map(function (i) { return { name: i.name, size: i.size, qty: i.qty, price: i.price }; }),
        subtotal: subtotal,
        customer: customer,
        created_at: new Date().toISOString()
      }]);
    } else {
      // Concept preview fallback when Supabase is not connected
      var demoOrders = [];
      try { demoOrders = JSON.parse(localStorage.getItem("algodon_demo_orders") || "[]"); } catch (e) {}
      var invoiceId = "ALG-" + Date.now().toString(36).toUpperCase();
      var demoOrder = {
        id: invoiceId,
        items: cart,
        subtotal: subtotal,
        discount: activeCoupon ? activeCoupon.discount : 0,
        customer: customer,
        created_at: new Date().toISOString()
      };
      demoOrders.push(demoOrder);
      try { localStorage.setItem("algodon_demo_orders", JSON.stringify(demoOrders)); } catch (e) {}
      orderPromise = Promise.resolve({ data: demoOrder });
    }
    orderPromise.then(async function(res) {
        if (res.error) throw res.error;
      if (res.data) {
        subtotal = Number(res.data.subtotal || subtotal);
        activeCoupon = res.data.coupon_code ? { code: res.data.coupon_code, discount: Number(res.data.discount || 0) } : null;
        var existingOrders = [];
        try { existingOrders = JSON.parse(localStorage.getItem("algodon_demo_orders") || "[]"); } catch (e) {}
        var orderId = res.data.id || ("ALG-" + Date.now().toString(36).toUpperCase());
        if (!existingOrders.some(function(o){ return o.id === orderId; })) {
          existingOrders.push({
            id: orderId,
            items: cart,
            subtotal: subtotal,
            discount: activeCoupon ? activeCoupon.discount : 0,
            customer: customer,
            status: 'confirmed',
            created_at: res.data.created_at || new Date().toISOString()
          });
          try { localStorage.setItem("algodon_demo_orders", JSON.stringify(existingOrders)); } catch (e) {}
        }
        if (firebaseUser && firebaseContext) {
          try { await firebaseContext.saveOrderReference(firebaseUser, res.data); }
          catch (error) { console.error("Order saved, but its account reference could not be synced:", error); }
        }
      }
      cartNote.textContent = "Order saved (" + cart.length + " item" + (cart.length > 1 ? "s" : "") + ", Rs. " + subtotal.toLocaleString("en-IN") + ").";
      checkoutBtn.textContent = "Saved ✓";

      var invoiceNo = (res.data && res.data.id) ? (typeof res.data.id === 'string' && res.data.id.startsWith('ALG-') ? res.data.id : "ALG-" + String(res.data.id).slice(0, 8).toUpperCase()) : ("ALG-" + Date.now().toString(36).toUpperCase());
      var dateStr = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
      var pdfDoc = buildInvoicePdf(invoiceNo, dateStr, cart, subtotal, customer, activeCoupon ? Number(activeCoupon.discount || 0) : 0);
      if (pdfDoc) {
        lastInvoice = { 
          doc: pdfDoc, 
          filename: "algodon-invoice-" + invoiceNo + ".pdf",
          invoiceNo: invoiceNo,
          dateStr: dateStr,
          cart: cart,
          subtotal: subtotal,
          discount: activeCoupon ? activeCoupon.discount : 0,
          customer: customer
        };
        downloadInvoiceBtn.hidden = false;
        emailInvoiceBtn.hidden = false;
        var blobUrl = URL.createObjectURL(pdfDoc.output("blob"));
        downloadInvoiceBtn.dataset.url = blobUrl;
        downloadInvoiceBtn.dataset.filename = lastInvoice.filename;
      }

      saveCart([]);
      activeCoupon = null;
      try { localStorage.removeItem(COUPON_KEY); } catch (e) {}
      renderCart();
    }).catch(function (error) {
      cartNote.textContent = error.message || "Concept preview — no real payment, and the database isn’t reachable right now.";
      checkoutBtn.textContent = "Checkout";
    }).finally(function () {
      checkoutBtn.disabled = false;
      setTimeout(function () { checkoutBtn.textContent = "Checkout"; }, 2200);
    });
  });

  downloadInvoiceBtn.addEventListener("click", function () {
    if (!lastInvoice) return;
    var url = downloadInvoiceBtn.dataset.url || URL.createObjectURL(lastInvoice.doc.output("blob"));
    var a = document.createElement("a");
    a.href = url;
    a.download = downloadInvoiceBtn.dataset.filename || "invoice.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  emailInvoiceBtn.addEventListener("click", function () {
    if (!lastInvoice) return;
    emailInvoiceBtn.textContent = "Sending email...";
    emailInvoiceBtn.disabled = true;

    fetch('/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: lastInvoice.customer.email,
        name: lastInvoice.customer.name,
        invoiceNo: lastInvoice.invoiceNo,
        subtotal: lastInvoice.subtotal,
        cart: lastInvoice.cart
      })
    })
    .then(async function(res) {
      var data = await res.json().catch(function() { return {}; });
      if (!res.ok) throw new Error(data.error || 'Invoice email service not available');
      if (data.previewUrl) {
        window.open(data.previewUrl, '_blank');
      }
      emailInvoiceBtn.textContent = "Email Sent ✓";
    })
    .catch(function(err) {
      console.error(err);
      emailInvoiceBtn.textContent = err.message.length > 25 ? "Email not configured" : err.message;
    })
    .finally(function() {
      setTimeout(function() {
        emailInvoiceBtn.textContent = "Email Invoice Details";
        emailInvoiceBtn.disabled = false;
      }, 3000);
    });
  });

  /* ---------- account panel ---------- */
  var accountToggle = document.getElementById("accountToggle");
  var accountDrawer = document.getElementById("accountDrawer");
  var accountClose = document.getElementById("accountClose");
  var accountSignedOut = document.getElementById("accountSignedOut");
  var accountSignedIn = document.getElementById("accountSignedIn");
  var accountEmail = document.getElementById("accountEmail");
  var accountAvatar = document.getElementById("accountAvatar");
  var accountNavLabel = document.getElementById("accountNavLabel");
  var accountMenu = document.getElementById("accountMenu");
  var navLogoutBtn = document.getElementById("navLogoutBtn");
  var accountOrders = document.getElementById("accountOrders");
  var accountRouteTitle = document.getElementById("accountRouteTitle");
  var accountRouteContent = document.getElementById("accountRouteContent");
  var authToast = document.getElementById("authToast");
  var toastTimer = null;
  var authToggleBtn = document.getElementById("authToggleBtn");
  var authTitle = document.getElementById("authTitle");
  var signInForm = document.getElementById("signInForm");
  var signUpForm = document.getElementById("signUpForm");
  var signInError = document.getElementById("signInError");
  var signUpError = document.getElementById("signUpError");
  var signOutBtn = document.getElementById("signOutBtn");
  var googleSignInBtn = document.getElementById("googleSignInBtn");
  
  var isSignIn = true;
  var supabaseUser = null;
  var supabaseReady = !sb;
  var firebaseReady = false;

  function showAuthToast(message) {
    authToast.textContent = message;
    authToast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { authToast.hidden = true; }, 5200);
  }
  window.addEventListener("firebase-auth-message", function (event) {
    if (event.detail) showAuthToast(event.detail);
  });

  function openAccount() { closeCart(); accountDrawer.hidden = false; }
  function closeAccount() { accountDrawer.hidden = true; }
  accountToggle.addEventListener("click", function () {
    if (firebaseUser || supabaseUser) {
      accountMenu.hidden = !accountMenu.hidden;
      accountToggle.setAttribute("aria-expanded", String(!accountMenu.hidden));
    } else openAccount();
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".account-nav")) accountMenu.hidden = true;
  });
  accountClose.addEventListener("click", closeAccount);
  accountDrawer.addEventListener("click", function (e) {
    if (e.target === accountDrawer) closeAccount();
  });

  authToggleBtn.addEventListener("click", function () {
    isSignIn = !isSignIn;
    if (isSignIn) {
      authTitle.innerText = "Sign In";
      signInForm.hidden = false;
      signUpForm.hidden = true;
      authToggleBtn.innerText = "Create an account";
    } else {
      authTitle.innerText = "Create Account";
      signUpForm.hidden = false;
      signInForm.hidden = true;
      authToggleBtn.innerText = "Already have an account? Sign in";
    }
  });

  googleSignInBtn.addEventListener("click", async function () {
    signInError.textContent = "";
    googleSignInBtn.disabled = true;
    try {
      var firebase = await loadFirebaseAuth();
      await firebase.signInWithGoogle();
      firebaseUser = firebase.AuthContext.user;
      if (sb) await sb.auth.signOut();
      signInForm.reset();
      closeAccount();
    } catch (error) {
      console.error("Firebase Google Sign-In Error:", error);
      var authMessages = {
        "auth/popup-closed-by-user": "Google sign-in was cancelled.",
        "auth/popup-blocked": "Your browser blocked the sign-in window. Redirecting to Google…",
        "auth/network-request-failed": "Check your internet connection and try again.",
        "auth/account-exists-with-different-credential": "An account already uses this email. Sign in with its original method, then link Google in account settings.",
        "auth/unauthorized-domain": "Add this site to Firebase Authentication’s authorized domains."
      };
      signInError.textContent = authMessages[error.code] || error.message || "Google Sign-In failed. Check Firebase setup and try again.";
      showAuthToast(signInError.textContent);
    } finally {
      googleSignInBtn.disabled = false;
    }
  });

  function showSignedIn(user, fullName) {
    accountSignedOut.hidden = true;
    accountSignedIn.hidden = false;
    var signedInHeader = document.getElementById("signedInHeader");
    var guestModeHeader = document.getElementById("guestModeHeader");
    if (signedInHeader) signedInHeader.hidden = false;
    if (guestModeHeader) guestModeHeader.hidden = true;
    if (signOutBtn) signOutBtn.hidden = false;
    accountEmail.textContent = user.email || "";
    var displayName = fullName || user.user_metadata && user.user_metadata.full_name || (user.email || "Account").split("@")[0];
    accountNavLabel.textContent = displayName;
    accountAvatar.hidden = !user.photoURL;
    if (user.photoURL) accountAvatar.src = user.photoURL;
    accountToggle.setAttribute("aria-label", "Account: " + displayName);
    var emailField = document.getElementById("shipEmail");
    if (emailField && !emailField.value) emailField.value = user.email || "";
    var nameField = document.getElementById("shipName");
    if (nameField && !nameField.value && fullName) nameField.value = fullName;
  }
  function showSignedOut() {
    accountSignedOut.hidden = false;
    accountSignedIn.hidden = true;
    var signedInHeader = document.getElementById("signedInHeader");
    var guestModeHeader = document.getElementById("guestModeHeader");
    if (signedInHeader) signedInHeader.hidden = true;
    if (guestModeHeader) guestModeHeader.hidden = true;
    accountNavLabel.textContent = "Account";
    accountAvatar.hidden = true;
    accountAvatar.removeAttribute("src");
    accountToggle.setAttribute("aria-label", "Account");
    accountMenu.hidden = true;
  }
  function showGuestShipping() {
    accountSignedOut.hidden = true;
    accountSignedIn.hidden = false;
    var signedInHeader = document.getElementById("signedInHeader");
    var guestModeHeader = document.getElementById("guestModeHeader");
    if (signedInHeader) signedInHeader.hidden = true;
    if (guestModeHeader) guestModeHeader.hidden = false;
    var accountOrders = document.getElementById("accountOrders");
    if (accountOrders) accountOrders.hidden = true;
    var checkoutForm = document.getElementById("checkoutForm");
    if (checkoutForm) checkoutForm.hidden = false;
    if (signOutBtn) signOutBtn.hidden = true;
    openAccount();
  }
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var guestShippingBtn = document.getElementById("guestShippingBtn");
  if (guestShippingBtn) guestShippingBtn.addEventListener("click", showGuestShipping);
  var backToSignInBtn = document.getElementById("backToSignInBtn");
  if (backToSignInBtn) backToSignInBtn.addEventListener("click", showSignedOut);
  var guestOrdersBtn = document.getElementById("guestOrdersBtn");
  if (guestOrdersBtn) {
    guestOrdersBtn.addEventListener("click", function () {
      accountSignedOut.hidden = true;
      accountSignedIn.hidden = false;
      var signedInHeader = document.getElementById("signedInHeader");
      var guestModeHeader = document.getElementById("guestModeHeader");
      if (signedInHeader) signedInHeader.hidden = true;
      if (guestModeHeader) guestModeHeader.hidden = true;
      renderAccountRoute("/orders");
    });
  }
  var backFromOrdersBtn = document.getElementById("backFromOrdersBtn");
  if (backFromOrdersBtn) {
    backFromOrdersBtn.addEventListener("click", function () {
      accountOrders.hidden = true;
      if (firebaseUser || supabaseUser) {
        var signedInHeader = document.getElementById("signedInHeader");
        if (signedInHeader) signedInHeader.hidden = false;
        checkoutForm.hidden = false;
      } else {
        accountSignedIn.hidden = true;
        accountSignedOut.hidden = false;
      }
    });
  }

  var saveAddressBtn = document.getElementById("saveAddressBtn");
  if (saveAddressBtn) {
    saveAddressBtn.addEventListener("click", function () {
      var customer = readCustomer();
      if (!customer.name || !customer.email || !customer.phone || !customer.address1 || !customer.city || !customer.state || !customer.pin) {
        document.getElementById("shipError").textContent = "Please fill in all required shipping fields.";
        return;
      }
      document.getElementById("shipError").textContent = "";
      try {
        var toSave = {};
        shipFields.forEach(function (id) {
          var el = document.getElementById(id);
          if (el) toSave[id] = el.value;
        });
        localStorage.setItem(ADDRESS_KEY, JSON.stringify(toSave));
      } catch (e) {}
      closeAccount();
      openCart();
      cartNote.textContent = "Shipping details saved. You can now checkout.";
    });
  }
  function renderAccountUser() {
    if (!firebaseReady || !supabaseReady) {
      accountSignedOut.hidden = true;
      accountSignedIn.hidden = true;
      return;
    }
    if (firebaseUser) {
      showSignedIn(firebaseUser, firebaseUser.displayName);
    } else if (supabaseUser) {
      showSignedIn(supabaseUser, supabaseUser.user_metadata && supabaseUser.user_metadata.full_name);
    } else {
      showSignedOut();
    }
    handleAccountRoute();
  }

  async function renderAccountRoute(route) {
    accountOrders.hidden = false;
    accountRouteTitle.textContent = route === "/wishlist" ? "Your wishlist" : "Your orders";
    checkoutForm.hidden = true;

    if (route === "/wishlist") {
      if (!firebaseUser || !firebaseContext) {
        accountRouteContent.innerHTML = '<p class="cart-empty">Sign in to save shirts to your wishlist.</p>';
        return;
      }
      accountRouteContent.textContent = "Loading wishlist…";
      try {
        var collection = firebaseContext.sdk.firestoreSdk.collection;
        var getDocs = firebaseContext.sdk.firestoreSdk.getDocs;
        var rows = await getDocs(collection(firebaseContext.db, "users", firebaseUser.uid, "wishlist"));
        accountRouteContent.replaceChildren();
        if (rows.empty) {
          var empty = document.createElement("p");
          empty.className = "cart-empty";
          empty.textContent = "Your wishlist is empty.";
          accountRouteContent.appendChild(empty);
          return;
        }
        rows.forEach(function (entry) {
          var item = entry.data();
          var row = document.createElement("p");
          row.textContent = item.name || item.title || entry.id;
          accountRouteContent.appendChild(row);
        });
      } catch (e) {
        accountRouteContent.textContent = "Could not load wishlist.";
      }
      return;
    }

    // Orders route: load locally persisted orders + Firestore orders
    var localOrders = [];
    try { localOrders = JSON.parse(localStorage.getItem("algodon_demo_orders") || "[]"); } catch (e) { localOrders = []; }

    accountRouteContent.innerHTML = "";

    if (firebaseUser && firebaseContext) {
      try {
        var collection = firebaseContext.sdk.firestoreSdk.collection;
        var getDocs = firebaseContext.sdk.firestoreSdk.getDocs;
        var rows = await getDocs(collection(firebaseContext.db, "users", firebaseUser.uid, "orders"));
        if (!rows.empty) {
          rows.forEach(function (entry) {
            var fbOrder = entry.data();
            var exists = localOrders.some(function (lo) { return lo.id === (fbOrder.orderId || entry.id); });
            if (!exists) {
              localOrders.unshift({
                id: fbOrder.orderId || entry.id,
                status: fbOrder.status || "confirmed",
                subtotal: Number(fbOrder.total || 0),
                discount: Number(fbOrder.discount || 0),
                created_at: fbOrder.createdAt || new Date().toISOString(),
                items: fbOrder.items || [],
                customer: fbOrder.customer || null
              });
            }
          });
        }
      } catch (error) {
        console.warn("Firestore orders fetch warning:", error);
      }
    }

    if (!localOrders.length) {
      accountRouteContent.innerHTML = '<div style="text-align:center; padding:28px 8px;"><p style="font-weight:700; margin-bottom:6px; font-family:\'Fraunces\',serif; font-size:1.15rem;">No orders placed yet</p><p style="color:var(--ink-soft); font-size:0.82rem; margin:0;">Add shirts to your cart and checkout to track your orders in real time.</p></div>';
      return;
    }

    localOrders.slice().reverse().forEach(function (order) {
      var card = document.createElement("div");
      card.className = "order-card";
      var orderId = order.id || "ALG-ORD";
      var dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recently";
      var status = (order.status || "confirmed").toLowerCase();
      var badgeText = status === "delivered" ? "Delivered" : (status === "shipped" ? "Shipped" : (status === "packed" ? "Tailoring / Packed" : "Confirmed"));

      var isConfirmed = true;
      var isPacked = ["packed", "shipped", "delivered"].includes(status);
      var isShipped = ["shipped", "delivered"].includes(status);
      var isDelivered = status === "delivered";

      var itemsHtml = (order.items || []).map(function (it) {
        var name = it.name || "Organic Cotton Shirt";
        var size = it.size || "M";
        var qty = it.qty || 1;
        var price = it.price ? formatRs(it.price * qty) : "";
        return '<div class="order-item-row"><span>' + escapeHtml(name) + ' (' + size + ') × ' + qty + '</span><span>' + price + '</span></div>';
      }).join("");

      var total = Math.max(0, Number(order.subtotal || 0) - Number(order.discount || 0));

      card.innerHTML =
        '<div class="order-header">' +
          '<div><div class="order-id">' + escapeHtml(orderId) + '</div><div style="font-size:0.75rem; color:var(--ink-soft);">' + dateStr + '</div></div>' +
          '<span class="order-status-badge">' + badgeText + '</span>' +
        '</div>' +
        '<div class="order-stepper">' +
          '<div class="step-dot ' + (isConfirmed ? (isPacked ? 'completed' : 'active') : '') + '"><span>Confirmed</span></div>' +
          '<div class="step-dot ' + (isPacked ? (isShipped ? 'completed' : 'active') : '') + '"><span>Tailored</span></div>' +
          '<div class="step-dot ' + (isShipped ? (isDelivered ? 'completed' : 'active') : '') + '"><span>Shipped</span></div>' +
          '<div class="step-dot ' + (isDelivered ? 'active' : '') + '"><span>Delivered</span></div>' +
        '</div>' +
        '<div class="order-items-list">' + itemsHtml + '</div>' +
        (order.discount ? '<div class="order-item-row" style="color:var(--accent);"><span>Discount</span><span>− ' + formatRs(order.discount) + '</span></div>' : '') +
        '<div class="order-footer-row">' +
          '<span>Total Paid</span>' +
          '<span>' + formatRs(total) + '</span>' +
        '</div>' +
        '<button type="button" class="btn btn-ghost" data-action="order-invoice" style="width:100%; justify-content:center; font-size:0.78rem; padding:8px 12px; margin-top:4px;">Download PDF Invoice</button>';

      var invoiceBtn = card.querySelector('[data-action="order-invoice"]');
      if (invoiceBtn) {
        invoiceBtn.addEventListener("click", function () {
          var customer = order.customer || readCustomer();
          var dateFormatted = order.created_at ? new Date(order.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : new Date().toLocaleDateString("en-IN");
          var pdf = buildInvoicePdf(orderId, dateFormatted, order.items || [], Number(order.subtotal || 0), customer, Number(order.discount || 0));
          if (pdf) {
            var url = URL.createObjectURL(pdf.output("blob"));
            var a = document.createElement("a");
            a.href = url;
            a.download = "algodon-invoice-" + orderId + ".pdf";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
          }
        });
      }

      accountRouteContent.appendChild(card);
    });
  }

  function handleAccountRoute() {
    var route = window.location.pathname.replace(/\/$/, "") || "/";
    if (!["/account", "/orders", "/wishlist"].includes(route)) {
      if (new URLSearchParams(window.location.search).get("auth") === "required") openAccount();
      return;
    }
    openAccount();
    if (route === "/orders" || route === "/wishlist") {
      accountSignedOut.hidden = true;
      accountSignedIn.hidden = false;
      var signedInHeader = document.getElementById("signedInHeader");
      var guestModeHeader = document.getElementById("guestModeHeader");
      if (signedInHeader) signedInHeader.hidden = !firebaseUser && !supabaseUser;
      if (guestModeHeader) guestModeHeader.hidden = true;
      renderAccountRoute(route);
    } else {
      accountOrders.hidden = true;
      checkoutForm.hidden = false;
    }
  }

  function finishProtectedRedirect() {
    var destination = sessionStorage.getItem("algodon_return_to");
    if (!destination || (!firebaseUser && !supabaseUser)) return;
    sessionStorage.removeItem("algodon_return_to");
    window.location.assign(destination);
  }

  if (sb) {
    sb.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      supabaseUser = session && session.user || null;
      supabaseReady = true;
      renderAccountUser();
      finishProtectedRedirect();
    });
    sb.auth.onAuthStateChange(function (event, session) {
      supabaseUser = session && session.user || null;
      supabaseReady = true;
      renderAccountUser();
      finishProtectedRedirect();
    });
  }

  loadFirebaseAuth().then(function (firebase) {
    firebase.AuthContext.subscribe(async function (state) {
      firebaseUser = state.user;
      firebaseReady = !state.loading;
      renderAccountUser();
      if (firebaseUser) {
        try { await firebase.mergeGuestCart(firebaseUser, loadCart()); renderCart(); }
        catch (error) { console.error("Could not merge the guest cart:", error); }
        finishProtectedRedirect();
      } else if (localStorage.getItem("algodon_firebase_cart_owner")) {
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem("algodon_firebase_cart_owner");
        renderCart();
      }
    });
  }).catch(function (error) {
    firebaseReady = true;
    console.info("Firebase is not configured yet:", error.message);
    renderAccountUser();
  });

  signInForm.addEventListener("submit", function (e) {
    e.preventDefault();
    signInError.textContent = "";
    if (!sb) { signInError.textContent = "Accounts aren't reachable right now."; return; }
    var email = document.getElementById("signInEmail").value.trim();
    var password = document.getElementById("signInPassword").value;
    var btn = signInForm.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Signing in…";
    sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) { signInError.textContent = res.error.message; return; }
      if (firebaseContext) {
        return firebaseContext.logout();
      }
    }).then(function () {
      if (!signInError.textContent) {
        signInForm.reset();
        closeAccount();
        finishProtectedRedirect();
      }
    }).catch(function (error) {
      signInError.textContent = error.message || "Sign-in failed.";
    }).finally(function () { btn.disabled = false; btn.textContent = "Sign In"; });
  });

  signUpForm.addEventListener("submit", function (e) {
    e.preventDefault();
    signUpError.textContent = "";
    if (!sb) { signUpError.textContent = "Accounts aren't reachable right now."; return; }
    var name = document.getElementById("signUpName").value.trim();
    var email = document.getElementById("signUpEmail").value.trim();
    var password = document.getElementById("signUpPassword").value;
    var btn = signUpForm.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Creating account…";
    sb.auth.signUp({
      email: email,
      password: password,
      options: { data: { full_name: name } }
    }).then(function (res) {
      if (res.error) { signUpError.textContent = res.error.message; return; }
      
      // Add the registered user to the database
      if (res.data && res.data.user) {
        sb.from('profiles').insert([
          { id: res.data.user.id, full_name: name, email: email }
        ]).then(function(dbRes) {
          if (dbRes.error) console.error("Error saving profile:", dbRes.error);
        });
      }

      if (res.data && res.data.session) {
        if (firebaseContext) {
          return firebaseContext.logout().then(function () {
            signUpForm.reset();
            closeAccount();
          });
        }
        signUpForm.reset();
        closeAccount();
      } else {
        signUpError.textContent = "Account created — check your email to confirm before signing in.";
      }
    }).finally(function () { btn.disabled = false; btn.textContent = "Create Account"; });
  });

  signOutBtn.addEventListener("click", function () {
    var signOutTasks = [];
    if (sb) signOutTasks.push(sb.auth.signOut());
    if (firebaseContext) {
      signOutTasks.push(firebaseContext.logout());
    }
    Promise.all(signOutTasks).catch(function (error) {
      console.error("Sign-out failed:", error);
    });
  });
  navLogoutBtn.addEventListener("click", function () { signOutBtn.click(); });

  scrim.addEventListener("click", function () {
    closeNav(); closeCart(); closeSearch(); closeAccount();
    scrim.hidden = true;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeNav(); closeCart(); closeSearch(); closeAccount();
      closeSizeGuide();
      scrim.hidden = true;
    }
  });

  /* ---------- product card size + add-to-cart ---------- */
  function bindProductCards(cardList) {
    cardList.forEach(function (card) {
    var chips = card.querySelectorAll(".size-chip");
    var hint = card.querySelector(".size-hint");
    var addBtn = card.querySelector(".add-btn");
    var selectedSize = null;

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        selectedSize = chip.textContent;
        hint.textContent = "";
      });
    });

    addBtn.addEventListener("click", function () {
      if (!selectedSize) {
        hint.textContent = "Pick a size first";
        return;
      }
      var cart = loadCart();
      var existing = cart.find(function (i) {
        return i.id === card.dataset.product && i.size === selectedSize;
      });
      if (existing) existing.qty += 1;
      else {
        cart.push({
          id: card.dataset.product,
          name: card.dataset.name,
          price: Number(card.dataset.price),
          img: card.dataset.img,
          size: selectedSize,
          qty: 1
        });
      }
      saveCart(cart);
      renderCart();
      addBtn.textContent = "Added ✓";
      addBtn.classList.add("added");
      setTimeout(function () {
        addBtn.textContent = "Add to Cart";
        addBtn.classList.remove("added");
      }, 1300);
      openCart();
    });
    });
  }
  bindProductCards(cards);

  // When an admin-managed catalog has been published, use it in the existing
  // storefront. Keep the original concept cards as a fallback for empty setups.
  fetch('/api/products').then(function (response) {
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  }).then(function (result) {
    if (!result.data || !result.data.length) return;
    var grid = document.getElementById('productGrid');
    grid.replaceChildren();
    result.data.forEach(function (product) {
      var mainImage = product.images && product.images[0] || 'img/product-golden-brown.jpg';
      var card = document.createElement('article');
      card.className = 'card';
      card.dataset.product = product.id;
      card.dataset.name = product.name;
      card.dataset.price = String(product.sale_price == null ? product.price : product.sale_price);
      card.dataset.img = mainImage;
      var figure = document.createElement('figure');
      var img = document.createElement('img'); img.src = mainImage; img.alt = product.name;
      figure.appendChild(img);
      var body = document.createElement('div'); body.className = 'card-body';
      var brand = document.createElement('span'); brand.className = 'eyebrow'; brand.textContent = product.brand || 'Algodon Organic';
      var title = document.createElement('h3'); title.textContent = product.name;
      var priceRow = document.createElement('div'); priceRow.className = 'price-row';
      if (product.sale_price != null && Number(product.sale_price) < Number(product.price)) {
        var was = document.createElement('span'); was.className = 'was'; was.textContent = formatRs(Number(product.price)); priceRow.appendChild(was);
      }
      var price = document.createElement('span'); price.className = 'now'; price.textContent = formatRs(Number(product.sale_price == null ? product.price : product.sale_price)); priceRow.appendChild(price);
      var sizes = document.createElement('div'); sizes.className = 'size-row'; sizes.setAttribute('role', 'group'); sizes.setAttribute('aria-label', 'Select size');
      var variantSizes = Array.from(new Set((product.variants || []).map(function(v){ return v.size; }).filter(Boolean)));
      (variantSizes.length ? variantSizes : ['S','M','L','XL']).forEach(function(size){ var button=document.createElement('button');button.type='button';button.className='size-chip';button.textContent=size;sizes.appendChild(button); });
      var hint = document.createElement('div'); hint.className = 'size-hint';
      var add = document.createElement('button'); add.type='button'; add.className='add-btn'; add.textContent=product.stock_count > 0 ? 'Add to Cart' : 'Out of Stock';
      if (product.stock_count <= 0) add.disabled = true;
      body.append(brand,title,priceRow,sizes,hint,add); card.append(figure,body); grid.appendChild(card);
    });
    cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
    bindProductCards(cards);
  }).catch(function () {});

  /* ---------- newsletter ---------- */
  var newsletterForm = document.getElementById("newsletterForm");
  var newsletterMsg = document.getElementById("newsletterMsg");
  var newsletterSubmit = document.getElementById("newsletterSubmit");
  var newsletterEmail = document.getElementById("newsletterEmail");
  var signupCountEl = document.getElementById("signupCount");

  newsletterForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = newsletterEmail.value.trim();
    newsletterSubmit.disabled = true;
    loadFirebaseAuth().then(function (firebase) {
      var fs = firebase.sdk.firestoreSdk;
      return fs.addDoc(fs.collection(firebase.db, "newsletter_signups"), {
        email: email,
        createdAt: fs.serverTimestamp()
      });
    }).then(function () {
      newsletterMsg.textContent = "You're on the list — saved to the live database.";
      newsletterForm.reset();
    }).catch(function (err) {
      newsletterMsg.textContent = err && err.code === "permission-denied"
        ? "Signups are temporarily unavailable. Please try again later."
        : "Couldn't reach the database — try again in a moment.";
    }).finally(function () {
      newsletterSubmit.disabled = false;
    });
  });

  signupCountEl.hidden = true;

  renderCart();
})();

/* ---------- motion animations ---------- */
  // 1. Hero text animation
  animate(
    ".hero-copy h1, .hero-copy .eyebrow, .hero-copy p, .hero-actions", 
    { opacity: [0, 1], y: [30, 0] },
    { delay: stagger(0.15), duration: 0.8, easing: [0.22, 1, 0.36, 1] }
  );

  // 2. Fade up sections on scroll
  inView(".editorial-content", (info) => {
    animate(info.target, { opacity: [0, 1], y: [40, 0] }, { duration: 0.8, easing: [0.22, 1, 0.36, 1] });
  });

  inView(".card", (info) => {
    animate(info.target, { opacity: [0, 1], y: [20, 0] }, { duration: 0.6, easing: "ease-out" });
  });
  
  // 3. Stagger story images
  inView(".story-grid", (info) => {
    animate(".story-item", { opacity: [0, 1], scale: [0.95, 1] }, { delay: stagger(0.1), duration: 0.8 });
  });
