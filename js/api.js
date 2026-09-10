/* ============================================================
   BOLIVAR COFFEE — API Layer (Production)
   All data operations via Express REST API.
   NO Supabase client in frontend code.
   ============================================================ */

(function () {
  "use strict";

  var B = window.BOLIVAR || {};

  function getToken() {
    return localStorage.getItem('bolivar_token');
  }

  async function apiFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    var token = getToken();
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    if (!options.headers['Content-Type'] && options.body && typeof options.body === 'object') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    var res = await fetch(url, options);
    var data = await res.json().catch(function () { return { error: 'Request failed' }; });
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  var api = {};

  // Public API
  api.getCategories = function () { return apiFetch('/api/categories'); };
  api.getMenuItems = function (category) {
    var url = '/api/menu';
    if (category) url += '?category=' + encodeURIComponent(category);
    return apiFetch(url);
  };
  api.getApprovedReviews = function () { return apiFetch('/api/reviews'); };
  api.submitReview = function (review) { return apiFetch('/api/reviews', { method: 'POST', body: review }); };
  api.getGalleryImages = function () { return apiFetch('/api/gallery'); };
  api.getSettings = function () { return apiFetch('/api/settings'); };

  // Admin API
  api.admin = {
    login: function (email, password) {
      return apiFetch('/api/auth/login', { method: 'POST', body: { email: email, password: password } });
    },
    me: function () { return apiFetch('/api/auth/me'); },
    dashboard: function () { return apiFetch('/api/admin/dashboard'); },
    getMenu: function () { return apiFetch('/api/admin/menu'); },
    createMenuItem: function (item) { return apiFetch('/api/admin/menu', { method: 'POST', body: item }); },
    updateMenuItem: function (id, updates) { return apiFetch('/api/admin/menu/' + id, { method: 'PATCH', body: updates }); },
    deleteMenuItem: function (id) { return apiFetch('/api/admin/menu/' + id, { method: 'DELETE' }); },
    getReviews: function () { return apiFetch('/api/admin/reviews'); },
    updateReview: function (id, updates) { return apiFetch('/api/admin/reviews/' + id, { method: 'PATCH', body: updates }); },
    deleteReview: function (id) { return apiFetch('/api/admin/reviews/' + id, { method: 'DELETE' }); },
    getGallery: function () { return apiFetch('/api/admin/gallery'); },
    createGalleryImage: function (img) { return apiFetch('/api/admin/gallery', { method: 'POST', body: img }); },
    updateGalleryImage: function (id, updates) { return apiFetch('/api/admin/gallery/' + id, { method: 'PATCH', body: updates }); },
    deleteGalleryImage: function (id) { return apiFetch('/api/admin/gallery/' + id, { method: 'DELETE' }); },
    getSettings: function () { return apiFetch('/api/admin/settings'); },
    updateSettings: function (settings) { return apiFetch('/api/admin/settings', { method: 'PATCH', body: settings }); },
    getCategories: function () { return apiFetch('/api/admin/categories'); },
    uploadImage: function (formData) {
      return fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData
      }).then(function (r) { return r.json(); });
    }
  };

  B.api = api;
  window.BOLIVAR = B;

})();
