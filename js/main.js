import { animate, inView, spring, stagger } from 'motion';

(function() {
  "use strict";
"use strict";

  /* ---------- Supabase (customer accounts) ---------- */
  // Loaded from config.js
  var sb = (window.supabase && window.supabase.createClient && window.APP_CONFIG)
    ? window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY)
    : null;

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
  sizeGuideLink.addEventListener("click", function (e) {
    e.preventDefault();
    sizeGuideModal.hidden = false; animate(sizeGuideModal.querySelector(".modal"), { opacity: [0, 1], scale: [0.95, 1] }, { duration: 0.4, easing: spring() }); animate(sizeGuideModal, { backgroundColor: ["rgba(0,0,0,0)", "rgba(33,28,22,0.95)"] }, { duration: 0.4 });
  });
  sizeGuideClose.addEventListener("click", function () { animate(sizeGuideModal.querySelector(".modal"), { opacity: 0, scale: 0.95 }, { duration: 0.2 }).finished.then(() => { sizeGuideModal.hidden = true; }); animate(sizeGuideModal, { backgroundColor: "rgba(0,0,0,0)" }, { duration: 0.2 }); });
  sizeGuideModal.addEventListener("click", function (e) {
    if (e.target === sizeGuideModal) animate(sizeGuideModal.querySelector(".modal"), { opacity: 0, scale: 0.95 }, { duration: 0.2 }).finished.then(() => { sizeGuideModal.hidden = true; }); animate(sizeGuideModal, { backgroundColor: "rgba(0,0,0,0)" }, { duration: 0.2 });
  });


  /* ---------- cart ---------- */
  var CART_KEY = "algodon_demo_cart";
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

  /* ---------- shared database (order intents + newsletter signups) ---------- */
  
  
  var lastInvoice = null;

  function buildInvoicePdf(invoiceNo, dateStr, items, subtotal, customer) {
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
    doc.text("Rs. " + subtotal.toLocaleString("en-IN"), 490, y);

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
    cartSubtotalEl.textContent = formatRs(subtotal);
  }

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
    } catch (e) {}
  })();

  function readCustomer() {
    return {
      name: document.getElementById("shipName").value.trim(),
      email: document.getElementById("shipEmail").value.trim(),
      phone: document.getElementById("shipPhone").value.trim(),
      address1: document.getElementById("shipAddress1").value.trim(),
      address2: document.getElementById("shipAddress2").value.trim(),
      city: document.getElementById("shipCity").value.trim(),
      state: document.getElementById("shipState").value.trim(),
      pin: document.getElementById("shipPin").value.trim()
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
      cartNote.textContent = "Please set your shipping details in the Account menu first.";
      setTimeout(function() { cartNote.style.color = ""; }, 3000);
      return;
    }
    document.getElementById("shipError").textContent = "";
    try {
      var toSave = {};
      shipFields.forEach(function (id) { toSave[id] = document.getElementById(id).value; });
      localStorage.setItem(ADDRESS_KEY, JSON.stringify(toSave));
    } catch (e) {}

    var subtotal = cart.reduce(function (sum, i) { return sum + i.qty * i.price; }, 0);
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Saving order…";
    
    if (!sb) {
        cartNote.textContent = "Accounts aren't reachable right now.";
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = "Checkout";
        return;
    }
    sb.from("order_intents").insert([{
        items: cart.map(function (i) { return { name: i.name, size: i.size, qty: i.qty, price: i.price }; }),
        subtotal: subtotal,
        customer: customer,
        created_at: new Date().toISOString()
    }]).then(function(res) {
        if (res.error) throw res.error;
    
      cartNote.textContent = "Order intent saved to the database (" + cart.length + " item" + (cart.length > 1 ? "s" : "") + ", Rs. " + subtotal.toLocaleString("en-IN") + ").";
      checkoutBtn.textContent = "Saved ✓";

      var invoiceNo = "ALG-" + Date.now().toString(36).toUpperCase();
      var dateStr = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
      var pdfDoc = buildInvoicePdf(invoiceNo, dateStr, cart, subtotal, customer);
      if (pdfDoc) {
        lastInvoice = { 
          doc: pdfDoc, 
          filename: "algodon-invoice-" + invoiceNo + ".pdf",
          invoiceNo: invoiceNo,
          dateStr: dateStr,
          cart: cart,
          subtotal: subtotal,
          customer: customer
        };
        downloadInvoiceBtn.hidden = false;
        emailInvoiceBtn.hidden = false;
        var blobUrl = URL.createObjectURL(pdfDoc.output("blob"));
        downloadInvoiceBtn.dataset.url = blobUrl;
        downloadInvoiceBtn.dataset.filename = lastInvoice.filename;
      }

      saveCart([]);
      renderCart();
    }).catch(function () {
      cartNote.textContent = "Concept preview — no real payment, and the database isn’t reachable right now.";
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
    .then(res => res.json())
    .then(data => {
      if (data.previewUrl) {
        window.open(data.previewUrl, '_blank');
      }
      emailInvoiceBtn.textContent = "Email Sent ✓";
    })
    .catch(err => {
      console.error(err);
      emailInvoiceBtn.textContent = "Error sending email";
    })
    .finally(() => {
      setTimeout(() => {
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
  var authToggleBtn = document.getElementById("authToggleBtn");
  var authTitle = document.getElementById("authTitle");
  var signInForm = document.getElementById("signInForm");
  var signUpForm = document.getElementById("signUpForm");
  var signInError = document.getElementById("signInError");
  var signUpError = document.getElementById("signUpError");
  var signOutBtn = document.getElementById("signOutBtn");
  var googleSignInBtn = document.getElementById("googleSignInBtn");
  
  var isSignIn = true;

  function openAccount() { closeCart(); accountDrawer.hidden = false; animate(accountDrawer.querySelector(".modal"), { opacity: [0, 1], y: [20, 0], scale: [0.95, 1] }, { duration: 0.4, easing: spring() }); animate(accountDrawer, { backgroundColor: ["rgba(0,0,0,0)", "rgba(33,28,22,0.95)"] }, { duration: 0.4 }); }
  function closeAccount() { 
    if (accountDrawer.hidden) return;
    animate(accountDrawer.querySelector(".modal"), { opacity: 0, scale: 0.95, y: 10 }, { duration: 0.2 }).finished.then(() => { accountDrawer.hidden = true; }); 
    animate(accountDrawer, { backgroundColor: "rgba(0,0,0,0)" }, { duration: 0.2 }); 
  }
  accountToggle.addEventListener("click", openAccount);
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
    if (!sb) {
      signInError.textContent = "Supabase not initialized.";
      return;
    }
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) {
      console.error('Google Sign-In Error:', error.message);
      signInError.textContent = "Google Sign-In failed.";
    }
  });

  function showSignedIn(user) {
    accountSignedOut.hidden = true;
    accountSignedIn.hidden = false;
    accountEmail.textContent = user.email;
    var emailField = document.getElementById("shipEmail");
    if (emailField && !emailField.value) emailField.value = user.email;
    var nameField = document.getElementById("shipName");
    if (nameField && !nameField.value && user.user_metadata && user.user_metadata.full_name) {
      nameField.value = user.user_metadata.full_name;
    }
  }
  function showSignedOut() {
    accountSignedOut.hidden = false;
    accountSignedIn.hidden = true;
  }

  if (sb) {
    sb.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session && session.user) showSignedIn(session.user);
    });
    sb.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) showSignedIn(session.user);
      else showSignedOut();
    });
  }

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
      signInForm.reset();
      closeAccount();
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
        signUpForm.reset();
        closeAccount();
      } else {
        signUpError.textContent = "Account created — check your email to confirm before signing in.";
      }
    }).finally(function () { btn.disabled = false; btn.textContent = "Create Account"; });
  });

  signOutBtn.addEventListener("click", function () {
    if (!sb) return;
    sb.auth.signOut();
  });

  scrim.addEventListener("click", function () {
    closeNav(); closeCart(); closeSearch(); closeAccount();
    scrim.hidden = true;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeNav(); closeCart(); closeSearch(); closeAccount();
      animate(sizeGuideModal.querySelector(".modal"), { opacity: 0, scale: 0.95 }, { duration: 0.2 }).finished.then(() => { sizeGuideModal.hidden = true; }); animate(sizeGuideModal, { backgroundColor: "rgba(0,0,0,0)" }, { duration: 0.2 });
      scrim.hidden = true;
    }
  });

  /* ---------- product card size + add-to-cart ---------- */
  cards.forEach(function (card) {
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
    dbPromise.then(function (db) {
      if (!db) throw { code: "not_granted" };
      return db.collection("newsletter_signups").add({
        email: email,
        created_at: new Date().toISOString()
      });
    }).then(function () {
      newsletterMsg.textContent = "You're on the list — saved to the live database.";
      newsletterForm.reset();
    }).catch(function (err) {
      if (err && err.code === "quota_exceeded") {
        newsletterMsg.textContent = "The signup list is full for this preview.";
      } else {
        newsletterMsg.textContent = "Couldn't reach the database — try again in a moment.";
      }
    }).finally(function () {
      newsletterSubmit.disabled = false;
    });
  });

  dbPromise.then(function (db) {
    if (!db) return;
    db.collection("newsletter_signups").onSnapshot(function (snap) {
      if (snap.size > 0) {
        signupCountEl.hidden = false;
        signupCountEl.textContent = snap.size === 1 ? "1 person has signed up so far." : snap.size + " people have signed up so far.";
      }
    }, function () {});
  });

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

  inView(".product-card", (info) => {
    animate(info.target, { opacity: [0, 1], y: [20, 0] }, { duration: 0.6, easing: "ease-out" });
  });
  
  // 3. Stagger story images
  inView(".story-grid", (info) => {
    animate(".story-item", { opacity: [0, 1], scale: [0.95, 1] }, { delay: stagger(0.1), duration: 0.8 });
  });

// Hijack the modal toggles to add animations
const originalOpenCart = openCart;
const originalCloseCart = closeCart;
const originalOpenAccount = openAccount;
const originalCloseAccount = closeAccount;
const originalOpenSize = function() { sizeGuideModal.hidden = false; animate(sizeGuideModal.querySelector(".modal"), { opacity: [0, 1], scale: [0.95, 1] }, { duration: 0.4, easing: spring() }); animate(sizeGuideModal, { backgroundColor: ["rgba(0,0,0,0)", "rgba(33,28,22,0.95)"] }, { duration: 0.4 }); };
const originalCloseSize = function() { animate(sizeGuideModal.querySelector(".modal"), { opacity: 0, scale: 0.95 }, { duration: 0.2 }).finished.then(() => { sizeGuideModal.hidden = true; }); animate(sizeGuideModal, { backgroundColor: "rgba(0,0,0,0)" }, { duration: 0.2 }); };

// We need to re-assign or override the toggles. Wait, they are local functions in main.js.
// It's easier to just animate the modals directly if they are DOM elements.
