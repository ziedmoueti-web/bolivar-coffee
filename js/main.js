/* ============================================================
   BOLIVAR COFFEE & LOUNGE — interactions
   Vanilla JS, no dependencies. GPU-friendly, reduced-motion aware.
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
      // Small fixed delay so the word + line read before the reveal
      setTimeout(finishPreloader, 450);
    });
    // Safety net — never let the preloader linger
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

    // Hover states via delegation
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

  /* ---------- Magnetic buttons (desktop, subtle) ---------- */
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

  /* ---------- Smooth scroll for anchors ---------- */
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

  /* ---------- Parallax (transform-only, rAF-throttled) ---------- */
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

    // Fade out current set
    var visible = $$(".dish.is-show", grid);
    visible.forEach(function (d) {
      d.style.transition = "opacity 0.24s ease, transform 0.24s ease";
      d.style.transitionDelay = "0s";
      d.classList.remove("is-show");
    });

    setTimeout(function () {
      // Hide all, reveal the target set with a stagger
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
            // Clear the stagger delay once the entrance is done so hover
            // transitions on the card are never delayed.
            setTimeout(function () { d.style.transitionDelay = "0s"; }, 700 + i * 70);
          });
        });
      });
    }, 240);
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () { showCategory(t.getAttribute("data-cat")); });
  });
  // Initial state: show only the coffee set
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

  // Mobile: tap a dish to expand (desktop hover equivalent)
  if (window.matchMedia("(hover: none)").matches) {
    grid.addEventListener("click", function (e) {
      var dish = e.target.closest(".dish");
      if (!dish || e.target.closest("a")) return;
      var wasOpen = dish.classList.contains("is-open");
      $$(".dish", grid).forEach(function (d) { d.classList.remove("is-open"); });
      if (!wasOpen) dish.classList.add("is-open");
    });
  }

  /* ---------- Review score counters + stars ---------- */
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
      // Keep the 5th star partial (70% fill) — it represents the 4.7 rating
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
    body.classList.add("menu-open"); // lock scroll (reuses the same class)
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
    // Basic swipe support
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

  /* ---------- Footer year is static (© 2026) — nothing to do ---------- */

  /* ---------- Sprite-sheet scroll animation (cinematic) ---------- */
  (function () {
    var sprite = $("#heroSprite");
    var hero = $("#home");
    var overlay = $(".hero__overlay");
    var scrollCue = $(".hero__scroll");
    var progressBar = $(".hero__progress-bar");
    if (!sprite || !hero) return;

    /* Sprite sheet layout: 16 cols × 12 rows, 192 frames total */
    var COLS = 16;
    var ROWS = 12;
    var TOTAL = COLS * ROWS;

    /* Smoothed values */
    var currentFrame = 0;
    var targetFrame = 0;
    var currentProgress = 0;
    var targetProgress = 0;
    var scrollVelocity = 0;
    var lastTime = performance.now();
    var lastScrollY = window.scrollY;

    /* Guard: don't touch text opacity/transform until entrance animation completes
       to avoid the JS parallax overriding the heroIn keyframe animation (flash bug). */
    var heroReady = false;
    if ($$('.hero-item').length) {
      var maxDelay = 600; // largest --d value in ms
      var animDuration = 1200; // heroIn duration
      setTimeout(function () { heroReady = true; }, maxDelay + animDuration + 100);
    } else {
      heroReady = true;
    }

    /* Hero scroll range */
    function heroScrollRange() {
      return hero.offsetHeight - window.innerHeight;
    }

    function getScrollProgress() {
      var rect = hero.getBoundingClientRect();
      var scrolled = -rect.top;
      var range = heroScrollRange();
      return clamp(scrolled / range, 0, 1);
    }

    /* Overlay fades */
    function updateOverlay(p) {
      if (!overlay) return;
      var rect = hero.getBoundingClientRect();
      var pastHero = rect.bottom <= window.innerHeight * 0.3;
      overlay.style.opacity = pastHero ? "0" : "1";
    }

    /* Scroll cue */
    function updateScrollCue() {
      if (!scrollCue) return;
      var heroBottom = hero.getBoundingClientRect().bottom;
      var pastHero = heroBottom <= window.innerHeight;
      scrollCue.classList.toggle("is-hidden", pastHero || window.scrollY > 80);
    }

    /* Apply frame to sprite — pixel-precise background-position */
    function applyFrame(frameIdx) {
      var col = frameIdx % COLS;
      var row = Math.floor(frameIdx / COLS);
      var xPct = (col / (COLS - 1)) * 100;
      var yPct = (row / (ROWS - 1)) * 100;
      sprite.style.backgroundPosition = xPct + "% " + yPct + "%";
    }

    /* Cinematic Ken Burns: subtle zoom tied to scroll */
    function applyKenBurns(progress) {
      var scale = 1 + progress * 0.08;
      sprite.style.transform = "scale(" + scale.toFixed(4) + ")";
    }

    /* Scroll-linked parallax on hero text elements */
    var heroEyebrow = $(".hero__eyebrow");
    var heroTitle = $(".hero__title");
    var heroSub = $(".hero__sub");
    var heroCta = $(".hero__cta");
    var heroLoc = $(".hero__loc");
    var textEls = [heroEyebrow, heroTitle, heroSub, heroCta, heroLoc].filter(Boolean);
    var textSpeeds = [0.35, 0.2, 0.12, 0.06, 0.04];

    function applyTextParallax(progress) {
      if (!heroReady) return;
      for (var i = 0; i < textEls.length; i++) {
        var el = textEls[i];
        var speed = textSpeeds[i];
        var yOffset = progress * speed * -200;
        var opacity = 1 - progress * 1.2;
        opacity = clamp(opacity, 0, 1);
        el.style.transform = "translate3d(0," + yOffset.toFixed(1) + "px,0)";
        el.style.opacity = opacity.toFixed(3);
      }
    }

    /* Smooth scroll velocity for motion blur / responsiveness */
    function getScrollVelocity() {
      var now = performance.now();
      var dt = (now - lastTime) / 1000;
      if (dt > 0) {
        scrollVelocity = lerp(scrollVelocity, Math.abs(window.scrollY - lastScrollY) / dt, 0.3);
      }
      lastTime = now;
      lastScrollY = window.scrollY;
      return scrollVelocity;
    }

    /* Main animation loop */
    function animate() {
      var now = performance.now();
      targetProgress = getScrollProgress();
      targetFrame = Math.round(targetProgress * (TOTAL - 1));

      /* Smooth interpolation — different speeds for frame vs progress */
      var frameLerp = 0.12;
      var progressLerp = 0.1;

      /* Faster response when scrolling fast */
      var vel = getScrollVelocity();
      if (vel > 2000) {
        frameLerp = 0.35;
        progressLerp = 0.28;
      } else if (vel > 800) {
        frameLerp = 0.22;
        progressLerp = 0.18;
      }

      currentFrame = lerp(currentFrame, targetFrame, frameLerp);
      currentProgress = lerp(currentProgress, targetProgress, progressLerp);

      /* Snap when close */
      if (Math.abs(currentFrame - targetFrame) < 0.1) currentFrame = targetFrame;
      if (Math.abs(currentProgress - targetProgress) < 0.001) currentProgress = targetProgress;

      applyFrame(Math.round(currentFrame));
      applyKenBurns(currentProgress);
      applyTextParallax(currentProgress);
      updateOverlay(currentProgress);
      updateScrollCue();
      if (progressBar) progressBar.style.width = (currentProgress * 100).toFixed(1) + "%";

      lastTime = now;
      requestAnimationFrame(animate);
    }

    /* Init */
    if (reduceMotion) {
      sprite.style.backgroundPosition = "0 0";
    } else {
      requestAnimationFrame(animate);
    }
  })();
})();
