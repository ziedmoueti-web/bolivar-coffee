/* ============================================================
   BOLIVAR COFFEE — Admin Dashboard (Production)
   Uses Express REST API with JWT auth. XSS-safe rendering.
   ============================================================ */
(function () {
  "use strict";

  var TOKEN_KEY = 'bolivar_token';
  var currentUser = null;
  var currentPage = 'dashboard';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

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
    if (res.status === 403) { localStorage.removeItem(TOKEN_KEY); window.location.href = 'login.html'; return; }
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
    var titles = { dashboard: 'Dashboard', menu: 'Menu', reviews: 'Reviews', gallery: 'Gallery', settings: 'Settings' };
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
      else if (page === 'reviews') await renderReviews(main);
      else if (page === 'gallery') await renderGallery(main);
      else if (page === 'settings') await renderSettings(main);
    } catch (err) {
      console.error(err);
      main.innerHTML = '<div class="empty-state"><p>Error: ' + escapeHtml(err.message) + '</p></div>';
    }
  }

  /* ============ DASHBOARD ============ */
  async function renderDashboard(c) {
    var s = await apiFetch('/api/admin/dashboard');
    var html = '<div class="dash-header"><h1>Dashboard</h1><p>Welcome, ' + escapeHtml(currentUser.full_name || currentUser.email) + '</p></div>';
    html += '<div class="stats-grid">';
    html += '<div class="stat-card stat-card--accent"><span class="stat-card__label">Menu Items</span><span class="stat-card__value">' + (s.menu_item_count || 0) + '</span><span class="stat-card__detail">' + (s.available_item_count || 0) + ' available</span></div>';
    html += '<div class="stat-card stat-card--info"><span class="stat-card__label">Categories</span><span class="stat-card__value">' + (s.category_count || 0) + '</span><span class="stat-card__detail">Menu sections</span></div>';
    html += '<div class="stat-card stat-card--warning"><span class="stat-card__label">Pending Reviews</span><span class="stat-card__value">' + (s.pending_review_count || 0) + '</span><span class="stat-card__detail">' + (s.approved_review_count || 0) + ' approved</span></div>';
    html += '<div class="stat-card"><span class="stat-card__label">Gallery Images</span><span class="stat-card__value">' + (s.gallery_count || 0) + '</span><span class="stat-card__detail">Active photos</span></div>';
    html += '</div>';

    c.innerHTML = html;
  }

  /* ============ MENU ============ */
  async function renderMenu(c) {
    var cats = await apiFetch('/api/admin/categories');
    var items = await apiFetch('/api/admin/menu');
    var html = '<div class="dash-header flex-between"><div><h1>Menu</h1><p>' + items.length + ' items</p></div><button class="btn btn--primary" id="addItemBtn">+ Add Item</button></div>';
    html += '<div class="table-wrap"><div class="table-header"><div class="filters">';
    html += '<button class="filter-btn is-active" data-filter="all">All</button>';
    cats.forEach(function (cat) { html += '<button class="filter-btn" data-filter="' + escapeHtml(cat.slug) + '">' + escapeHtml(cat.name) + '</button>'; });
    html += '</div><input type="text" class="search-input" placeholder="Search..." id="menuSearch"></div>';
    html += '<div class="table-responsive"><table><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Available</th><th>Featured</th><th>Actions</th></tr></thead><tbody id="menuTableBody">';
    items.forEach(function (item) {
      html += '<tr data-cat="' + escapeHtml(item.category_slug) + '" data-name="' + escapeHtml((item.name || '').toLowerCase()) + '">';
      html += '<td><div class="flex gap-1" style="align-items:center;">';
      if (item.image_url) html += '<img src="' + escapeHtml(item.image_url) + '" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">';
      html += '<div><strong>' + escapeHtml(item.name) + '</strong>';
      if (item.description) html += '<br><span class="text-muted text-sm">' + escapeHtml(item.description.substring(0, 40)) + '...</span>';
      html += '</div></div></td>';
      html += '<td>' + escapeHtml(item.category_name) + '</td>';
      html += '<td><strong>' + Number(item.price).toFixed(3) + ' DT</strong></td>';
      html += '<td><label class="toggle"><input type="checkbox" ' + (item.is_available ? 'checked' : '') + ' data-toggle="is_available" data-id="' + escapeHtml(item.id) + '"><span class="toggle__slider"></span></label></td>';
      html += '<td><label class="toggle"><input type="checkbox" ' + (item.is_featured ? 'checked' : '') + ' data-toggle="is_featured" data-id="' + escapeHtml(item.id) + '"><span class="toggle__slider"></span></label></td>';
      html += '<td><div class="flex gap-1"><button class="btn btn--ghost btn--sm" data-edit="' + escapeHtml(item.id) + '">Edit</button><button class="btn btn--danger btn--sm btn--icon" data-delete="' + escapeHtml(item.id) + '">✕</button></div></td></tr>';
    });
    html += '</tbody></table></div></div>';
    c.innerHTML = html;

    $$('.filter-btn', c).forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.filter-btn', c).forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var f = btn.getAttribute('data-filter');
        $$('#menuTableBody tr', c).forEach(function (row) { row.style.display = (f === 'all' || row.getAttribute('data-cat') === f) ? '' : 'none'; });
      });
    });

    var searchEl = $('#menuSearch', c);
    if (searchEl) searchEl.addEventListener('input', function () {
      var q = searchEl.value.toLowerCase();
      $$('#menuTableBody tr', c).forEach(function (row) { row.style.display = (row.getAttribute('data-name') || '').indexOf(q) > -1 ? '' : 'none'; });
    });

    $$('[data-toggle]', c).forEach(function (t) {
      t.addEventListener('change', async function () {
        var field = t.getAttribute('data-toggle');
        var val = t.checked;
        await apiFetch('/api/admin/menu/' + t.getAttribute('data-id'), { method: 'PATCH', body: { [field]: val } });
      });
    });

    $$('[data-edit]', c).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-edit');
        var item = items.find(function (i) { return i.id === id; });
        if (item) showMenuModal(item, cats);
      });
    });

    $$('[data-delete]', c).forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Delete this item?')) return;
        await apiFetch('/api/admin/menu/' + btn.getAttribute('data-delete'), { method: 'DELETE' });
        loadPage('menu');
      });
    });

    var addBtn = $('#addItemBtn', c);
    if (addBtn) addBtn.addEventListener('click', function () { showMenuModal(null, cats); });
  }

  function showMenuModal(item, cats) {
    var isEdit = !!item;
    var mc = $('#modalContainer');
    var html = '<div class="modal-overlay is-open"><div class="modal"><div class="modal__header"><h2>' + (isEdit ? 'Edit Item' : 'Add Item') + '</h2><button class="modal__close" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div>';
    html += '<div class="modal__body"><form id="menuForm">';
    html += '<div class="form-row"><div class="form-group"><label>Name *</label><input type="text" name="name" value="' + escapeHtml(isEdit ? item.name : '') + '" required></div>';
    html += '<div class="form-group"><label>Price (DT) *</label><input type="number" name="price" step="0.001" value="' + escapeHtml(isEdit ? item.price : '') + '" required></div></div>';
    html += '<div class="form-group"><label>Description</label><textarea name="description" rows="2">' + escapeHtml(isEdit ? (item.description || '') : '') + '</textarea></div>';
    html += '<div class="form-group"><label>Category</label><select name="category_id">';
    cats.forEach(function (cat) { html += '<option value="' + escapeHtml(cat.id) + '"' + (isEdit && item.category_id === cat.id ? ' selected' : '') + '>' + escapeHtml(cat.name) + '</option>'; });
    html += '</select></div>';
    html += '<div class="form-group"><label>Image URL</label><input type="url" name="image_url" value="' + escapeHtml(isEdit ? (item.image_url || '') : '') + '"></div>';
    html += '<div class="form-row"><div class="form-group"><label><input type="checkbox" name="is_available" ' + (!isEdit || item.is_available ? 'checked' : '') + '> Available</label></div>';
    html += '<div class="form-group"><label><input type="checkbox" name="is_featured" ' + (isEdit && item.is_featured ? 'checked' : '') + '> Featured</label></div></div>';
    html += '</form></div>';
    html += '<div class="modal__footer"><button class="btn btn--ghost" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>';
    html += '<button class="btn btn--primary" id="saveMenuItem">' + (isEdit ? 'Save' : 'Add') + '</button></div></div></div>';
    mc.innerHTML = html;

    $('#saveMenuItem').addEventListener('click', async function () {
      var form = $('#menuForm');
      var fd = new FormData(form);
      var data = { name: fd.get('name'), price: parseFloat(fd.get('price')), description: fd.get('description') || '', category_id: fd.get('category_id'), image_url: fd.get('image_url') || '', is_available: form.querySelector('[name="is_available"]').checked, is_featured: form.querySelector('[name="is_featured"]').checked };
      if (!data.name || !data.price) return alert('Name and price required');
      if (isEdit) await apiFetch('/api/admin/menu/' + item.id, { method: 'PATCH', body: data });
      else await apiFetch('/api/admin/menu', { method: 'POST', body: data });
      mc.innerHTML = '';
      loadPage('menu');
    });
  }

  /* ============ REVIEWS ============ */
  async function renderReviews(c) {
    var reviews = await apiFetch('/api/admin/reviews');
    var html = '<div class="dash-header"><h1>Reviews</h1><p>' + reviews.length + ' reviews</p></div>';
    html += '<div class="table-wrap"><div class="table-responsive"><table><thead><tr><th>Author</th><th>Rating</th><th>Review</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    reviews.forEach(function (r) {
      html += '<tr><td><strong>' + escapeHtml(r.customer_name || 'Guest') + '</strong></td><td>' + '★'.repeat(r.rating) + '</td><td class="text-sm">' + escapeHtml((r.content || '').substring(0, 80)) + (r.content.length > 80 ? '...' : '') + '</td>';
      html += '<td><span class="badge badge--' + (r.is_approved ? 'approved' : 'pending') + '">' + (r.is_approved ? 'Approved' : 'Pending') + '</span></td><td><div class="flex gap-1">';
      if (!r.is_approved) html += '<button class="btn btn--success btn--sm" data-approve="' + escapeHtml(r.id) + '">Approve</button>';
      else html += '<button class="btn btn--ghost btn--sm" data-hide="' + escapeHtml(r.id) + '">Hide</button>';
      html += '<button class="btn btn--danger btn--sm btn--icon" data-del="' + escapeHtml(r.id) + '">✕</button>';
      html += '</div></td></tr>';
    });
    if (!reviews.length) html += '<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">No reviews</td></tr>';
    html += '</tbody></table></div></div>';
    c.innerHTML = html;

    $$('[data-approve]', c).forEach(function (btn) { btn.addEventListener('click', async function () { await apiFetch('/api/admin/reviews/' + btn.getAttribute('data-approve'), { method: 'PATCH', body: { is_approved: true } }); loadPage('reviews'); }); });
    $$('[data-hide]', c).forEach(function (btn) { btn.addEventListener('click', async function () { await apiFetch('/api/admin/reviews/' + btn.getAttribute('data-hide'), { method: 'PATCH', body: { is_approved: false } }); loadPage('reviews'); }); });
    $$('[data-del]', c).forEach(function (btn) { btn.addEventListener('click', async function () { if (!confirm('Delete?')) return; await apiFetch('/api/admin/reviews/' + btn.getAttribute('data-del'), { method: 'DELETE' }); loadPage('reviews'); }); });
  }

  /* ============ GALLERY ============ */
  async function renderGallery(c) {
    var images = await apiFetch('/api/admin/gallery');
    var html = '<div class="dash-header flex-between"><div><h1>Gallery</h1><p>' + images.length + ' images</p></div><button class="btn btn--primary" id="addImgBtn">+ Add Image</button></div>';
    html += '<div class="image-grid">';
    images.forEach(function (img) {
      html += '<div class="image-card"><img src="' + escapeHtml(img.image_url) + '" alt="' + escapeHtml(img.title || img.caption || '') + '"><div class="image-card__overlay">';
      if (img.title || img.caption) html += '<span style="color:#fff;font-size:.8rem;">' + escapeHtml(img.title || img.caption) + '</span>';
      html += '<button class="btn btn--danger btn--sm btn--icon" data-del="' + escapeHtml(img.id) + '">✕</button></div></div>';
    });
    html += '</div>';
    if (!images.length) html += '<div class="empty-state"><p>No images yet.</p></div>';
    c.innerHTML = html;

    $$('[data-del]', c).forEach(function (btn) { btn.addEventListener('click', async function () { if (!confirm('Delete?')) return; await apiFetch('/api/admin/gallery/' + btn.getAttribute('data-del'), { method: 'DELETE' }); loadPage('gallery'); }); });
    var addBtn = $('#addImgBtn', c);
    if (addBtn) addBtn.addEventListener('click', function () {
      var mc = $('#modalContainer');
      mc.innerHTML = '<div class="modal-overlay is-open"><div class="modal"><div class="modal__header"><h2>Add Image</h2><button class="modal__close" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div><div class="modal__body"><form id="galForm"><div class="form-group"><label>Title</label><input type="text" name="title"></div><div class="form-group"><label>Image URL *</label><input type="url" name="image_url" required></div><div class="form-group"><label>Caption</label><input type="text" name="caption"></div></form></div><div class="modal__footer"><button class="btn btn--ghost" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button><button class="btn btn--primary" id="saveGalImg">Add</button></div></div></div>';
      $('#saveGalImg').addEventListener('click', async function () {
        var fd = new FormData($('#galForm'));
        await apiFetch('/api/admin/gallery', { method: 'POST', body: { title: fd.get('title') || '', image_url: fd.get('image_url'), caption: fd.get('caption') || '' } });
        mc.innerHTML = '';
        loadPage('gallery');
      });
    });
  }

  /* ============ SETTINGS ============ */
  async function renderSettings(c) {
    var settings = await apiFetch('/api/admin/settings');
    var fields = [
      ['business_name', 'Business Name'], ['phone', 'Phone'], ['address', 'Address'],
      ['opening_hours', 'Opening Hours'], ['instagram', 'Instagram URL'],
      ['instagram_handle', 'Instagram Handle'],
      ['google_rating', 'Google Rating'], ['google_review_count', 'Google Reviews'],
    ];
    var html = '<div class="dash-header"><h1>Settings</h1><p>Edit your business information.</p></div>';
    html += '<div class="table-wrap" style="max-width:700px;"><div class="table-header"><h2>General</h2></div><div style="padding:1.5rem;"><form id="settingsForm">';
    fields.forEach(function (f) { html += '<div class="form-group"><label>' + f[1] + '</label><input type="text" name="' + f[0] + '" value="' + escapeHtml(settings[f[0]] || '') + '"></div>'; });
    html += '<button type="submit" class="btn btn--primary mt-2" id="saveSettings">Save Settings</button></form></div></div>';
    c.innerHTML = html;

    $('#settingsForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var data = {};
      fd.forEach(function (v, k) { data[k] = v; });
      var btn = $('#saveSettings');
      btn.disabled = true; btn.textContent = 'Saving...';
      await apiFetch('/api/admin/settings', { method: 'PATCH', body: data });
      btn.textContent = 'Saved ✓';
      setTimeout(function () { btn.disabled = false; btn.textContent = 'Save Settings'; }, 2000);
    });
  }

  /* ============ NOTIFICATIONS ============ */
  // Orders removed — the notification bell now links to pending review moderation.
  async function refreshNotifications() {
    try {
      var settings = await apiFetch('/api/admin/settings');
      var s = await apiFetch('/api/admin/dashboard');
      var pending = s.pending_review_count || 0;
      var badge = $('#notifBadge');
      if (badge) {
        badge.style.display = pending > 0 ? '' : 'none';
        badge.textContent = String(pending);
      }
      var list = $('#notifList');
      if (list) {
        var items = [];
        if (pending > 0) items.push('<p class="notif-panel__item">' + pending + ' review' + (pending === 1 ? '' : 's') + ' awaiting approval — <a href="#reviews">moderate them</a></p>');
        items.push('<p class="notif-panel__item">Instagram: ' + escapeHtml(settings.instagram_handle ? '@' + settings.instagram_handle.replace(/^@/, '') : 'not set') + '</p>');
        items.push('<p class="notif-panel__item">Phone: ' + escapeHtml(settings.phone || 'not set') + '</p>');
        list.innerHTML = items.join('');
      }
    } catch (e) {
      console.error(e);
    }
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
      localStorage.removeItem('bolivar_user');
      window.location.href = 'login.html';
    });

    var notifBtn = $('#notifBtn');
    var notifPanel = $('#notifPanel');
    var notifClose = $('#notifClose');
    if (notifBtn && notifPanel) {
      notifBtn.addEventListener('click', function () {
        notifPanel.classList.toggle('is-open');
        notifPanel.setAttribute('aria-hidden', String(!notifPanel.classList.contains('is-open')));
      });
    }
    if (notifClose && notifPanel) {
      notifClose.addEventListener('click', function () {
        notifPanel.classList.remove('is-open');
        notifPanel.setAttribute('aria-hidden', 'true');
      });
    }

    var hash = window.location.hash.replace('#', '') || 'dashboard';
    navigate(hash);
    refreshNotifications();
    window.addEventListener('hashchange', function () {
      var p = window.location.hash.replace('#', '') || 'dashboard';
      if (p !== currentPage) navigate(p);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
