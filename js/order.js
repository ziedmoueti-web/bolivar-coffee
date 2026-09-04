/* ============================================================
   BOLIVAR COFFEE — Order Flow
   Handles checkout, order form, and order submission.
   ============================================================ */

(function () {
  "use strict";

  var B = window.BOLIVAR;
  var cart = B && B.cart;
  var api = B && B.api;

  if (!cart || !api) return;

  /* ---------- Add to Cart buttons ---------- */

  function addCartButtons() {
    var dishes = document.querySelectorAll('.dish');
    dishes.forEach(function (dish) {
      if (dish.querySelector('.dish__cart-btn')) return;

      var media = dish.querySelector('.dish__media');
      if (!media) return;

      // Get item data from the dish card
      var name = (dish.querySelector('h3') || {}).textContent || '';
      var priceText = (dish.querySelector('.dish__price') || {}).textContent || '0';
      var img = dish.querySelector('img');
      var imgSrc = img ? img.src : '';
      var imgAlt = img ? img.alt : '';

      // Extract numeric price (handle "—", "4.500 DT", etc.)
      var priceNum = parseFloat(priceText.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;

      // Get the item id (set by dynamic loading or generate from name)
      var itemId = dish.getAttribute('data-item-id') || ('static-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

      var btn = document.createElement('button');
      btn.className = 'dish__cart-btn';
      btn.setAttribute('data-cursor', 'ADD');
      btn.setAttribute('aria-label', 'Add ' + name + ' to cart');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        cart.addItem({
          id: itemId,
          name: name,
          price: priceNum,
          image_url: imgSrc
        });

        // Visual feedback
        btn.classList.add('is-added');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>';

        setTimeout(function () {
          btn.classList.remove('is-added');
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        }, 1200);

        // Open cart briefly
        var drawer = document.getElementById('cartDrawer');
        if (drawer && !drawer.classList.contains('is-open')) {
          drawer.classList.add('is-open');
          document.body.classList.add('menu-open');
          drawer.setAttribute('aria-hidden', 'false');
          setTimeout(function () {
            drawer.classList.remove('is-open');
            document.body.classList.remove('menu-open');
            drawer.setAttribute('aria-hidden', 'true');
          }, 2000);
        }
      });

      media.appendChild(btn);
    });
  }

  // Run after a short delay to let the DOM settle
  setTimeout(addCartButtons, 500);
  // Also re-run when menu items change (e.g., tab switch)
  var menuGrid = document.getElementById('menuGrid');
  if (menuGrid) {
    var observer = new MutationObserver(function () {
      setTimeout(addCartButtons, 100);
    });
    observer.observe(menuGrid, { childList: true, subtree: true });
  }

  /* ---------- Checkout button opens order modal ---------- */

  document.addEventListener('click', function (e) {
    var checkoutBtn = e.target.closest('#checkoutBtn');
    if (!checkoutBtn && e.target.closest('[data-cart-toggle="order"]')) {
      checkoutBtn = e.target.closest('[data-cart-toggle="order"]');
    }
    if (!checkoutBtn) return;
    if (cart.isEmpty()) return;

    // Close cart drawer
    var drawer = document.getElementById('cartDrawer');
    if (drawer) {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
    }

    // Open order modal
    var modal = document.getElementById('orderModal');
    if (modal) {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('menu-open');

      // Populate order summary
      var summary = document.getElementById('orderSummary');
      if (summary) {
        var html = '<h4>Order Summary</h4>';
        cart.items.forEach(function (item) {
          html += '<div class="order-summary-item">';
          html += '  <span>' + item.name + ' × ' + item.quantity + '</span>';
          html += '  <span>' + (item.price * item.quantity).toFixed(3) + ' DT</span>';
          html += '</div>';
        });
        html += '<div class="order-summary-item order-summary-total">';
        html += '  <span>Total</span>';
        html += '  <span>' + cart.getSubtotal().toFixed(3) + ' DT</span>';
        html += '</div>';
        summary.innerHTML = html;
      }
    }
  });

  /* ---------- Close order modal ---------- */

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-order]')) {
      var modal = document.getElementById('orderModal');
      if (modal) {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('menu-open');
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var modal = document.getElementById('orderModal');
      if (modal && modal.classList.contains('is-open')) {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('menu-open');
      }
    }
  });

  /* ---------- Order form submission ---------- */

  var orderForm = document.getElementById('orderForm');
  if (orderForm) {
    orderForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      var nameInput = document.getElementById('orderName');
      var phoneInput = document.getElementById('orderPhone');
      var notesInput = document.getElementById('orderNotes');
      var submitBtn = document.getElementById('submitOrderBtn');

      var name = (nameInput.value || '').trim();
      var phone = (phoneInput.value || '').trim();
      var notes = (notesInput.value || '').trim();

      // Validation
      if (!name) {
        nameInput.focus();
        nameInput.classList.add('form-error');
        return;
      }
      if (!phone) {
        phoneInput.focus();
        phoneInput.classList.add('form-error');
        return;
      }

      if (cart.isEmpty()) return;

      // Disable form
      submitBtn.disabled = true;
      submitBtn.textContent = 'PLACING ORDER...';
      nameInput.disabled = true;
      phoneInput.disabled = true;
      notesInput.disabled = true;

      try {
        var order = await api.createOrder({
          name: name,
          phone: phone,
          notes: notes,
          total: cart.getSubtotal(),
          items: cart.items
        });

        // Clear cart
        cart.clear();

        // Redirect to confirmation page
        window.location.href = 'order.html?id=' + order.id + '&number=' + order.order_number;
      } catch (err) {
        console.error('[Bolivar] Order failed:', err);
        alert('Sorry, something went wrong. Please try again or call us at +216 22 535 138.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'CONFIRM ORDER';
        nameInput.disabled = false;
        phoneInput.disabled = false;
        notesInput.disabled = false;
      }
    });
  }

  /* ---------- Form input error handling ---------- */
  document.addEventListener('input', function (e) {
    if (e.target.classList.contains('form-error')) {
      e.target.classList.remove('form-error');
    }
  });

})();
