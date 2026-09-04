/* ============================================================
   BOLIVAR COFFEE — API Layer
   All data operations via our Express REST API.
   ============================================================ */

(function () {
  "use strict";

  var B = window.BOLIVAR || {};

  /* ---------- Helper ---------- */
  async function apiFetch(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    if (!options.headers['Content-Type'] && options.body && typeof options.body === 'object') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    var res = await fetch(url, options);
    if (!res.ok) {
      var err = await res.json().catch(function () { return { error: 'Request failed' }; });
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }

  var api = {};

  /* ---------- Menu ---------- */
  api.getCategories = function () { return apiFetch('/api/categories'); };
  api.getMenuItems = function (category) {
    var url = '/api/menu?available=1';
    if (category) url += '&category=' + encodeURIComponent(category);
    return apiFetch(url);
  };
  api.getAllMenuItems = function () { return apiFetch('/api/menu'); };
  api.getFeaturedItems = function () { return apiFetch('/api/menu?featured=1&available=1'); };

  /* ---------- Reviews ---------- */
  api.getApprovedReviews = function () { return apiFetch('/api/reviews/approved'); };
  api.submitReview = function (review) {
    return apiFetch('/api/reviews', { method: 'POST', body: review });
  };

  /* ---------- Gallery ---------- */
  api.getGalleryImages = function () { return apiFetch('/api/gallery'); };

  /* ---------- Orders ---------- */
  api.createOrder = function (orderData) {
    return apiFetch('/api/orders', { method: 'POST', body: orderData });
  };
  api.getOrder = function (orderId) {
    return apiFetch('/api/orders/' + orderId);
  };

  /* ---------- Settings ---------- */
  api.getSettings = function () { return apiFetch('/api/settings'); };

  /* ---------- Export ---------- */
  B.api = api;
  window.BOLIVAR = B;

})();
