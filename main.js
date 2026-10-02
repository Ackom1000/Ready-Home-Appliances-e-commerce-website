

   
(function () {
  'use strict';

  /* ==========================================================
     1. CONFIG
     ========================================================== */
  var CONFIG = {
    API_BASE: 'http://localhost:5000',   
    WHATSAPP: '233591922237',
    PHONE: '+233591922237',
    EMAIL: 'naanadoffoe@gmail.com',
    PAGE_SIZE: 12,
    SEARCH_LIMIT: 24,
    DELIVERY_FEE: 0,        
    FLASH_DISCOUNT: 10,     
    FLASH_HOURS: 6,        
    OPEN_MINUTES: 18 * 60,  
    CLOSE_MINUTES: 21 * 60, 
    SLOT_STEP: 30,
    MAX_RECENT: 8,
    MAX_QTY: 20
  };

  var OFFLINE_MSG = 'Online services are temporarily unavailable. You can still contact us through WhatsApp.';

  var KEYS = {
    cart: 'rha_cart', favs: 'rha_favorites', recent: 'rha_recent', searches: 'rha_searches',
    reviews: 'rha_reviews', appts: 'rha_appointments', orders: 'rha_orders',
    theme: 'rha_theme', brightness: 'rha_brightness', flash: 'rha_flash_end'
  };

  var CATEGORIES = [
    { name: 'Refrigerators', icon: 'fa-snowflake' },
    { name: 'Freezers', icon: 'fa-icicles' },
    { name: 'Washing Machines', icon: 'fa-soap' },
    { name: 'Televisions', icon: 'fa-tv' },
    { name: 'Fans', icon: 'fa-fan' },
    { name: 'Air Conditioners', icon: 'fa-wind' },
    { name: 'Cookers', icon: 'fa-fire-burner' },
    { name: 'Microwaves', icon: 'fa-bolt' },
    { name: 'Blenders', icon: 'fa-blender' },
    { name: 'Kettles', icon: 'fa-mug-hot' },
    { name: 'Irons', icon: 'fa-temperature-high' },
    { name: 'Air Fryers', icon: 'fa-drumstick-bite' },
    { name: 'Sound Systems', icon: 'fa-volume-high' },
    { name: 'Water Dispensers', icon: 'fa-droplet' },
    { name: 'Ceiling Fans', icon: 'fa-fan' },
    { name: 'Small Appliances', icon: 'fa-plug' },
    { name: 'Kitchen Appliances', icon: 'fa-kitchen-set' }
  ];

  var POPULAR_SEARCHES = ['fridge', 'television', 'washing machine', 'fan', 'kettle', 'microwave', 'blender', 'air conditioner'];
  var FLASH_IDS = [4, 9, 15, 18, 26, 27];

  
  function loadProductsFromHtml() {
    var nodes = qsa('#productSource .product-source');
    var list = nodes.map(function (el) {
      var d = el.dataset;
      var id = parseInt(d.id, 10);
      var price = Number(d.price);
      if (!id || !Number.isFinite(price)) { return null; } 
      var tags = (d.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      return {
        id: id,
        image: d.image || '',
        name: d.name || 'Unnamed product',
        brand: d.brand || 'Generic',
        category: d.category || 'Small Appliances',
        price: price,
        tags: tags,
        keywords: d.keywords || '',
        desc: d.desc || '',
        rating: 5, reviews: 4.5, stock: 'in'
      };
    }).filter(Boolean);
    return list;
  }

  var PRODUCTS = [];
  var PRODUCT_MAP = {};
  function buildProductIndex() {
    PRODUCTS = loadProductsFromHtml();
    PRODUCT_MAP = {};
    PRODUCTS.forEach(function (p) { PRODUCT_MAP[p.id] = p; });
  }

  /* ==========================================================
     3. HELPERS + STATE
     ========================================================== */
  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var clamp = function (n, a, b) { return Math.min(b, Math.max(a, n)); };
  var HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return HTML_ESC[c]; }); };
  var money = function (n) {
    return '\u20B5' + (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };
  var money2 = function (n) { return '\u20B5' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var stars = function (r) { var f = clamp(Math.round(r), 0, 5); return '\u2605'.repeat(f) + '\u2606'.repeat(5 - f); };
  var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };
  var isPhone = function (v) { return /^(\+233|233|0)\d{9}$/.test(v.replace(/[\s-]/g, '')); };
  var getProduct = function (id) { return PRODUCT_MAP[id] || null; };
  var debounce = function (fn, ms) { var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); }; };

  var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#e6ebf3"/>' +
    '<text x="50%" y="50%" fill="#64707f" font-family="Arial" font-size="20" text-anchor="middle">Image coming soon</text></svg>');

  var store = {
    get: function (k, fb) { try { var v = localStorage.getItem(k); return v === null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  
  buildProductIndex();

  var state = {
    cart: (store.get(KEYS.cart, []) || []).filter(function (i) { return i && getProduct(i.id) && Number.isInteger(i.qty) && i.qty > 0; })
      .map(function (i) { return { id: i.id, qty: Math.min(i.qty, CONFIG.MAX_QTY) }; }),
    favs: (store.get(KEYS.favs, []) || []).filter(function (id) { return getProduct(id); }),
    recent: (store.get(KEYS.recent, []) || []).filter(function (id) { return getProduct(id); }),
    searches: store.get(KEYS.searches, []) || [],
    reviews: store.get(KEYS.reviews, {}) || {},
    filters: { category: 'all', brand: 'all', min: '', max: '', rating: 0, stock: 'all', collection: 'all', sort: 'recommended' },
    visible: CONFIG.PAGE_SIZE,
    currentId: null,
    reviewRating: 0,
    buyNowItems: [],
    checkoutFromCart: true,
    lastFocus: null,
    chatStarted: false
  };
  var search = { term: '', category: 'all', price: 'all', sort: 'recommended' };

  /* ---- toast ---- */
  function toast(msg, type) {
    var c = $('toastContainer');
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'success');
    t.textContent = msg;
    c.appendChild(t);
    while (c.children.length > 4) { c.removeChild(c.firstChild); }
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 350); }, 3200);
  }

  /* ---- overlays + focus ---- */
  function syncScrollLock() {
    var open = ['searchOverlay', 'productModal', 'checkoutModal'].some(function (id) { return !$(id).hidden; }) || $('cartDrawer').classList.contains('open');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  function rememberFocus() { if (document.activeElement && document.activeElement !== document.body) { state.lastFocus = document.activeElement; } }
  function restoreFocus() { if (state.lastFocus && document.body.contains(state.lastFocus)) { state.lastFocus.focus(); } state.lastFocus = null; }
  function showEl(el) { el.hidden = false; syncScrollLock(); }
  function hideEl(el) { el.hidden = true; syncScrollLock(); }

  /* ---- pricing ---- */
  function isFlash(p) { return FLASH_IDS.indexOf(p.id) !== -1; }
  function salePrice(p) { return isFlash(p) ? Math.round(p.price * (1 - CONFIG.FLASH_DISCOUNT / 100)) : p.price; }
  function discountPct(p) { return isFlash(p) ? CONFIG.FLASH_DISCOUNT : 0; }
  function getRating(p) {
    var list = state.reviews[p.id] || [];
    if (!list.length) { return { avg: p.rating, count: p.reviews }; }
    var sum = list.reduce(function (s, r) { return s + r.rating; }, 0);
    var count = p.reviews + list.length;
    return { avg: (p.rating * p.reviews + sum) / count, count: count };
  }
  function stockLabel(p) { return p.stock === 'low' ? 'Low Stock' : (p.stock === 'out' ? 'Out of Stock' : 'In Stock'); }
  function badgeFor(p) {
    if (isFlash(p)) { return 'Flash Deal'; }
    if (p.tags.indexOf('best') !== -1) { return 'Best Seller'; }
    if (p.tags.indexOf('new') !== -1) { return 'New'; }
    if (p.tags.indexOf('popular') !== -1) { return 'Popular'; }
    if (p.tags.indexOf('featured') !== -1) { return 'Featured'; }
    return '';
  }
  function waLink(text) { return 'https://wa.me/' + CONFIG.WHATSAPP + '?text=' + encodeURIComponent(text); }
  function productWaText(p) { return 'Hello Ready Home Appliances, I am interested in ' + p.name + '. Please provide more information.'; }

  /* ---- API ---- */
  function apiPost(path, body) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) { ctrl.abort(); } }, 10000);
    return fetch(CONFIG.API_BASE + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        return { ok: res.ok && !!data && data.success !== false, offline: false, data: data };
      });
    }).catch(function () {
      return { ok: false, offline: true, data: null };
    }).then(function (r) { clearTimeout(timer); return r; });
  }
  function failText(r) { return r.offline ? OFFLINE_MSG : ((r.data && r.data.message) || 'Something went wrong. Please check your details and try again.'); }

  /* ---- forms ---- */
  function setError(id, msg) {
    var input = $(id);
    if (!input) { return; }
    input.classList.toggle('invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    var s = document.querySelector('[data-error-for="' + id + '"]');
    if (s) { s.textContent = msg || ''; }
  }
  function validate(rules) {
    var first = null;
    rules.forEach(function (r) {
      var msg = r[1]($(r[0]).value);
      setError(r[0], msg);
      if (msg && !first) { first = r[0]; }
    });
    if (first) { $(first).focus(); }
    return !first;
  }
  var V = {
    name: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your full name.'; },
    phone: function (v) { return isPhone(v) ? '' : 'Enter a valid phone number, e.g. 0591922237.'; },
    email: function (v) { return !v.trim() || isEmail(v.trim()) ? '' : 'Enter a valid email address.'; },
    need: function (label) { return function (v) { return v.trim() ? '' : label; }; }
  };
  function val(id) { return $(id).value.trim().slice(0, 500); }
  function showResult(el, html, fail) { el.hidden = false; el.className = 'result-box' + (fail ? ' fail' : ''); el.innerHTML = html; }

  /* ==========================================================
     4. PRODUCT CARD
     ========================================================== */
  function productCard(p) {
    var r = getRating(p), sale = salePrice(p), disc = discountPct(p), fav = state.favs.indexOf(p.id) !== -1;
    var badge = badgeFor(p), out = p.stock === 'out';
    return '<article class="product-card" data-id="' + p.id + '">' +
      '<div class="card-img" data-action="open" data-id="' + p.id + '">' +
        '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
        '<div class="card-badges">' + (badge ? '<span class="badge-tag">' + esc(badge) + '</span>' : '') + (disc ? '<span class="discount-badge">-' + disc + '%</span>' : '') + '</div>' +
        '<button type="button" class="fav-btn' + (fav ? ' active' : '') + '" data-action="fav" data-id="' + p.id + '" aria-pressed="' + fav + '" aria-label="' + (fav ? 'Remove from favorites: ' : 'Add to favorites: ') + esc(p.name) + '"><i class="' + (fav ? 'fa-solid' : 'fa-regular') + ' fa-heart"></i></button>' +
        '<button type="button" class="quick-btn" data-action="open" data-id="' + p.id + '">Quick View</button>' +
      '</div>' +
      '<div class="card-body">' +
        '<span class="card-brand">' + esc(p.brand) + '</span>' +
        '<h3 class="card-title">' + esc(p.name) + '</h3>' +
        '<div class="stars" aria-label="Rated ' + r.avg.toFixed(1) + ' out of 5">' + stars(r.avg) + '<small>(' + r.count + ')</small></div>' +
        '<div class="price-row"><span class="price">' + money(sale) + '</span>' + (disc ? '<span class="old-price">' + money(p.price) + '</span>' : '') + '</div>' +
        '<span class="stock ' + esc(p.stock) + '">' + stockLabel(p) + '</span>' +
        '<div class="card-actions">' +
          '<button type="button" class="btn btn-navy" data-action="add" data-id="' + p.id + '"' + (out ? ' disabled' : '') + '>Add To Cart</button>' +
          '<button type="button" class="btn btn-gold" data-action="buy" data-id="' + p.id + '"' + (out ? ' disabled' : '') + '>Buy Now</button>' +
        '</div>' +
      '</div></article>';
  }

  /* ==========================================================
     5. FILTERS, SORTING, RENDERING
     ========================================================== */
  function sortList(list, mode) {
    var l = list.slice();
    if (mode === 'price-asc') { l.sort(function (a, b) { return salePrice(a) - salePrice(b); }); }
    else if (mode === 'price-desc') { l.sort(function (a, b) { return salePrice(b) - salePrice(a); }); }
    else if (mode === 'rating') { l.sort(function (a, b) { var x = getRating(a), y = getRating(b); return (y.avg - x.avg) || (y.count - x.count); }); }
    else if (mode === 'newest') { l.sort(function (a, b) { return b.id - a.id; }); }
    return l;
  }

  function getFiltered() {
    var f = state.filters;
    var list = PRODUCTS.filter(function (p) {
      var price = salePrice(p);
      if (f.collection !== 'all' && p.tags.indexOf(f.collection) === -1) { return false; }
      if (f.category !== 'all' && p.category !== f.category) { return false; }
      if (f.brand !== 'all' && p.brand !== f.brand) { return false; }
      if (f.min !== '' && price < Number(f.min)) { return false; }
      if (f.max !== '' && price > Number(f.max)) { return false; }
      if (f.rating && getRating(p).avg < f.rating) { return false; }
      if (f.stock === 'in' && p.stock !== 'in') { return false; }
      if (f.stock === 'low' && p.stock !== 'low') { return false; }
      return true;
    });
    return sortList(list, f.sort);
  }

  function renderProducts() {
    var list = getFiltered(), n = list.length;
    $('productCount').textContent = n ? n + ' product' + (n === 1 ? '' : 's') + ' found' : 'No products found.';
    $('productGrid').innerHTML = n ? list.slice(0, state.visible).map(productCard).join('') : '<p class="no-results">No products found.</p>';
    $('loadMore').hidden = n <= state.visible;
  }
  function renderFlash() { $('flashDeals').innerHTML = FLASH_IDS.map(getProduct).filter(Boolean).map(productCard).join(''); }
  function renderFavorites() {
    var list = state.favs.map(getProduct).filter(Boolean);
    $('favoritesGrid').innerHTML = list.length ? list.map(productCard).join('') : '<p class="no-results">You have no favorites yet. Tap the heart on any product to save it.</p>';
  }
  function renderRecent() {
    var list = state.recent.map(getProduct).filter(Boolean);
    $('recentGrid').innerHTML = list.length ? list.map(productCard).join('') : '<p class="no-results">Products you view will appear here.</p>';
  }
  function renderCategories() {
    $('categoryGrid').innerHTML = CATEGORIES.map(function (c) {
      var n = PRODUCTS.filter(function (p) { return p.category === c.name; }).length;
      return '<button type="button" class="category-card' + (state.filters.category === c.name ? ' active' : '') + '" data-action="category" data-cat="' + esc(c.name) + '">' +
        '<i class="fa-solid ' + c.icon + '"></i>' + esc(c.name) + '<br><small>' + n + (n === 1 ? ' item' : ' items') + '</small></button>';
    }).join('');
  }
  function renderAll() {
    renderCategories(); renderFlash(); renderProducts(); renderFavorites(); renderRecent();
    if (!$('searchOverlay').hidden) { renderSearch(); }
  }
  function updateFavCount() { $('favCount').textContent = state.favs.length; }

  function populateSelects() {
    var catOpts = '<option value="all">All categories</option>' + CATEGORIES.map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>'; }).join('');
    $('filterCategory').innerHTML = catOpts;
    $('searchCategory').innerHTML = catOpts;
    var brands = [];
    PRODUCTS.forEach(function (p) { if (brands.indexOf(p.brand) === -1) { brands.push(p.brand); } });
    brands.sort();
    $('filterBrand').innerHTML = '<option value="all">All brands</option>' + brands.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');
  }

  function resetProductFilters() {
    state.filters = { category: 'all', brand: 'all', min: '', max: '', rating: 0, stock: 'all', collection: 'all', sort: 'recommended' };
    state.visible = CONFIG.PAGE_SIZE;
    $('filterCategory').value = 'all'; $('filterBrand').value = 'all'; $('filterMin').value = ''; $('filterMax').value = '';
    $('filterRating').value = '0'; $('filterStock').value = 'all'; $('sortSelect').value = 'recommended';
    qsa('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.collection === 'all'); });
    renderCategories(); renderProducts();
  }

  function applyCategory(cat) {
    state.filters.category = cat; state.visible = CONFIG.PAGE_SIZE;
    $('filterCategory').value = cat;
    renderCategories(); renderProducts();
    $('products').scrollIntoView({ behavior: 'smooth' });
  }

  /* ==========================================================
     6. SEARCH OVERLAY
     ========================================================== */
  var TOKEN_ALIAS = { tvs: 'tv', acs: 'ac' };
  function tokens(term) {
    return term.toLowerCase().split(/\s+/).filter(Boolean).map(function (t) {
      if (TOKEN_ALIAS[t]) { return TOKEN_ALIAS[t]; }
      return t.length > 3 && t.charAt(t.length - 1) === 's' ? t.slice(0, -1) : t;
    });
  }
  function matchTerm(p, toks) {
    if (!toks.length) { return true; }
    var hay = (p.name + ' ' + p.brand + ' ' + p.category + ' ' + p.desc + ' ' + p.keywords).toLowerCase();
    return toks.every(function (t) {
      if (t.length <= 2) { return new RegExp('\\b' + t.replace(/[^a-z0-9]/g, '') + '\\b').test(hay); }
      return hay.indexOf(t) !== -1;
    });
  }
  function inPriceRange(price, range) {
    if (range === 'all') { return true; }
    var parts = range.split('-');
    return price >= Number(parts[0]) && price <= Number(parts[1]);
  }
  function chip(t) { return '<button type="button" class="chip" data-action="chip" data-term="' + esc(t) + '">' + esc(t) + '</button>'; }

  function renderSuggestions() {
    $('recentSearches').innerHTML = state.searches.length ? state.searches.map(chip).join('') : '<small>No recent searches yet.</small>';
    var heading = $('popularSearches').previousElementSibling;
    if (search.term.trim().length >= 2) {
      var toks = tokens(search.term), seen = [];
      PRODUCTS.forEach(function (p) { if (matchTerm(p, toks) && seen.length < 5) { seen.push(p.name); } });
      if (heading) { heading.textContent = 'Suggestions'; }
      $('popularSearches').innerHTML = seen.length ? seen.map(chip).join('') : '<small>No suggestions.</small>';
    } else {
      if (heading) { heading.textContent = 'Popular searches'; }
      $('popularSearches').innerHTML = POPULAR_SEARCHES.map(chip).join('');
    }
  }

  function renderSearch() {
    var toks = tokens(search.term);
    var list = PRODUCTS.filter(function (p) {
      return matchTerm(p, toks) && (search.category === 'all' || p.category === search.category) && inPriceRange(salePrice(p), search.price);
    });
    list = sortList(list, search.sort);
    var total = list.length;
    $('searchCount').textContent = total
      ? total + ' product' + (total === 1 ? '' : 's') + ' found' + (total > CONFIG.SEARCH_LIMIT ? ' (showing first ' + CONFIG.SEARCH_LIMIT + ')' : '')
      : 'No products found.';
    $('searchResults').innerHTML = total ? list.slice(0, CONFIG.SEARCH_LIMIT).map(productCard).join('') : '<p class="no-results">No products found.</p>';
    renderSuggestions();
  }

  function addRecentSearch(term) {
    var t = term.trim().toLowerCase();
    if (t.length < 2) { return; }
    state.searches = [t].concat(state.searches.filter(function (s) { return s !== t; })).slice(0, 6);
    store.set(KEYS.searches, state.searches);
  }
  function openSearch() {
    rememberFocus();
    showEl($('searchOverlay'));
    renderSearch();
    $('searchInput').focus();
  }
  function closeSearch() {
    if ($('searchOverlay').hidden) { return; }
    if (search.term) { addRecentSearch(search.term); }
    hideEl($('searchOverlay'));
    restoreFocus();
  }
  function clearSearchAll() {
    search.term = ''; search.category = 'all'; search.price = 'all'; search.sort = 'recommended';
    $('searchInput').value = ''; $('searchCategory').value = 'all'; $('searchPrice').value = 'all'; $('searchSort').value = 'recommended';
    renderSearch(); $('searchInput').focus();
  }

  /* ==========================================================
     7. CART
     ========================================================== */
  function saveCart() { store.set(KEYS.cart, state.cart); }
  function cartLines(items) {
    return items.map(function (i) { var p = getProduct(i.id); return p ? { p: p, qty: i.qty, unit: salePrice(p) } : null; }).filter(Boolean);
  }
  function cartTotals(lines) {
    var subtotal = 0, discount = 0;
    lines.forEach(function (l) { subtotal += l.p.price * l.qty; discount += (l.p.price - l.unit) * l.qty; });
    var delivery = lines.length ? CONFIG.DELIVERY_FEE : 0;
    return { subtotal: subtotal, discount: discount, delivery: delivery, total: subtotal - discount + delivery };
  }
  function deliveryText(lines, t) {
    if (!lines.length) { return money2(0); }
    return CONFIG.DELIVERY_FEE > 0 ? money2(t.delivery) : 'Confirmed on order';
  }
  function qtyControl(id, qty, prefix) {
    return '<div class="qty"><button type="button" data-action="' + prefix + 'dec" data-id="' + id + '" aria-label="Decrease quantity">\u2212</button>' +
      '<input type="number" value="' + qty + '" readonly aria-label="Quantity">' +
      '<button type="button" data-action="' + prefix + 'inc" data-id="' + id + '" aria-label="Increase quantity">+</button></div>';
  }

  function renderCart() {
    var lines = cartLines(state.cart), t = cartTotals(lines);
    $('cartCount').textContent = state.cart.reduce(function (s, i) { return s + i.qty; }, 0);
    $('cartItems').innerHTML = lines.length ? lines.map(function (l) {
      return '<div class="cart-item">' +
        '<img src="' + esc(l.p.image) + '" alt="' + esc(l.p.name) + '">' +
        '<div><h4>' + esc(l.p.name) + '</h4><p class="unit">' + money(l.unit) + ' each</p>' + qtyControl(l.p.id, l.qty, '') +
        '<button type="button" class="remove-btn" data-action="remove" data-id="' + l.p.id + '">Remove</button></div>' +
        '<div class="line-total">' + money2(l.unit * l.qty) + '</div></div>';
    }).join('') : '<p class="cart-empty">Your cart is empty.</p>';
    $('cartSubtotal').textContent = money2(t.subtotal);
    $('cartDelivery').textContent = deliveryText(lines, t);
    $('cartDiscount').textContent = t.discount ? '-' + money2(t.discount) : money2(0);
    $('cartTotal').textContent = money2(t.total);
  }

  function addToCart(id, qty) {
    var p = getProduct(id);
    if (!p || p.stock === 'out') { return; }
    var item = state.cart.filter(function (i) { return i.id === id; })[0];
    if (item) { item.qty = clamp(item.qty + qty, 1, CONFIG.MAX_QTY); } else { state.cart.push({ id: id, qty: clamp(qty, 1, CONFIG.MAX_QTY) }); }
    saveCart(); renderCart();
    toast('Added to cart successfully.');
  }
  function changeQty(id, delta) {
    var item = state.cart.filter(function (i) { return i.id === id; })[0];
    if (!item) { return; }
    item.qty = clamp(item.qty + delta, 1, CONFIG.MAX_QTY);
    saveCart(); renderCart();
  }
  function removeFromCart(id) {
    state.cart = state.cart.filter(function (i) { return i.id !== id; });
    saveCart(); renderCart();
    toast('Removed from cart.', 'error');
  }
  function openCart() {
    rememberFocus();
    var d = $('cartDrawer');
    $('cartOverlay').hidden = false;
    d.inert = false; d.setAttribute('aria-hidden', 'false'); d.classList.add('open');
    syncScrollLock();
    $('closeCart').focus();
  }
  function closeCart() {
    var d = $('cartDrawer');
    if (!d.classList.contains('open')) { return; }
    d.classList.remove('open'); d.inert = true; d.setAttribute('aria-hidden', 'true');
    $('cartOverlay').hidden = true;
    syncScrollLock(); restoreFocus();
  }

  /* ---- favorites + recently viewed ---- */
  function toggleFav(id) {
    var i = state.favs.indexOf(id);
    if (i === -1) { state.favs.push(id); toast('Added to favorites.'); } else { state.favs.splice(i, 1); toast('Removed from favorites.', 'error'); }
    store.set(KEYS.favs, state.favs);
    updateFavCount(); renderAll();
  }
  function addRecentlyViewed(id) {
    state.recent = [id].concat(state.recent.filter(function (x) { return x !== id; })).slice(0, CONFIG.MAX_RECENT);
    store.set(KEYS.recent, state.recent);
    renderRecent();
  }

  /* ==========================================================
     8. CHECKOUT + ORDERS
     ========================================================== */
  function checkoutItems() { return state.checkoutFromCart ? state.cart : state.buyNowItems; }

  function renderSummary() {
    var lines = cartLines(checkoutItems()), t = cartTotals(lines);
    $('summaryItems').innerHTML = lines.length ? lines.map(function (l) {
      return '<div class="sum-row"><span>' + esc(l.p.name) + '</span>' + qtyControl(l.p.id, l.qty, 'sum-') + '<strong>' + money2(l.unit * l.qty) + '</strong></div>';
    }).join('') : '<p>No items selected.</p>';
    $('sumSubtotal').textContent = money2(t.subtotal - t.discount);
    $('sumDelivery').textContent = deliveryText(lines, t);
    $('sumTotal').textContent = money2(t.total);
  }
  function changeSummaryQty(id, delta) {
    var item = checkoutItems().filter(function (i) { return i.id === id; })[0];
    if (!item) { return; }
    item.qty = clamp(item.qty + delta, 1, CONFIG.MAX_QTY);
    if (state.checkoutFromCart) { saveCart(); renderCart(); }
    renderSummary();
  }

  function openCheckout(items, fromCart) {
    state.checkoutFromCart = fromCart;
    state.buyNowItems = fromCart ? [] : items;
    if (!checkoutItems().length) { toast('Your cart is empty.', 'error'); return; }
    closeCart(); closeSearch(); closeProduct();
    rememberFocus();
    qsa('#checkoutForm input, #checkoutForm textarea').forEach(function (el) { if (el.id) { setError(el.id, ''); } });
    $('checkoutResult').hidden = true;
    renderSummary();
    showEl($('checkoutModal'));
    $('coName').focus();
  }
  function closeCheckout() {
    if ($('checkoutModal').hidden) { return; }
    hideEl($('checkoutModal')); restoreFocus();
  }

  function orderMessage() {
    var lines = cartLines(checkoutItems()), t = cartTotals(lines);
    var msg = 'Hello Ready Home Appliances, I would like to place an order:\n\n';
    lines.forEach(function (l, i) { msg += (i + 1) + '. ' + l.p.name + ' x' + l.qty + ' - ' + money2(l.unit * l.qty) + '\n'; });
    msg += '\nSubtotal: ' + money2(t.subtotal - t.discount) + '\nDelivery: ' + (CONFIG.DELIVERY_FEE > 0 ? money2(t.delivery) : 'to be confirmed') + '\nTotal: ' + money2(t.total) + '\n';
    var info = [['Name', 'coName'], ['Phone', 'coPhone'], ['Email', 'coEmail'], ['Location', 'coLocation'], ['House No.', 'coHouse'], ['Address', 'coAddress'], ['Notes', 'coNotes']];
    var extra = info.filter(function (x) { return val(x[1]); }).map(function (x) { return x[0] + ': ' + val(x[1]); });
    if (extra.length) { msg += '\n' + extra.join('\n'); }
    return msg;
  }

  function submitOrder(e) {
    e.preventDefault();
    if (!checkoutItems().length) { toast('Your cart is empty.', 'error'); return; }
    var ok = validate([
      ['coName', V.name], ['coPhone', V.phone], ['coEmail', V.email],
      ['coLocation', V.need('Please enter your location.')], ['coAddress', V.need('Please enter your delivery address.')]
    ]);
    if (!ok) { return; }
    var lines = cartLines(checkoutItems()), t = cartTotals(lines);
    var payload = {
      customer: { name: val('coName'), phone: val('coPhone'), email: val('coEmail'), location: val('coLocation'), houseNumber: val('coHouse'), address: val('coAddress'), notes: val('coNotes') },
      products: lines.map(function (l) { return { id: l.p.id, name: l.p.name, quantity: l.qty, unitPrice: l.unit, lineTotal: l.unit * l.qty }; }),
      subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total
    };
    var btn = e.target.querySelector('button[type="submit"]'), old = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending...';
    var waText = orderMessage();
    apiPost('/api/orders', payload).then(function (r) {
      btn.disabled = false; btn.textContent = old;
      if (r.ok) {
        var orders = store.get(KEYS.orders, []); orders.push({ date: new Date().toISOString(), payload: payload }); store.set(KEYS.orders, orders.slice(-20));
        var ref = r.data && r.data.orderId ? '<p>Order reference: <strong>' + esc(r.data.orderId) + '</strong></p>' : '';
        showResult($('checkoutResult'), '<h3>Order submitted successfully.</h3>' + ref + '<p>Thank you, ' + esc(payload.customer.name) + '. Total: <strong>' + money2(t.total) + '</strong>. We will contact you on ' + esc(payload.customer.phone) + ' to confirm.</p>');
        toast('Order submitted successfully.');
        if (state.checkoutFromCart) { state.cart = []; saveCart(); renderCart(); } else { state.buyNowItems = []; }
        renderSummary();
        e.target.reset();
      } else {
        showResult($('checkoutResult'), '<p>' + esc(failText(r)) + '</p><p><a href="' + waLink(waText) + '" target="_blank" rel="noopener">Send this order on WhatsApp</a></p>', true);
        toast(r.offline ? 'Online services are unavailable.' : 'Order could not be submitted.', 'error');
      }
    });
  }

  /* ==========================================================
     9. PRODUCT MODAL + REVIEWS
     ========================================================== */
  function renderReviews(p) {
    var list = (state.reviews[p.id] || []).slice().reverse(), r = getRating(p);
    $('avgRating').textContent = r.count ? r.avg.toFixed(1) : '\u2014';
    $('reviewCount').textContent = r.count;
    $('reviewList').innerHTML = list.length ? list.map(function (v) {
      return '<div class="review-item"><strong>' + esc(v.name) + '</strong> <span class="stars">' + stars(v.rating) + '</span> <small>' + esc(v.date) + '</small><p>' + esc(v.text) + '</p></div>';
    }).join('') : '<p>No reviews yet. Be the first to review this product.</p>';
  }
  function setReviewStars(n) {
    state.reviewRating = n;
    qsa('#starInput button').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.star) <= n); });
  }
  function openProduct(id) {
    var p = getProduct(id);
    if (!p) { return; }
    closeSearch();
    rememberFocus();
    state.currentId = id;
    var r = getRating(p), disc = discountPct(p);
    $('pmImage').src = p.image; $('pmImage').alt = p.name;
    $('pmBrand').textContent = p.brand; $('pmCategory').textContent = p.category; $('pmName').textContent = p.name;
    $('pmStars').textContent = stars(r.avg);
    $('pmRatingText').textContent = r.avg.toFixed(1) + ' (' + r.count + ' review' + (r.count === 1 ? '' : 's') + ')';
    $('pmPrice').textContent = money(salePrice(p));
    $('pmOld').textContent = disc ? money(p.price) : '';
    $('pmDiscount').textContent = disc ? '-' + disc + '%' : ''; $('pmDiscount').hidden = !disc;
    $('pmStock').className = 'stock ' + p.stock; $('pmStock').textContent = stockLabel(p);
    $('pmDesc').textContent = p.desc + ' For full specifications, message us on WhatsApp.';
    $('pmQty').value = 1;
    $('pmAdd').disabled = $('pmBuy').disabled = p.stock === 'out';
    $('pmWhatsapp').href = waLink(productWaText(p));
    setReviewStars(0); $('reviewForm').reset();
    renderReviews(p);
    addRecentlyViewed(id);
    showEl($('productModal'));
    $('closeProduct').focus();
  }
  function closeProduct() {
    if ($('productModal').hidden) { return; }
    hideEl($('productModal')); restoreFocus();
  }
  function modalQty() { return clamp(parseInt($('pmQty').value, 10) || 1, 1, CONFIG.MAX_QTY); }

  function submitReview(e) {
    e.preventDefault();
    var p = getProduct(state.currentId), name = val('reviewName'), text = val('reviewText');
    if (!p) { return; }
    if (!state.reviewRating) { toast('Please choose a star rating.', 'error'); return; }
    if (name.length < 2 || text.length < 5) { toast('Please enter your name and a short review.', 'error'); return; }
    var list = state.reviews[p.id] || [];
    list.push({ name: name, rating: state.reviewRating, text: text, date: new Date().toISOString().slice(0, 10) });
    state.reviews[p.id] = list; store.set(KEYS.reviews, state.reviews);
    e.target.reset(); setReviewStars(0);
    renderReviews(p);
    $('pmStars').textContent = stars(getRating(p).avg);
    $('pmRatingText').textContent = getRating(p).avg.toFixed(1) + ' (' + getRating(p).count + ' reviews)';
    renderAll();
    toast('Thank you for your review.');
  }

  /* ==========================================================
     10. APPOINTMENTS
     ========================================================== */
  function label12(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h % 12 || 12) + ':' + pad(m) + ' ' + (h >= 12 ? 'PM' : 'AM');
  }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDate(iso) {
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function populateTimes() {
    var html = '<option value="">Select time</option>';
    for (var m = CONFIG.OPEN_MINUTES; m < CONFIG.CLOSE_MINUTES; m += CONFIG.SLOT_STEP) { html += '<option value="' + pad(Math.floor(m / 60)) + ':' + pad(m % 60) + '">' + label12(m) + '</option>'; }
    $('apTime').innerHTML = html;
    $('apDate').min = todayIso();
  }
  function refreshTimeOptions() {
    var now = new Date(), isToday = $('apDate').value === todayIso(), nowMin = now.getHours() * 60 + now.getMinutes();
    qsa('#apTime option').forEach(function (o) {
      if (!o.value) { return; }
      var parts = o.value.split(':'), mins = Number(parts[0]) * 60 + Number(parts[1]);
      o.disabled = isToday && mins <= nowMin;
    });
    if ($('apTime').selectedOptions[0] && $('apTime').selectedOptions[0].disabled) { $('apTime').value = ''; }
  }

  function submitAppointment(e) {
    e.preventDefault();
    var ok = validate([
      ['apName', V.name], ['apPhone', V.phone], ['apEmail', V.email],
      ['apDate', function (v) {
        if (!v) { return 'Please choose a date.'; }
        return v < todayIso() ? 'Please choose today or a future date.' : '';
      }],
      ['apTime', function (v) {
        if (!v) { return 'Please choose a time.'; }
        var p = v.split(':'), mins = Number(p[0]) * 60 + Number(p[1]);
        if (mins < CONFIG.OPEN_MINUTES || mins >= CONFIG.CLOSE_MINUTES) { return 'Appointments are available 6:00 PM \u2013 9:00 PM only.'; }
        var now = new Date();
        if ($('apDate').value === todayIso() && mins <= now.getHours() * 60 + now.getMinutes()) { return 'That time has already passed today.'; }
        return '';
      }],
      ['apPurpose', V.need('Please select the purpose of your appointment.')]
    ]);
    if (!ok) { return; }
    var payload = { name: val('apName'), phone: val('apPhone'), email: val('apEmail'), date: val('apDate'), time: val('apTime'), purpose: val('apPurpose'), location: val('apLocation'), message: val('apMessage') };
    var list = store.get(KEYS.appts, []); list.push(Object.assign({ createdAt: new Date().toISOString() }, payload)); store.set(KEYS.appts, list.slice(-20));
    var when = fmtDate(payload.date) + ' at ' + label12(Number(payload.time.split(':')[0]) * 60 + Number(payload.time.split(':')[1]));
    var details = '<p><strong>Name:</strong> ' + esc(payload.name) + '</p><p><strong>Phone:</strong> ' + esc(payload.phone) + '</p><p><strong>When:</strong> ' + esc(when) + '</p><p><strong>Purpose:</strong> ' + esc(payload.purpose) + '</p>' + (payload.location ? '<p><strong>Location:</strong> ' + esc(payload.location) + '</p>' : '');
    var waText = 'Hello Ready Home Appliances, I would like to confirm my appointment: ' + payload.purpose + ' on ' + when + '. Name: ' + payload.name + ', Phone: ' + payload.phone + '.';
    var btn = e.target.querySelector('button[type="submit"]'), old = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending...';
    apiPost('/api/appointments', payload).then(function (r) {
      btn.disabled = false; btn.textContent = old;
      if (r.ok) {
        showResult($('appointmentResult'), '<h3>Appointment Request Received</h3>' + details + '<p>We will contact you to confirm.</p>');
        toast('Appointment booked successfully.');
        e.target.reset(); refreshTimeOptions();
      } else {
        showResult($('appointmentResult'), '<h3>Appointment saved on this device</h3>' + details + '<p>' + esc(failText(r)) + '</p><p><a href="' + waLink(waText) + '" target="_blank" rel="noopener">Confirm on WhatsApp</a></p>', true);
        toast(r.offline ? 'Online services are unavailable.' : 'Appointment could not be sent.', 'error');
      }
    });
  }

  /* ==========================================================
     11. CONTACT FORM
     ========================================================== */
  function submitContact(e) {
    e.preventDefault();
    var ok = validate([['ctName', V.name], ['ctPhone', V.phone], ['ctEmail', V.email], ['ctMessage', function (v) { return v.trim().length >= 5 ? '' : 'Please enter your message.'; }]]);
    if (!ok) { return; }
    var payload = { name: val('ctName'), phone: val('ctPhone'), email: val('ctEmail'), message: $('ctMessage').value.trim().slice(0, 1000) };
    var btn = e.target.querySelector('button[type="submit"]'), old = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending...';
    apiPost('/api/contact', payload).then(function (r) {
      btn.disabled = false; btn.textContent = old;
      if (r.ok) {
        showResult($('contactResult'), 'Message sent successfully. We will get back to you soon.');
        toast('Message sent successfully.');
        e.target.reset();
      } else {
        var wa = waLink('Hello Ready Home Appliances, ' + payload.message);
        showResult($('contactResult'), esc(failText(r)) + ' <a href="' + wa + '" target="_blank" rel="noopener">Message us on WhatsApp</a>', true);
        toast(r.offline ? 'Online services are unavailable.' : 'Message could not be sent.', 'error');
      }
    });
  }

  /* ==========================================================
     12. CHATBOT (rule-based, no AI)
     ========================================================== */
  var WA_HELP = waLink('Hello Ready Home Appliances, I need some help.');
  var INTENTS = [
    { key: 'whatsapp', kw: ['whatsapp', 'wa.me'], reply: 'You can chat with us on WhatsApp: <a href="' + WA_HELP + '" target="_blank" rel="noopener">+233591922237</a>.' },
    { key: 'appointment', kw: ['appointment', 'book', 'booking', 'visit'], reply: 'Yes, you can book an appointment. Use the <a href="#appointment">Book an Appointment</a> form. Appointments are available Monday to Sunday, 6:00 PM to 9:00 PM.' },
    { key: 'order', kw: ['order', 'buy', 'purchase', 'checkout', 'how do i'], reply: 'To order: 1) Tap Add To Cart or Buy Now on a product. 2) Open the cart and press Checkout. 3) Enter your delivery details and press Place Order, or send the order on WhatsApp.' },
    { key: 'hours', kw: ['open', 'hour', 'time', 'close', 'closing', 'monday', 'sunday', 'when'], reply: 'We are available Monday to Sunday from 6:00 PM to 9:00 PM.' },
    { key: 'location', kw: ['where', 'locat', 'address', 'tantra', 'snnit', 'direction'], reply: 'Ready Home Appliances is located at Tantra Hills, opposite the SNNIT Flat.' },
    { key: 'contact', kw: ['contact', 'call', 'phone', 'email', 'number'], reply: 'You can call us on <a href="tel:' + CONFIG.PHONE + '">' + CONFIG.PHONE + '</a>, email ' + CONFIG.EMAIL + ', or use the <a href="#contact">contact form</a>.' },
    { key: 'delivery', kw: ['deliver', 'shipping', 'dispatch'], reply: 'Delivery details are confirmed when you place your order. Please enter your location at checkout or ask us on <a href="' + WA_HELP + '" target="_blank" rel="noopener">WhatsApp</a>.' },
    { key: 'fridge', kw: ['fridge', 'refrigerator', 'freezer'], reply: 'Yes, we have refrigerators and freezers. Use Search and type "fridge" or "freezer" to see the current models and prices.' },
    { key: 'tv', kw: ['tv', 'television'], reply: 'Yes, we have televisions. Use Search and type "television" to see the current models and prices.' },
    { key: 'products', kw: ['product', 'sell', 'appliance', 'catalog', 'stock'], reply: 'We sell refrigerators, freezers, washing machines, TVs, fans, ceiling fans, air conditioners, cookers, microwaves, blenders, kettles, irons, air fryers, sound systems, water dispensers and more. Browse <a href="#categories">Categories</a> or use Search.' },
    { key: 'greeting', kw: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'], reply: 'Hello! I am Ready Assistant. Ask me about our products, location, opening hours, appointments or how to order.' }
  ];
  var CHAT_FALLBACK = 'I am not sure about that. Please ask us on <a href="' + WA_HELP + '" target="_blank" rel="noopener">WhatsApp</a> or call ' + CONFIG.PHONE + '.';

  function addMsg(html, who) {
    var m = document.createElement('div');
    m.className = 'msg ' + who;
    m.innerHTML = html;
    $('chatMessages').appendChild(m);
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  }
  function kwHit(text, kw) { return kw.length <= 3 ? new RegExp('\\b' + kw + '\\b').test(text) : text.indexOf(kw) !== -1; }
  function findIntent(text) {
    var t = text.toLowerCase(), best = null, bestScore = 0;
    INTENTS.forEach(function (it) {
      var score = it.kw.filter(function (k) { return kwHit(t, k); }).length;
      if (score > bestScore) { best = it; bestScore = score; }
    });
    return best;
  }
  function botReply(html) { setTimeout(function () { addMsg(html, 'bot'); }, 350); }
  function askChat(text, forcedKey) {
    if (!text.trim()) { return; }
    addMsg(esc(text), 'user');
    var it = forcedKey ? INTENTS.filter(function (x) { return x.key === forcedKey; })[0] : findIntent(text);
    botReply(it ? it.reply : CHAT_FALLBACK);
  }
  function openChat() {
    $('chatWindow').hidden = false; $('chatFab').hidden = true;
    if (!state.chatStarted) { state.chatStarted = true; addMsg('Hello! I am Ready Assistant. How can I help you today?', 'bot'); }
    $('chatInput').focus();
  }
  function closeChat() { $('chatWindow').hidden = true; $('chatFab').hidden = false; }

  /* ==========================================================
     13. THEME + BRIGHTNESS
     ========================================================== */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    $('themeToggle').innerHTML = t === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    $('lightBtn').classList.toggle('active', t === 'light');
    $('darkBtn').classList.toggle('active', t === 'dark');
    store.set(KEYS.theme, t);
  }
  function applyBrightness(v) {
    v = clamp(Math.round(v * 10) / 10, 0.7, 1.3);
    document.documentElement.style.setProperty('--brightness', v);
    $('brightnessValue').textContent = Math.round(v * 100) + '%';
    store.set(KEYS.brightness, v);
    return v;
  }
  var brightness = 1;

  /* ==========================================================
     14. FLASH DEAL COUNTDOWN
     ========================================================== */
  function initCountdown() {
    var end = Number(store.get(KEYS.flash, 0));
    function reset() { end = Date.now() + CONFIG.FLASH_HOURS * 3600000; store.set(KEYS.flash, end); }
    if (!end || end <= Date.now()) { reset(); }
    function tick() {
      var left = end - Date.now();
      if (left <= 0) { reset(); left = end - Date.now(); }
      var s = Math.floor(left / 1000);
      $('countdown').textContent = pad(Math.floor(s / 3600)) + ' : ' + pad(Math.floor((s % 3600) / 60)) + ' : ' + pad(s % 60);
    }
    tick(); setInterval(tick, 1000);
  }

  /* ==========================================================
     15. EVENTS + INIT
     ========================================================== */
  function handleAction(el) {
    var a = el.dataset.action, id = Number(el.dataset.id);
    if (!$('searchOverlay').hidden && search.term && (a === 'add' || a === 'buy' || a === 'open' || a === 'fav')) { addRecentSearch(search.term); }
    switch (a) {
      case 'open': openProduct(id); break;
      case 'fav': toggleFav(id); break;
      case 'add': addToCart(id, 1); break;
      case 'buy': openCheckout([{ id: id, qty: 1 }], false); break;
      case 'inc': changeQty(id, 1); break;
      case 'dec': changeQty(id, -1); break;
      case 'remove': removeFromCart(id); break;
      case 'sum-inc': changeSummaryQty(id, 1); break;
      case 'sum-dec': changeSummaryQty(id, -1); break;
      case 'category': applyCategory(el.dataset.cat); break;
      case 'chip':
        search.term = el.dataset.term; $('searchInput').value = search.term; renderSearch(); addRecentSearch(search.term); break;
      default: break;
    }
  }

  function closeMenu() {
    $('navLinks').classList.remove('open');
    $('hamburger').setAttribute('aria-expanded', 'false');
    $('hamburger').innerHTML = '<i class="fa-solid fa-bars"></i>';
  }

  function updateScrollUI() {
    $('backToTop').hidden = window.scrollY < 600;
    var order = ['home', 'categories', 'deals', 'products', 'about', 'appointment', 'contact'], current = 'home';
    order.forEach(function (id) { var el = $(id); if (el && el.getBoundingClientRect().top <= 160) { current = id; } });
    qsa('.nav-item[data-nav]').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === current); });
  }

  function bindEvents() {
    /* global click delegation */
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (el) { handleAction(el); }
      if (!$('settingsPanel').hidden && !e.target.closest('#settingsPanel') && !e.target.closest('#settingsBtn')) { $('settingsPanel').hidden = true; }
      if (e.target === $('searchOverlay')) { closeSearch(); }
      if (e.target === $('productModal')) { closeProduct(); }
      if (e.target === $('checkoutModal')) { closeCheckout(); }
    });
    document.addEventListener('input', function (e) { if (e.target.classList && e.target.classList.contains('invalid')) { setError(e.target.id, ''); } });
    document.addEventListener('error', function (e) {
      if (e.target && e.target.tagName === 'IMG' && !e.target.dataset.fallback) { e.target.dataset.fallback = '1'; e.target.src = PLACEHOLDER; }
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') { return; }
      if (!$('searchOverlay').hidden) { closeSearch(); }
      else if (!$('productModal').hidden) { closeProduct(); }
      else if (!$('checkoutModal').hidden) { closeCheckout(); }
      else if ($('cartDrawer').classList.contains('open')) { closeCart(); }
      else if (!$('settingsPanel').hidden) { $('settingsPanel').hidden = true; }
      else if (!$('chatWindow').hidden) { closeChat(); }
      else { closeMenu(); }
    });

    /* navbar */
    $('hamburger').addEventListener('click', function () {
      var open = $('navLinks').classList.toggle('open');
      this.setAttribute('aria-expanded', String(open));
      this.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });
    $('navLinks').addEventListener('click', function (e) { if (e.target.closest('a')) { closeMenu(); } });
    $('navSearchBtn').addEventListener('click', function () { closeMenu(); openSearch(); });
    $('bnSearch').addEventListener('click', openSearch);
    $('bnCart').addEventListener('click', openCart);
    $('cartBtn').addEventListener('click', openCart);
    $('favoritesBtn').addEventListener('click', function () { $('favorites').scrollIntoView({ behavior: 'smooth' }); });
    $('accountBtn').addEventListener('click', function () { toast('Sign-in accounts are not set up yet. Your cart and favorites are saved on this device.', 'error'); });
    $('themeToggle').addEventListener('click', function () { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });

    /* settings */
    $('settingsBtn').addEventListener('click', function () { $('settingsPanel').hidden = !$('settingsPanel').hidden; });
    $('closeSettings').addEventListener('click', function () { $('settingsPanel').hidden = true; });
    $('lightBtn').addEventListener('click', function () { applyTheme('light'); });
    $('darkBtn').addEventListener('click', function () { applyTheme('dark'); });
    $('brightUp').addEventListener('click', function () { brightness = applyBrightness(brightness + 0.1); });
    $('brightDown').addEventListener('click', function () { brightness = applyBrightness(brightness - 0.1); });
    $('brightReset').addEventListener('click', function () { brightness = applyBrightness(1); });

    /* search */
    $('searchInput').addEventListener('input', function () { search.term = this.value; renderSearch(); });
    $('searchInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { addRecentSearch(search.term); renderSuggestions(); } });
    $('searchCategory').addEventListener('change', function () { search.category = this.value; renderSearch(); });
    $('searchPrice').addEventListener('change', function () { search.price = this.value; renderSearch(); });
    $('searchSort').addEventListener('change', function () { search.sort = this.value; renderSearch(); });
    $('clearSearch').addEventListener('click', clearSearchAll);
    $('closeSearch').addEventListener('click', closeSearch);

    /* shop filters */
    var refilter = function () { state.visible = CONFIG.PAGE_SIZE; renderCategories(); renderProducts(); };
    $('filterCategory').addEventListener('change', function () { state.filters.category = this.value; refilter(); });
    $('filterBrand').addEventListener('change', function () { state.filters.brand = this.value; refilter(); });
    $('filterMin').addEventListener('input', debounce(function () { state.filters.min = $('filterMin').value; refilter(); }, 250));
    $('filterMax').addEventListener('input', debounce(function () { state.filters.max = $('filterMax').value; refilter(); }, 250));
    $('filterRating').addEventListener('change', function () { state.filters.rating = Number(this.value); refilter(); });
    $('filterStock').addEventListener('change', function () { state.filters.stock = this.value; refilter(); });
    $('sortSelect').addEventListener('change', function () { state.filters.sort = this.value; refilter(); });
    $('resetFilters').addEventListener('click', resetProductFilters);
    $('filterToggle').addEventListener('click', function () { $('filters').classList.toggle('open'); });
    $('loadMore').addEventListener('click', function () { state.visible += CONFIG.PAGE_SIZE; renderProducts(); });
    qsa('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        qsa('.tab').forEach(function (t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
        state.filters.collection = tab.dataset.collection; refilter();
      });
    });

    /* cart */
    $('closeCart').addEventListener('click', closeCart);
    $('cartOverlay').addEventListener('click', closeCart);
    $('clearCart').addEventListener('click', function () {
      if (!state.cart.length) { toast('Your cart is already empty.', 'error'); return; }
      state.cart = []; saveCart(); renderCart(); toast('Cart cleared.', 'error');
    });
    $('checkoutBtn').addEventListener('click', function () { openCheckout(null, true); });

    /* checkout */
    $('closeCheckout').addEventListener('click', closeCheckout);
    $('checkoutForm').addEventListener('submit', submitOrder);
    $('coWhatsapp').addEventListener('click', function () {
      if (!checkoutItems().length) { toast('Your cart is empty.', 'error'); return; }
      window.open(waLink(orderMessage()), '_blank', 'noopener');
    });

    /* product modal */
    $('closeProduct').addEventListener('click', closeProduct);
    $('pmMinus').addEventListener('click', function () { $('pmQty').value = clamp(modalQty() - 1, 1, CONFIG.MAX_QTY); });
    $('pmPlus').addEventListener('click', function () { $('pmQty').value = clamp(modalQty() + 1, 1, CONFIG.MAX_QTY); });
    $('pmQty').addEventListener('change', function () { this.value = modalQty(); });
    $('pmAdd').addEventListener('click', function () { addToCart(state.currentId, modalQty()); });
    $('pmBuy').addEventListener('click', function () { openCheckout([{ id: state.currentId, qty: modalQty() }], false); });
    $('starInput').addEventListener('click', function (e) { var b = e.target.closest('button[data-star]'); if (b) { setReviewStars(Number(b.dataset.star)); } });
    $('reviewForm').addEventListener('submit', submitReview);

    /* forms */
    $('appointmentForm').addEventListener('submit', submitAppointment);
    $('apDate').addEventListener('change', refreshTimeOptions);
    $('contactForm').addEventListener('submit', submitContact);

    /* chat */
    $('chatFab').addEventListener('click', openChat);
    $('closeChat').addEventListener('click', closeChat);
    $('chatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('chatInput').value; $('chatInput').value = '';
      askChat(v);
    });
    $('quickQuestions').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-q]');
      if (b) { askChat(b.textContent, b.dataset.q); }
    });

    /* scroll */
    $('backToTop').addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) { return; }
      ticking = true;
      requestAnimationFrame(function () { updateScrollUI(); ticking = false; });
    }, { passive: true });
  }

  function hideLoader() {
    var l = $('loader');
    if (!l || l.classList.contains('done')) { return; }
    l.classList.add('done');
    setTimeout(function () { if (l.parentNode) { l.parentNode.removeChild(l); } }, 800);
  }

  function init() {
    var started = Date.now();
    var finishLoader = function () { setTimeout(hideLoader, Math.max(0, 1400 - (Date.now() - started))); };
    if (document.readyState === 'complete') { finishLoader(); } else { window.addEventListener('load', finishLoader); }
    setTimeout(hideLoader, 5000);

    brightness = applyBrightness(Number(store.get(KEYS.brightness, 1)) || 1);
    applyTheme(store.get(KEYS.theme, 'light') === 'dark' ? 'dark' : 'light');
    populateSelects(); populateTimes();
    $('cartDrawer').inert = true;
    $('productGrid').innerHTML = '<div class="skeleton"></div>'.repeat(8);
    $('flashDeals').innerHTML = '<div class="skeleton"></div>'.repeat(4);
    bindEvents();
    renderCart(); updateFavCount(); initCountdown(); updateScrollUI();
    setTimeout(renderAll, 600);
  }

  init();
})();