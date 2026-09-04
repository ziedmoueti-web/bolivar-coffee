/* ============================================================
   BOLIVAR COFFEE — Shopping Cart
   Client-side cart with localStorage persistence.
   ============================================================ */

(function () {
  "use strict";

  var B = window.BOLIVAR || {};
  var CART_KEY = 'bolivar_cart';

  var cart = {
    items: [],

    load: function () {
      try {
        var stored = localStorage.getItem(CART_KEY);
        this.items = stored ? JSON.parse(stored) : [];
      } catch (e) {
        this.items = [];
      }
      return this;
    },

    save: function () {
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(this.items));
      } catch (e) { /* ignore */ }
      this.updateUI();
      this.dispatchEvent();
    },

    addItem: function (menuItem) {
      var existing = this.items.find(function (i) { return i.id === menuItem.id; });
      if (existing) {
        existing.quantity += 1;
      } else {
        this.items.push({
          id: menuItem.id,
          name: menuItem.name,
          price: parseFloat(menuItem.price),
          image_url: menuItem.image_url || '',
          quantity: 1
        });
      }
      this.save();
      return this;
    },

    removeItem: function (itemId) {
      this.items = this.items.filter(function (i) { return i.id !== itemId; });
      this.save();
      return this;
    },

    updateQuantity: function (itemId, quantity) {
      if (quantity <= 0) {
        return this.removeItem(itemId);
      }
      var item = this.items.find(function (i) { return i.id === itemId; });
      if (item) {
        item.quantity = quantity;
      }
      this.save();
      return this;
    },

    getSubtotal: function () {
      return this.items.reduce(function (sum, i) {
        return sum + (i.price * i.quantity);
      }, 0);
    },

    getItemCount: function () {
      return this.items.reduce(function (sum, i) { return sum + i.quantity; }, 0);
    },

    clear: function () {
      this.items = [];
      this.save();
      return this;
    },

    isEmpty: function () {
      return this.items.length === 0;
    },

    formatPrice: function (price) {
      return price.toFixed(3) + ' DT';
    },

    dispatchEvent: function () {
      var event = new CustomEvent('cart:change', {
        detail: {
          items: this.items.slice(),
          count: this.getItemCount(),
          total: this.getSubtotal()
        }
      });
      document.dispatchEvent(event);
    },

    updateUI: function () {
      // Update cart count badges
      var badges = document.querySelectorAll('.cart-badge, [data-cart-count]');
      var count = this.getItemCount();
      badges.forEach(function (el) {
        el.textContent = count;
        el.style.display = count > 0 ? '' : 'none';
      });

      // Update cart total displays
      var totals = document.querySelectorAll('[data-cart-total]');
      var total = this.getSubtotal();
      totals.forEach(function (el) {
        el.textContent = total.toFixed(3) + ' DT';
      });

      // Update cart item list in drawer
      var listEl = document.getElementById('cartItems');
      if (listEl) {
        if (this.isEmpty()) {
          listEl.innerHTML = '<div class="cart__empty"><p>Your cart is empty</p><p class="cart__empty-sub">Browse the menu and add items to get started.</p></div>';
        } else {
          var html = '';
          this.items.forEach(function (item) {
            html += '<div class="cart-item" data-id="' + item.id + '">';
            html += '  <div class="cart-item__info">';
            html += '    <span class="cart-item__name">' + item.name + '</span>';
            html += '    <span class="cart-item__price">' + item.price.toFixed(3) + ' DT</span>';
            html += '  </div>';
            html += '  <div class="cart-item__controls">';
            html += '    <button class="cart-item__btn" data-action="decrease" data-id="' + item.id + '" aria-label="Decrease quantity">−</button>';
            html += '    <span class="cart-item__qty">' + item.quantity + '</span>';
            html += '    <button class="cart-item__btn" data-action="increase" data-id="' + item.id + '" aria-label="Increase quantity">+</button>';
            html += '    <button class="cart-item__btn cart-item__btn--remove" data-action="remove" data-id="' + item.id + '" aria-label="Remove item">✕</button>';
            html += '  </div>';
            html += '</div>';
          });
          listEl.innerHTML = html;
        }
      }

      // Update cart total in drawer
      var drawerTotal = document.getElementById('cartTotal');
      if (drawerTotal) {
        drawerTotal.textContent = this.formatPrice(this.getSubtotal());
      }

      // Update checkout button state
      var checkoutBtn = document.getElementById('checkoutBtn');
      if (checkoutBtn) {
        checkoutBtn.disabled = this.isEmpty();
      }
    }
  };

  // Initialize cart
  cart.load();

  // Event delegation for cart item controls
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;

    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');

    if (action === 'increase') {
      var item = cart.items.find(function (i) { return i.id === id; });
      if (item) cart.updateQuantity(id, item.quantity + 1);
    } else if (action === 'decrease') {
      var item = cart.items.find(function (i) { return i.id === id; });
      if (item) cart.updateQuantity(id, item.quantity - 1);
    } else if (action === 'remove') {
      cart.removeItem(id);
    }
  });

  // Cart drawer open/close
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-cart-toggle]');
    if (trigger) {
      e.preventDefault();
      var drawer = document.getElementById('cartDrawer');
      if (drawer) {
        var isOpen = drawer.classList.contains('is-open');
        drawer.classList.toggle('is-open', !isOpen);
        document.body.classList.toggle('menu-open', !isOpen);
        drawer.setAttribute('aria-hidden', String(isOpen));
      }
    }
  });

  // Close cart drawer
  document.addEventListener('click', function (e) {
    var closeBtn = e.target.closest('#cartClose');
    if (closeBtn) {
      var drawer = document.getElementById('cartDrawer');
      if (drawer) {
        drawer.classList.remove('is-open');
        document.body.classList.remove('menu-open');
        drawer.setAttribute('aria-hidden', 'true');
      }
    }
  });

  // Close cart on overlay click
  document.addEventListener('click', function (e) {
    if (e.target.id === 'cartOverlay') {
      var drawer = document.getElementById('cartDrawer');
      if (drawer) {
        drawer.classList.remove('is-open');
        document.body.classList.remove('menu-open');
        drawer.setAttribute('aria-hidden', 'true');
      }
    }
  });

  // Escape key closes cart
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var drawer = document.getElementById('cartDrawer');
      if (drawer && drawer.classList.contains('is-open')) {
        drawer.classList.remove('is-open');
        document.body.classList.remove('menu-open');
        drawer.setAttribute('aria-hidden', 'true');
      }
    }
  });

  // Export
  B.cart = cart;
  window.BOLIVAR = B;

  // Initialize UI on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { cart.updateUI(); });
  } else {
    cart.updateUI();
  }

})();
