/* ============================================================
   BOLIVAR COFFEE — Admin Dashboard SPA
   Uses fetch API with JWT auth from localStorage.
   ============================================================ */
(function () {
  "use strict";

  var TOKEN_KEY = 'bolivar_token';
  var USER_KEY = 'bolivar_user';
  var currentUser = null;
  var currentPage = 'dashboard';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  async function apiFetch(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (getToken()) opts.headers['Authorization'] = 'Bearer ' + getToken();
    if (!opts.headers['Content-Type'] && opts.body && typeof opts.body === 'object') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    var res = await fetch(url, opts);
    if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); window.location.href = 'login.html'; return; }
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function checkAuth() {
    if (!getToken()) { window.location.href = 'login.html'; return false; }
    try {
      var user = await apiFetch('/api/auth/me');
      currentUser = user;
      return true;
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = 'login.html';
      return false;
    }
  }

  function navigate(page) {
    currentPage = page || 'dashboard';
    window.location.hash = currentPage;
    $$('.sidebar__link[data-page]').forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('data-page') === currentPage); });
    var titleEl = $('#topbarTitle');
    var titles = { dashboard: 'Dashboard', menu: 'Menu', orders: 'Orders', reviews: 'Reviews', gallery: 'Gallery', settings: 'Settings' };
    if (titleEl) titleEl.textContent = titles[currentPage] || 'Dashboard';
    $('#sidebar').classList.remove('is-open');
    loadPage(currentPage);
  }

  async function loadPage(page) {
    var main = $('#mainContent');
    main.innerHTML = '<div class="page-loading"><div class="spinner"></div><p>Loading...</p></div>';
    try {
      if (page === 'dashboard') await renderDashboard(main);
      else if (page === 'menu') await renderMenu(main);
      else if (page === 'orders') await renderOrders(main);
      else if (page === 'reviews') await renderReviews(main);
      else if (page === 'gallery') await renderGallery(main);
      else if (page === 'settings') await renderSettings(main);
    } catch (err) {
      console.error(err);
      main.innerHTML = '<div class="empty-state"><p>Error: ' + err.message + '</p></div>';
    }
  }

  /* ============ DASHBOARD ============ */
  async function renderDashboard(c) {
    var s = await apiFetch('/api/dashboard');
    var html = '<div class="dash-header"><h1>Dashboard</h1><p>Welcome, ' + (currentUser.full_name || currentUser.email) + '</p></div>';
    html += '<div class="stats-grid">';
    html += '<div class="stat-card stat-card--accent"><span class="stat-card__label">Today\'s Revenue</span><span class="stat-card__value">' + s.today_revenue.toFixed(3) + ' DT</span><span class="stat-card__detail">' + s.today_orders + ' orders today</span></div>';
    html += '<div class="stat-card"><span class="stat-card__label">Total Orders</span><span class="stat-card__value">' + s.total_orders + '</span><span class="stat-card__detail">' + s.total_revenue.toFixed(3) + ' DT total</span></div>';
    html += '<div class="stat-card stat-card--warning"><span class="stat-card__label">Pending</span><span class="stat-card__value">' + s.pending_count + '</span><span class="stat-card__detail">Needs attention</span></div>';
    html += '<div class="stat-card stat-card--info"><span class="stat-card__label">Menu Items</span><span class="stat-card__value">' + s.menu_item_count + '</span><span class="stat-card__detail">Active products</span></div>';
    html += '</div>';

    // Revenue chart
    if (s.daily_revenue.length) {
      html += '<div class="table-wrap mb-2"><div class="table-header"><h2>Revenue (Last 30 Days)</h2></div><div style="padding:1.5rem;">';
      var maxR = Math.max(...s.daily_revenue.map(r => r.revenue || 1));
      s.daily_revenue.slice(0, 14).reverse().forEach(function (r) {
        var pct = (r.revenue / maxR * 100);
        var day = new Date(r.day).toLocaleDateString('en', { month: 'short', day: 'numeric' });
        html += '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem;">';
        html += '<span style="min-width:65px;font-size:.8rem;color:var(--muted);">' + day + '</span>';
        html += '<div style="flex:1;height:22px;background:var(--border);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:4px;"></div></div>';
        html += '<span style="min-width:65px;text-align:right;font-size:.8rem;font-weight:600;">' + r.revenue.toFixed(3) + '</span>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    // Recent orders
    html += '<div class="table-wrap"><div class="table-header"><h2>Recent Orders</h2></div><div class="table-responsive"><table><thead><tr><th>#</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Time</th></tr></thead><tbody>';
    if (s.recent_orders.length) {
      s.recent_orders.forEach(function (o) {
        var items = (o.order_items || []).map(function (i) { return i.menu_item_name; }).join(', ');
        var time = new Date(o.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
        html += '<tr class="order-row" data-id="' + o.id + '" style="cursor:pointer;"><td><strong>#' + o.order_number + '</strong></td><td>' + o.customer_name + '<br><span class="text-muted text-sm">' + o.customer_phone + '</span></td><td class="text-sm">' + items + '</td><td><strong>' + o.total.toFixed(3) + ' DT</strong></td><td><span class="badge badge--' + o.status + '">' + o.status + '</span></td><td class="text-muted text-sm">' + time + '</td></tr>';
      });
    } else {
      html += '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No orders yet</td></tr>';
    }
    html += '</tbody></table></div></div>';
    c.innerHTML = html;
    $$('.order-row', c).forEach(function (row) { row.addEventListener('click', function () { showOrderDetail(row.getAttribute('data-id')); }); });
  }

  /* ============ MENU ============ */
  async function renderMenu(c) {
    var cats = await apiFetch('/api/categories');
    var items = await apiFetch('/api/menu');
    var html = '<div class="dash-header flex-between"><div><h1>Menu</h1><p>' + items.length + ' items</p></div><button class="btn btn--primary" id="addItemBtn">+ Add Item</button></div>';
    html += '<div class="table-wrap"><div class="table-header"><div class="filters">';
    html += '<button class="filter-btn is-active" data-filter="all">All</button>';
    cats.forEach(function (cat) { html += '<button class="filter-btn" data-filter="' + cat.slug + '">' + cat.name + '</button>'; });
    html += '</div><input type="text" class="search-input" placeholder="Search..." id="menuSearch"></div>';
    html += '<div class="table-responsive"><table><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Available</th><th>Featured</th><th>Actions</th></tr></thead><tbody id="menuTableBody">';
    items.forEach(function (item) {
      html += '<tr data-cat="' + (item.category_slug || '') + '" data-name="' + (item.name || '').toLowerCase() + '">';
      html += '<td><div class="flex gap-1" style="align-items:center;">';
      if (item.image_url) html += '<img src="' + item.image_url + '" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">';
      html += '<div><strong>' + item.name + '</strong>';
      if (item.description) html += '<br><span class="text-muted text-sm">' + item.description.substring(0, 40) + '...</span>';
      html += '</div></div></td>';
      html += '<td>' + (item.category_name || '') + '</td>';
      html += '<td><strong>' + item.price.toFixed(3) + ' DT</strong></td>';
      html += '<td><label class="toggle"><input type="checkbox" ' + (item.is_available ? 'checked' : '') + ' data-toggle="available" data-id="' + item.id + '"><span class="toggle__slider"></span></label></td>';
      html += '<td><label class="toggle"><input type="checkbox" ' + (item.is_featured ? 'checked' : '') + ' data-toggle="featured" data-id="' + item.id + '"><span class="toggle__slider"></span></label></td>';
      html += '<td><div class="flex gap-1"><button class="btn btn--ghost btn--sm" data-edit="' + item.id + '">Edit</button><button class="btn btn--danger btn--sm btn--icon" data-delete="' + item.id + '">✕</button></div></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
    c.innerHTML = html;

    // Filter
    $$('.filter-btn', c).forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.filter-btn', c).forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var f = btn.getAttribute('data-filter');
        $$('#menuTableBody tr', c).forEach(function (row) { row.style.display = (f === 'all' || row.getAttribute('data-cat') === f) ? '' : 'none'; });
      });
    });

    // Search
    var searchEl = $('#menuSearch', c);
    if (searchEl) searchEl.addEventListener('input', function () {
      var q = searchEl.value.toLowerCase();
      $$('#menuTableBody tr', c).forEach(function (row) { row.style.display = (row.getAttribute('data-name') || '').indexOf(q) > -1 ? '' : 'none'; });
    });

    // Toggles
    $$('[data-toggle]', c).forEach(function (t) {
      t.addEventListener('change', async function () {
        await apiFetch('/api/menu/' + t.getAttribute('data-id'), { method: 'PUT', body: { [t.getAttribute('data-toggle')]: t.checked } });
      });
    });

    // Edit
    $$('[data-edit]', c).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-edit'));
        var item = items.find(function (i) { return i.id === id; });
        if (item) showMenuModal(item, cats);
      });
    });

    // Delete
    $$('[data-delete]', c).forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Delete this item?')) return;
        await apiFetch('/api/menu/' + btn.getAttribute('data-delete'), { method: 'DELETE' });
        loadPage('menu');
      });
    });

    // Add
    var addBtn = $('#addItemBtn', c);
    if (addBtn) addBtn.addEventListener('click', function () { showMenuModal(null, cats); });
  }

  function showMenuModal(item, cats) {
    var isEdit = !!item;
    var container = $('#modalContainer');
    var html = '<div class="modal-overlay is-open"><div class="modal"><div class="modal__header"><h2>' + (isEdit ? 'Edit Item' : 'Add Item') + '</h2><button class="modal__close" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div>';
    html += '<div class="modal__body"><form id="menuForm">';
    html += '<div class="form-row"><div class="form-group"><label>Name *</label><input type="text" name="name" value="' + (isEdit ? item.name : '') + '" required></div>';
    html += '<div class="form-group"><label>Price (DT) *</label><input type="number" name="price" step="0.001" value="' + (isEdit ? item.price : '') + '" required></div></div>';
    html += '<div class="form-group"><label>Description</label><textarea name="description" rows="2">' + (isEdit ? (item.description || '') : '') + '</textarea></div>';
    html += '<div class="form-group"><label>Category</label><select name="category_id">';
    cats.forEach(function (cat) { html += '<option value="' + cat.id + '"' + (isEdit && item.category_id === cat.id ? ' selected' : '') + '>' + cat.name + '</option>'; });
    html += '</select></div>';
    html += '<div class="form-group"><label>Image URL</label><input type="url" name="image_url" value="' + (isEdit ? (item.image_url || '') : '') + '"></div>';
    html += '<div class="form-row"><div class="form-group"><label><input type="checkbox" name="is_available" ' + (!isEdit || item.is_available ? 'checked' : '') + '> Available</label></div>';
    html += '<div class="form-group"><label><input type="checkbox" name="is_featured" ' + (isEdit && item.is_featured ? 'checked' : '') + '> Featured</label></div></div>';
    html += '</form></div>';
    html += '<div class="modal__footer"><button class="btn btn--ghost" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>';
    html += '<button class="btn btn--primary" id="saveMenuItem">' + (isEdit ? 'Save' : 'Add') + '</button></div></div></div>';
    container.innerHTML = html;

    $('#saveMenuItem').addEventListener('click', async function () {
      var form = $('#menuForm');
      var fd = new FormData(form);
      var data = { name: fd.get('name'), price: parseFloat(fd.get('price')), description: fd.get('description') || '', category_id: parseInt(fd.get('category_id')), image_url: fd.get('image_url') || '', is_available: form.querySelector('[name="is_available"]').checked, is_featured: form.querySelector('[name="is_featured"]').checked };
      if (!data.name || !data.price) return alert('Name and price required');
      if (isEdit) await apiFetch('/api/menu/' + item.id, { method: 'PUT', body: data });
      else await apiFetch('/api/menu', { method: 'POST', body: data });
      container.innerHTML = '';
      loadPage('menu');
    });
  }

  /* ============ ORDERS ============ */
  var orderFilter = 'all';
  async function renderOrders(c) {
    var orders = await apiFetch('/api/orders?status=' + orderFilter);
    var html = '<div class="dash-header"><h1>Orders</h1><p>' + orders.length + ' orders</p></div>';
    html += '<div class="table-wrap"><div class="table-header"><div class="filters">';
    ['all', 'new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].forEach(function (f) {
      html += '<button class="filter-btn' + (orderFilter === f ? ' is-active' : '') + '" data-status="' + f + '">' + (f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)) + '</button>';
    });
    html += '</div></div><div class="table-responsive"><table><thead><tr><th>#</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>';
    orders.forEach(function (o) {
      var items = (o.order_items || []).map(function (i) { return i.quantity + 'x ' + i.menu_item_name; }).join(', ');
      var date = new Date(o.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      html += '<tr><td><strong>#' + o.order_number + '</strong></td><td>' + o.customer_name + '<br><span class="text-muted text-sm">' + o.customer_phone + '</span></td><td class="text-sm">' + items + '</td><td><strong>' + o.total.toFixed(3) + ' DT</strong></td><td><span class="badge badge--' + o.status + '">' + o.status + '</span></td><td class="text-muted text-sm">' + date + '</td><td><button class="btn btn--ghost btn--sm" data-view="' + o.id + '">View</button></td></tr>';
    });
    if (!orders.length) html += '<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">No orders</td></tr>';
    html += '</tbody></table></div></div>';
    c.innerHTML = html;

    $$('[data-status]', c).forEach(function (btn) {
      btn.addEventListener('click', function () { orderFilter = btn.getAttribute('data-status'); renderOrders(c); });
    });
    $$('[data-view]', c).forEach(function (btn) {
      btn.addEventListener('click', function () { showOrderDetail(btn.getAttribute('data-view')); });
    });
  }

  async function showOrderDetail(id) {
    var o = await apiFetch('/api/orders/' + id);
    var container = $('#modalContainer');
    var html = '<div class="modal-overlay is-open" id="orderModal"><div class="modal"><div class="modal__header"><h2>Order #' + o.order_number + '</h2><button class="modal__close" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div>';
    html += '<div class="modal__body">';
    html += '<div class="order-detail__section"><h4>Customer</h4>';
    html += '<div class="order-detail__row"><span>Name</span><span>' + o.customer_name + '</span></div>';
    html += '<div class="order-detail__row"><span>Phone</span><span>' + o.customer_phone + '</span></div>';
    if (o.notes) html += '<div class="order-detail__row"><span>Notes</span><span>' + o.notes + '</span></div>';
    html += '<div class="order-detail__row"><span>Date</span><span>' + new Date(o.created_at).toLocaleString() + '</span></div></div>';
    html += '<div class="order-detail__section"><h4>Items</h4>';
    (o.order_items || []).forEach(function (i) { html += '<div class="order-detail__row"><span>' + i.menu_item_name + ' × ' + i.quantity + '</span><span>' + i.subtotal.toFixed(3) + ' DT</span></div>'; });
    html += '<div class="order-detail__row total"><span>Total</span><span>' + o.total.toFixed(3) + ' DT</span></div></div>';
    html += '<div class="order-detail__section"><h4>Status</h4><div class="flex gap-1" style="flex-wrap:wrap;">';
    ['new', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].forEach(function (s) {
      html += '<button class="btn ' + (o.status === s ? 'btn--primary' : 'btn--ghost') + ' btn--sm status-btn" data-s="' + s + '">' + s.charAt(0).toUpperCase() + s.slice(1) + '</button>';
    });
    html += '</div></div></div>';
    html += '<div class="modal__footer"><button class="btn btn--ghost" onclick="this.closest(\'.modal-overlay\').remove()">Close</button></div></div></div>';
    container.innerHTML = html;

    $$('.status-btn', container).forEach(function (btn) {
      btn.addEventListener('click', async function () {
        await apiFetch('/api/orders/' + id, { method: 'PATCH', body: { status: btn.getAttribute('data-s') } });
        container.innerHTML = '';
        loadPage(currentPage);
      });
    });
  }

  /* ============ REVIEWS ============ */
  async function renderReviews(c) {
    var reviews = await apiFetch('/api/reviews');
    var html = '<div class="dash-header"><h1>Reviews</h1><p>' + reviews.length + ' reviews</p></div>';
    html += '<div class="table-wrap"><div class="table-responsive"><table><thead><tr><th>Author</th><th>Rating</th><th>Review</th><th>Source</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    reviews.forEach(function (r) {
      html += '<tr><td><strong>' + (r.author_name || 'Guest') + '</strong></td><td>' + '★'.repeat(r.rating) + '</td><td class="text-sm">' + (r.content || '').substring(0, 80) + (r.content.length > 80 ? '...' : '') + '</td><td>' + (r.source || '') + '</td><td><span class="badge badge--' + (r.is_approved ? 'approved' : 'pending') + '">' + (r.is_approved ? 'Approved' : 'Pending') + '</span></td><td><div class="flex gap-1">';
      if (!r.is_approved) html += '<button class="btn btn--success btn--sm" data-approve="' + r.id + '">Approve</button>';
      else html += '<button class="btn btn--ghost btn--sm" data-hide="' + r.id + '">Hide</button>';
      html += '<button class="btn btn--danger btn--sm btn--icon" data-del="' + r.id + '">✕</button>';
      html += '</div></td></tr>';
    });
    if (!reviews.length) html += '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">No reviews</td></tr>';
    html += '</tbody></table></div></div>';
    c.innerHTML = html;

    $$('[data-approve]', c).forEach(function (btn) { btn.addEventListener('click', async function () { await apiFetch('/api/reviews/' + btn.getAttribute('data-approve'), { method: 'PUT', body: { is_approved: true } }); loadPage('reviews'); }); });
    $$('[data-hide]', c).forEach(function (btn) { btn.addEventListener('click', async function () { await apiFetch('/api/reviews/' + btn.getAttribute('data-hide'), { method: 'PUT', body: { is_approved: false } }); loadPage('reviews'); }); });
    $$('[data-del]', c).forEach(function (btn) { btn.addEventListener('click', async function () { if (!confirm('Delete?')) return; await apiFetch('/api/reviews/' + btn.getAttribute('data-del'), { method: 'DELETE' }); loadPage('reviews'); }); });
  }

  /* ============ GALLERY ============ */
  async function renderGallery(c) {
    var images = await apiFetch('/api/gallery');
    var html = '<div class="dash-header flex-between"><div><h1>Gallery</h1><p>' + images.length + ' images</p></div><button class="btn btn--primary" id="addImgBtn">+ Add Image</button></div>';
    html += '<div class="image-grid">';
    images.forEach(function (img) {
      html += '<div class="image-card"><img src="' + img.url + '" alt="' + (img.alt || '') + '"><div class="image-card__overlay">';
      if (img.caption) html += '<span style="color:#fff;font-size:.8rem;">' + img.caption + '</span>';
      html += '<button class="btn btn--danger btn--sm btn--icon" data-del="' + img.id + '">✕</button></div></div>';
    });
    html += '</div>';
    if (!images.length) html += '<div class="empty-state"><p>No images yet.</p></div>';
    c.innerHTML = html;

    $$('[data-del]', c).forEach(function (btn) { btn.addEventListener('click', async function () { if (!confirm('Delete?')) return; await apiFetch('/api/gallery/' + btn.getAttribute('data-del'), { method: 'DELETE' }); loadPage('gallery'); }); });
    var addBtn = $('#addImgBtn', c);
    if (addBtn) addBtn.addEventListener('click', function () {
      var mc = $('#modalContainer');
      mc.innerHTML = '<div class="modal-overlay is-open"><div class="modal"><div class="modal__header"><h2>Add Image</h2><button class="modal__close" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div><div class="modal__body"><form id="galForm"><div class="form-group"><label>Image URL *</label><input type="url" name="url" required></div><div class="form-group"><label>Alt Text</label><input type="text" name="alt"></div><div class="form-group"><label>Caption</label><input type="text" name="caption"></div></form></div><div class="modal__footer"><button class="btn btn--ghost" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button><button class="btn btn--primary" id="saveGalImg">Add</button></div></div></div>';
      $('#saveGalImg').addEventListener('click', async function () {
        var fd = new FormData($('#galForm'));
        await apiFetch('/api/gallery', { method: 'POST', body: { url: fd.get('url'), alt: fd.get('alt') || '', caption: fd.get('caption') || '' } });
        mc.innerHTML = '';
        loadPage('gallery');
      });
    });
  }

  /* ============ SETTINGS ============ */
  async function renderSettings(c) {
    var settings = await apiFetch('/api/settings');
    var fields = [
      ['business_name', 'Business Name'], ['phone', 'Phone'], ['phone_raw', 'Phone (raw, no spaces)'],
      ['address', 'Address'], ['opening_hours', 'Opening Hours'],
      ['instagram', 'Instagram URL'], ['instagram_handle', 'Instagram Handle'],
      ['glovo_url', 'Glovo URL'], ['google_rating', 'Google Rating'], ['google_review_count', 'Google Reviews'],
    ];
    var html = '<div class="dash-header"><h1>Settings</h1><p>Edit your business information.</p></div>';
    html += '<div class="table-wrap" style="max-width:700px;"><div class="table-header"><h2>General</h2></div><div style="padding:1.5rem;"><form id="settingsForm">';
    fields.forEach(function (f) { html += '<div class="form-group"><label>' + f[1] + '</label><input type="text" name="' + f[0] + '" value="' + (settings[f[0]] || '') + '"></div>'; });
    html += '<button type="submit" class="btn btn--primary mt-2" id="saveSettings">Save Settings</button></form></div></div>';
    c.innerHTML = html;

    $('#settingsForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var data = {};
      fd.forEach(function (v, k) { data[k] = v; });
      var btn = $('#saveSettings');
      btn.disabled = true; btn.textContent = 'Saving...';
      await apiFetch('/api/settings', { method: 'PUT', body: data });
      btn.textContent = 'Saved ✓';
      setTimeout(function () { btn.disabled = false; btn.textContent = 'Save Settings'; }, 2000);
    });
  }

  /* ============ INIT ============ */
  async function init() {
    var authed = await checkAuth();
    if (!authed) return;

    $$('.sidebar__link[data-page]').forEach(function (l) {
      l.addEventListener('click', function (e) { e.preventDefault(); navigate(l.getAttribute('data-page')); });
    });

    var menuToggle = $('#menuToggle');
    if (menuToggle) menuToggle.addEventListener('click', function () { $('#sidebar').classList.toggle('is-open'); });

    var logoutBtn = $('#logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = 'login.html';
    });

    var hash = window.location.hash.replace('#', '') || 'dashboard';
    navigate(hash);
    window.addEventListener('hashchange', function () {
      var p = window.location.hash.replace('#', '') || 'dashboard';
      if (p !== currentPage) navigate(p);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
