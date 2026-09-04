/* ============================================================
   BOLIVAR COFFEE & LOUNGE — interactions
   Vanilla JS, no dependencies. GPU-friendly, reduced-motion aware.
   Now with dynamic content loading from database.
   ============================================================ */
(function () {
  "use strict";

  var doc = document;
  var body = doc.body;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  var clamp = function (v, min, max) { return Math.max(min, Math.min(max, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  /* ---------- Preloader ---------- */
  var preloaderDone = false;
  function finishPreloader() {
    if (preloaderDone) return;
    preloaderDone = true;
    body.classList.add("is-loaded");
    setTimeout(function () {
      var el = $(".preloader");
      if (el) el.parentNode.removeChild(el);
    }, 1500);
  }
  if (reduceMotion) {
    finishPreloader();
  } else {
    window.addEventListener("load", function () {
      setTimeout(finishPreloader, 450);
    });
    setTimeout(finishPreloader, 2600);
  }

  /* ---------- Custom cursor (desktop, fine pointer only) ---------- */
  var cursor = null, dot = null, ring = null, label = null;
  var cx = 0, cy = 0, rx = 0, ry = 0;
  var cursorActive = false;

  if (finePointer && !reduceMotion) {
    cursor = $(".cursor");
    dot = $(".cursor__dot");
    ring = $(".cursor__ring");
    label = $(".cursor__label");

    doc.addEventListener("mousemove", function (e) {
      cx = e.clientX;
      cy = e.clientY;
      if (!cursorActive) {
        cursorActive = true;
        rx = cx; ry = cy;
      }
      positionCursor(cx, cy, true);
    });

    function positionCursor(x, y, snap) {
      dot.style.transform = "translate(" + x + "px," + y + "px)";
      if (snap) {
        ring.style.transform = "translate(" + x + "px," + y + "px)";
        if (label) label.style.transform = "translate(" + x + "px," + y + "px) translate(-50%,-50%)";
      }
    }

    function cursorLoop() {
      if (!cursorActive) return;
      rx = lerp(rx, cx, 0.22);
      ry = lerp(ry, cy, 0.22);
      dot.style.transform = "translate(" + cx + "px," + cy + "px)";
      ring.style.transform = "translate(" + rx + "px," + ry + "px)";
      if (label) label.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%)";
      requestAnimationFrame(cursorLoop);
    }
    requestAnimationFrame(cursorLoop);

    doc.addEventListener("mouseleave", function () {
      cursor.classList.remove("is-active", "is-view", "is-open");
    });
    doc.addEventListener("mouseenter", function () { cursor.classList.add("is-active"); });

    doc.addEventListener("mouseover", function (e) {
      var t = e.target.closest("[data-cursor]");
      if (t) {
        var mode = t.getAttribute("data-cursor");
        cursor.classList.add(mode === "VIEW" ? "is-view" : "is-open");
        label.textContent = mode;
      }
    });
    doc.addEventListener("mouseout", function (e) {
      if (e.target.closest("[data-cursor]")) {
        cursor.classList.remove("is-view", "is-open");
      }
    });
  } else {
    var c = $(".cursor");
    if (c) c.parentNode.removeChild(c);
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    $$("[data-magnetic]").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.18;
        var y = (e.clientY - r.top - r.height / 2) * 0.3;
        el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* ---------- Navbar scroll state ---------- */
  var nav = $("#nav");
  var fab = $("#fab");
  function onScrollNav() {
    var y = window.scrollY;
    nav.classList.toggle("scrolled", y > 40);
    if (fab) fab.classList.toggle("is-visible", y > window.innerHeight * 0.65);
  }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* ---------- Mobile menu ---------- */
  var burger = $("#navBurger");
  var mobileMenu = $("#mobileMenu");
  function closeMenu() {
    body.classList.remove("menu-open");
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Open menu");
  }
  if (burger && mobileMenu) {
    burger.addEventListener("click", function () {
      var open = !mobileMenu.classList.contains("is-open");
      body.classList.toggle("menu-open", open);
      mobileMenu.classList.toggle("is-open", open);
      mobileMenu.setAttribute("aria-hidden", String(!open));
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
  }

  /* ---------- Smooth scroll ---------- */
  $$("[data-scroll]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      var target = doc.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      closeMenu();
      var navH = nav ? nav.offsetHeight : 0;
      var top = target.getBoundingClientRect().top + window.scrollY - navH + 4;
      if (reduceMotion) {
        window.scrollTo(0, top);
      } else {
        window.scrollTo({ top: top, behavior: "smooth" });
      }
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  /* ---------- Scroll reveal ---------- */
  var revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in-view");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in-view"); });
  }

  /* ---------- Parallax ---------- */
  var parallaxEls = $$("[data-parallax]");
  var ticking = false;
  function applyParallax() {
    ticking = false;
    var vh = window.innerHeight;
    parallaxEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var speed = parseFloat(el.getAttribute("data-parallax")) || 0.08;
      var offset = (r.top + r.height / 2 - vh / 2) * speed;
      el.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
    });
  }
  if (parallaxEls.length && !reduceMotion) {
    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(applyParallax);
      }
    }, { passive: true });
    applyParallax();
  }

  /* ---------- Menu tabs ---------- */
  var tabs = $$(".menu__tab");
  var grid = $("#menuGrid");
  var activeCat = "coffee";

  function dishesFor(cat) {
    return $$(".dish", grid).filter(function (d) { return d.getAttribute("data-category") === cat; });
  }

  function showCategory(cat) {
    if (cat === activeCat) return;
    activeCat = cat;
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-cat") === cat;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
    });
    var visible = $$(".dish.is-show", grid);
    visible.forEach(function (d) {
      d.style.transition = "opacity 0.24s ease, transform 0.24s ease";
      d.style.transitionDelay = "0s";
      d.classList.remove("is-show");
    });
    setTimeout(function () {
      $$(".dish", grid).forEach(function (d) {
        d.style.transition = "";
        d.style.transitionDelay = "0s";
        d.style.display = d.getAttribute("data-category") === cat ? "" : "none";
        d.classList.remove("is-show");
      });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          dishesFor(cat).forEach(function (d, i) {
            d.style.transitionDelay = (i * 70) + "ms";
            d.classList.add("is-show");
            setTimeout(function () { d.style.transitionDelay = "0s"; }, 700 + i * 70);
          });
        });
      });
    }, 240);
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () { showCategory(t.getAttribute("data-cat")); });
  });
  $$(".dish", grid).forEach(function (d) {
    if (d.getAttribute("data-category") !== activeCat) d.style.display = "none";
  });
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      dishesFor(activeCat).forEach(function (d, i) {
        d.style.transitionDelay = (i * 70) + "ms";
        d.classList.add("is-show");
      });
    });
  });

  if (window.matchMedia("(hover: none)").matches) {
    grid.addEventListener("click", function (e) {
      var dish = e.target.closest(".dish");
      if (!dish || e.target.closest("a")) return;
      var wasOpen = dish.classList.contains("is-open");
      $$(".dish", grid).forEach(function (d) { d.classList.remove("is-open"); });
      if (!wasOpen) dish.classList.add("is-open");
    });
  }

  /* ---------- Review counters ---------- */
  var score = $(".reviews__score");
  var counted = false;
  function animateCount(el) {
    var to = parseFloat(el.getAttribute("data-count-to"));
    var dec = parseInt(el.getAttribute("data-count-decimals"), 10) || 0;
    var dur = 1400;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = clamp((ts - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * eased).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function animateStars() {
    var i = 0;
    $$(".reviews__stars .star").forEach(function (s) {
      if (s.classList.contains("is-partial")) return;
      setTimeout(function () { s.classList.add("is-full"); }, 200 + i * 160);
      i++;
    });
  }
  if (score && "IntersectionObserver" in window) {
    var ioScore = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !counted) {
          counted = true;
          $$("[data-count-to]", score).forEach(animateCount);
          if (!reduceMotion) animateStars();
          else $$(".reviews__stars .star").forEach(function (s) {
            if (!s.classList.contains("is-partial")) s.classList.add("is-full");
          });
          ioScore.disconnect();
        }
      });
    }, { threshold: 0.4 });
    ioScore.observe(score);
  } else if (score) {
    $$("[data-count-to]", score).forEach(function (el) { el.textContent = el.getAttribute("data-count-to"); });
  }

  /* ---------- Gallery lightbox ---------- */
  var items = $$(".g-item");
  var lightbox = $("#lightbox");
  var lbImg = $("#lbImg");
  var lbCap = $("#lbCap");
  var lbIndex = 0;

  function lbShow(i) {
    lbIndex = (i + items.length) % items.length;
    var it = items[lbIndex];
    var img = $("img", it);
    lbImg.src = img.src.replace("w=900", "w=1600");
    lbImg.alt = img.alt || "";
    lbCap.textContent = it.getAttribute("data-caption") || "";
  }
  function lbOpen(i) {
    if (!lightbox || !items.length) return;
    lbShow(i);
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    body.classList.add("menu-open");
  }
  function lbClose() {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    body.classList.remove("menu-open");
  }

  items.forEach(function (it, i) {
    it.addEventListener("click", function () { lbOpen(i); });
  });
  var lbCloseBtn = $("#lbClose");
  var lbPrev = $("#lbPrev");
  var lbNext = $("#lbNext");
  if (lbCloseBtn) lbCloseBtn.addEventListener("click", lbClose);
  if (lbPrev) lbPrev.addEventListener("click", function (e) { e.stopPropagation(); lbShow(lbIndex - 1); });
  if (lbNext) lbNext.addEventListener("click", function (e) { e.stopPropagation(); lbShow(lbIndex + 1); });
  if (lightbox) {
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) lbClose(); });
    doc.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("is-open")) return;
      if (e.key === "Escape") lbClose();
      if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
      if (e.key === "ArrowRight") lbShow(lbIndex + 1);
    });
    var touchX = null;
    lightbox.addEventListener("touchstart", function (e) {
      touchX = e.changedTouches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener("touchend", function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 48) lbShow(lbIndex + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  }

  /* ============================================================
     DYNAMIC CONTENT — Load from database via REST API
     Falls back gracefully if API is not available.
     ============================================================ */
  (function () {
    var B = window.BOLIVAR;
    if (!B || !B.api) return;
    var api = B.api;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function loadMenu() {
      try {
        var categories = await api.getCategories();
        var items = await api.getMenuItems();
        if (!items.length) return;
        var grid = doc.getElementById('menuGrid');
        if (!grid) return;

        // Update tabs
        var tabsContainer = doc.querySelector('.menu__tabs');
        if (tabsContainer && categories.length) {
          tabsContainer.innerHTML = categories.map(function (cat, i) {
            return '<button class="menu__tab' + (i === 0 ? ' is-active' : '') + '" data-cat="' + escapeHtml(cat.slug) + '" role="tab" aria-selected="' + (i === 0 ? 'true' : 'false') + '">' + escapeHtml(cat.name) + '</button>';
          }).join('');
        }

        // Build menu
        grid.innerHTML = items.map(function (item) {
          var cat = item.category_slug || 'coffee';
          var priceDisplay = item.price > 0 ? item.price.toFixed(3) + ' DT' : '—';
          var imgSrc = item.image_url || 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=700&q=80';
          return '<article class="dish is-show" data-category="' + escapeHtml(cat) + '" data-item-id="' + escapeHtml(item.id) + '">' +
            '<div class="dish__media"><img src="' + escapeHtml(imgSrc) + '" alt="' + escapeHtml(item.name) + '" loading="lazy" decoding="async"><span class="dish__arrow" aria-hidden="true">→</span></div>' +
            '<div class="dish__body"><div class="dish__head"><h3>' + escapeHtml(item.name) + '</h3><span class="dish__dots" aria-hidden="true"></span><span class="dish__price">' + priceDisplay + '</span></div>' +
            '<p class="dish__desc">' + escapeHtml(item.description) + '</p></div></article>';
        }).join('');

        reinitMenuTabs();
      } catch (err) {
        console.warn('[Bolivar] Could not load menu:', err.message);
      }
    }

    function reinitMenuTabs() {
      var newTabs = $$('.menu__tab');
      var grid = doc.getElementById('menuGrid');
      var newActive = 'coffee';
      function dishesFor(cat) {
        return $$('.dish', grid).filter(function (d) { return d.getAttribute('data-category') === cat; });
      }
      function showCategory(cat) {
        if (cat === newActive) return;
        newActive = cat;
        newTabs.forEach(function (t) {
          var on = t.getAttribute('data-cat') === cat;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', String(on));
        });
        var visible = $$('.dish.is-show', grid);
        visible.forEach(function (d) {
          d.style.transition = 'opacity 0.24s ease, transform 0.24s ease';
          d.style.transitionDelay = '0s';
          d.classList.remove('is-show');
        });
        setTimeout(function () {
          $$('.dish', grid).forEach(function (d) {
            d.style.transition = '';
            d.style.transitionDelay = '0s';
            d.style.display = d.getAttribute('data-category') === cat ? '' : 'none';
            d.classList.remove('is-show');
          });
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              dishesFor(cat).forEach(function (d, i) {
                d.style.transitionDelay = (i * 70) + 'ms';
                d.classList.add('is-show');
                setTimeout(function () { d.style.transitionDelay = '0s'; }, 700 + i * 70);
              });
            });
          });
        }, 240);
      }
      newTabs.forEach(function (t) {
        t.addEventListener('click', function () { showCategory(t.getAttribute('data-cat')); });
      });
      var firstCat = newTabs.length ? newTabs[0].getAttribute('data-cat') : 'coffee';
      $$('.dish', grid).forEach(function (d) {
        if (d.getAttribute('data-category') !== firstCat) d.style.display = 'none';
      });
      newActive = firstCat;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          dishesFor(firstCat).forEach(function (d, i) {
            d.style.transitionDelay = (i * 70) + 'ms';
            d.classList.add('is-show');
          });
        });
      });
    }

    async function loadReviews() {
      try {
        var reviews = await api.getApprovedReviews();
        if (!reviews.length) return;
        var rail = doc.querySelector('.reviews__rail');
        if (!rail) return;
        rail.innerHTML = reviews.map(function (r) {
          var stars = '';
          for (var i = 0; i < 5; i++) stars += '<span' + (i < r.rating ? '' : ' style="opacity:.3"') + '>★</span>';
          return '<figure class="review"><div class="review__stars" aria-hidden="true">' + stars + '</div><blockquote>"' + escapeHtml(r.content) + '"</blockquote><figcaption>' + escapeHtml(r.customer_name || 'Guest') + (r.source === 'google' ? ' — Google Review' : '') + '</figcaption></figure>';
        }).join('') + '<figure class="review review--cta"><p>Enjoyed your visit?</p><a href="https://www.google.com/maps/search/?api=1&query=Bolivar+Coffee+Megrine" target="_blank" rel="noopener" data-cursor="OPEN">LEAVE A REVIEW <span aria-hidden="true">→</span></a></figure>';
      } catch (err) {
        console.warn('[Bolivar] Could not load reviews:', err.message);
      }
    }

    async function loadGallery() {
      try {
        var images = await api.getGalleryImages();
        if (!images.length) return;
        var grid = doc.querySelector('.gallery__grid');
        if (!grid) return;
        var classes = ['g-item--a','g-item--b','g-item--c','g-item--d','g-item--e','g-item--f','g-item--g','g-item--h'];
        grid.innerHTML = images.map(function (img, i) {
          var cls = classes[i % classes.length];
          return '<button class="g-item ' + cls + '" data-caption="' + escapeHtml(img.title || img.caption || '') + '" data-cursor="VIEW"><img src="' + escapeHtml(img.image_url) + '" alt="' + escapeHtml(img.title || img.caption || 'Gallery') + '" loading="lazy" decoding="async">' + ((img.title || img.caption) ? '<span class="g-item__label">' + escapeHtml(img.title || img.caption) + '</span>' : '') + '</button>';
        }).join('');
        // Re-init lightbox
        items = $$('.g-item');
        items.forEach(function (it, i) { it.addEventListener('click', function () { lbOpen(i); }); });
      } catch (err) {
        console.warn('[Bolivar] Could not load gallery:', err.message);
      }
    }

    async function loadSettings() {
      try {
        var s = await api.getSettings();
        if (!s || !s.business_name) return;
        if (s.instagram) doc.querySelectorAll('a[href*="instagram.com"]').forEach(function (a) { a.href = s.instagram; });
        if (s.google_maps_url) doc.querySelectorAll('a[href*="google.com/maps/dir"]').forEach(function (a) { a.href = s.google_maps_url; });
      } catch (err) {
        console.warn('[Bolivar] Could not load settings:', err.message);
      }
    }

    loadMenu();
    loadReviews();
    loadGallery();
    loadSettings();
  })();

})();
