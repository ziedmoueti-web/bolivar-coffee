/* ============================================================
   BOLIVAR COFFEE & LOUNGE — premium motion system
   GSAP + ScrollTrigger + Lenis smooth scroll.
   Preserves: preloader, cursor, magnetic buttons, nav, mobile menu,
   menu tabs, reviews counter, gallery lightbox, dish expand.
   ============================================================ */
(function () {
  "use strict";

  var doc = document;
  var body = doc.body;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var isMobile = window.innerWidth < 768;

  var clamp = function (v, min, max) { return Math.max(min, Math.min(max, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };

  /* ============================================================
     PRELOADER
     ============================================================ */
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

  /* ============================================================
     CUSTOM CURSOR (desktop, fine pointer only)
     ============================================================ */
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
      dot.style.transform = "translate(" + cx + "px," + cy + "px)";
      ring.style.transform = "translate(" + cx + "px," + cy + "px)";
      if (label) label.style.transform = "translate(" + cx + "px," + cy + "px) translate(-50%,-50%)";
    });

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

  /* ============================================================
     MAGNETIC BUTTONS (desktop, subtle)
     ============================================================ */
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

  /* ============================================================
     NAVBAR SCROLL STATE
     ============================================================ */
  var nav = $("#nav");
  var fab = $("#fab");
  function onScrollNav() {
    var y = window.scrollY;
    nav.classList.toggle("scrolled", y > 40);
    if (fab) fab.classList.toggle("is-visible", y > window.innerHeight * 0.65);
  }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* ============================================================
     MOBILE MENU
     ============================================================ */
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

  /* ============================================================
     SMOOTH SCROLL FOR ANCHORS (fallback — Lenis handles smooth)
     ============================================================ */
  $$("[data-scroll]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      var target = doc.querySelector(link.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      closeMenu();
      var navH = nav ? nav.offsetHeight : 0;
      var top = target.getBoundingClientRect().top + window.scrollY - navH + 4;
      if (reduceMotion || !window.__lenis) {
        window.scrollTo(0, top);
      } else {
        window.__lenis.scrollTo(target, { offset: -navH + 4 });
      }
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  /* ============================================================
     MENU TABS
     ============================================================ */
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

  /* ============================================================
     REVIEW SCORE COUNTERS + STARS
     ============================================================ */
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

  /* ============================================================
     GALLERY LIGHTBOX
     ============================================================ */
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
     GSAP + SCROLLTRIGGER + LENIS — Premium Motion System
     ============================================================ */
  function initPremiumMotion() {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
      // Fallback: just show everything
      $$(".hero-anim, .reveal, .reveal--mask, .hero-item").forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      $$(".reveal--mask .frame").forEach(function (f) {
        var after = f.querySelector("::after");
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    /* --- Lenis Smooth Scroll --- */
    if (!reduceMotion && typeof Lenis !== "undefined") {
      var lenis = new Lenis({
        duration: 1.2,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
        orientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      });
      window.__lenis = lenis;

      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);

      // Sync Lenis with anchor clicks
      $$("[data-scroll]").forEach(function (link) {
        link.addEventListener("click", function (e) {
          var target = doc.querySelector(link.getAttribute("href"));
          if (!target) return;
          e.preventDefault();
          closeMenu();
          lenis.scrollTo(target, { offset: -(nav ? nav.offsetHeight : 0) + 4 });
          history.replaceState(null, "", link.getAttribute("href"));
        });
      });
    }

    /* --- Hero Video Scroll Control --- */
    var heroVideo = $("#heroVideo");
    var hero = $("#home");
    var heroOverlay = $(".hero__overlay");
    var scrollCue = $(".hero__scroll");
    var progressBar = $(".hero__progress-bar");      if (heroVideo && hero) {
      // Start video muted so currentTime can be set (autoplay policy allows muted)
      heroVideo.play().then(function () {
        heroVideo.pause();
      }).catch(function () {});

      // Scroll-pinned hero sequence
      if (!reduceMotion) {
        var heroTl = gsap.timeline({
          scrollTrigger: {
            trigger: hero,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.5,
            pin: false,
            onUpdate: function (self) {
              var progress = self.progress;
              // Map scroll progress to video time
              var duration = heroVideo.duration;
              if (duration && isFinite(duration)) {
                heroVideo.currentTime = progress * duration;
              }
              // Ken Burns zoom on video
              var scale = 1.05 + progress * 0.1;
              heroVideo.style.transform = "scale(" + scale.toFixed(4) + ")";
              // Progress bar
              if (progressBar) progressBar.style.width = (progress * 100).toFixed(1) + "%";
              // Scroll cue
              if (scrollCue) {
                scrollCue.classList.toggle("is-hidden", progress > 0.05);
              }
              // Overlay intensity
              if (heroOverlay) {
                var overlayOpacity = 1 - progress * 0.3;
                heroOverlay.style.opacity = clamp(overlayOpacity, 0.4, 1).toFixed(3);
              }
            }
          }
        });
      } else {
        // Reduced motion: just play the video normally
        heroVideo.play().catch(function () {});
      }

      // Hero content parallax on scroll (separate from video)
      if (!reduceMotion) {
        var heroContent = $(".hero__content");
        if (heroContent) {
          gsap.to(heroContent, {
            y: -120,
            opacity: 0,
            ease: "none",
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: "60% top",
              scrub: 1,
            }
          });
        }
      }
    }

    /* --- Hero Entrance Animation --- */
    if (!reduceMotion) {
      var heroEntrance = gsap.timeline({
        delay: 0.6,
        paused: true,
        onStart: function () {
          body.classList.add("is-loaded");
        }
      });

      // Eyebrow slide up from below
      heroEntrance.fromTo(".hero__eyebrow",
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" },
        0
      );

      // Title lines reveal with clip-path
      heroEntrance.fromTo(".hero__title-line",
        { clipPath: "inset(100% 0 0 0)" },
        { clipPath: "inset(0% 0 0 0)", duration: 1.1, ease: "power3.out", stagger: 0.12 },
        0.15
      );

      // Title words slide up inside their lines
      heroEntrance.fromTo(".hero__title-word",
        { y: 80 },
        { y: 0, duration: 1.2, ease: "power3.out", stagger: 0.1 },
        0.2
      );

      // Subtitle fade up
      heroEntrance.fromTo(".hero__sub",
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" },
        0.5
      );

      // CTA buttons stagger in
      heroEntrance.fromTo(".hero__cta .btn",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: "power2.out", stagger: 0.1 },
        0.65
      );

      // Location line
      heroEntrance.fromTo(".hero__loc",
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" },
        0.85
      );

      // Scroll cue fade in
      heroEntrance.fromTo(".hero__scroll",
        { opacity: 0 },
        { opacity: 1, duration: 0.8, ease: "power2.out" },
        1.0
      );

      // Video fade in
      if (heroVideo) {
        heroEntrance.fromTo(heroVideo,
          { scale: 1.15, opacity: 0 },
          { scale: 1.05, opacity: 1, duration: 1.8, ease: "power2.out" },
          0
        );
      }

      // Play the entrance after preloader finishes
      var checkReady = setInterval(function () {
        if (preloaderDone) {
          clearInterval(checkReady);
          heroEntrance.play();
        }
      }, 50);
      // Safety: play after max wait
      setTimeout(function () {
        clearInterval(checkReady);
        if (heroEntrance.progress() === 0) heroEntrance.play();
      }, 3500);
    } else {
      // Reduced motion: just show everything
      body.classList.add("is-loaded");
      $$(".hero-anim").forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      if (heroVideo) heroVideo.style.opacity = "1";
    }

    /* --- Section Reveals --- */
    if (!reduceMotion) {
      // About section: text stagger + image mask
      ScrollTrigger.create({
        trigger: "#about",
        start: "top 80%",
        once: true,
        onEnter: function () {
          var aboutTl = gsap.timeline();
          aboutTl.fromTo("#about .eyebrow",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, ease: "power2.out" }
          );
          aboutTl.fromTo("#about .h-display",
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, ease: "power3.out" },
            "-=0.4"
          );
          aboutTl.fromTo("#about .intro__para",
            { y: 25, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, ease: "power2.out" },
            "-=0.5"
          );
          aboutTl.fromTo("#about .stat",
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, ease: "power2.out", stagger: 0.1 },
            "-=0.3"
          );
          // Image reveal
          var introFrame = $("#about .frame");
          if (introFrame) {
            gsap.fromTo(introFrame,
              { clipPath: "inset(0 100% 0 0)" },
              { clipPath: "inset(0 0% 0 0)", duration: 1.2, ease: "power3.inOut", delay: 0.3 }
            );
          }
        }
      });

      // Atmosphere section
      ScrollTrigger.create({
        trigger: "#atmosphere",
        start: "top 75%",
        once: true,
        onEnter: function () {
          var atmTl = gsap.timeline();
          atmTl.fromTo("#atmosphere .eyebrow",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
          );
          atmTl.fromTo("#atmosphere .h-display",
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
            "-=0.3"
          );
          // Stagger the atmosphere images
          $$("#atmosphere .atm").forEach(function (atm, i) {
            gsap.fromTo(atm,
              { y: 60, opacity: 0, scale: 0.95 },
              { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: "power2.out", delay: 0.2 + i * 0.12 }
            );
          });
          // Note
          gsap.fromTo("#atmosphere .atmosphere__note",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power2.out", delay: 0.8 }
          );
        }
      });

      // Menu section
      ScrollTrigger.create({
        trigger: "#menu",
        start: "top 80%",
        once: true,
        onEnter: function () {
          gsap.fromTo("#menu .eyebrow",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
          );
          gsap.fromTo("#menu .h-display",
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.1 }
          );
          gsap.fromTo("#menu .menu__note",
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.2 }
          );
          gsap.fromTo("#menu .menu__tabs",
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.3 }
          );
        }
      });

      // Picks section
      ScrollTrigger.create({
        trigger: "#picks",
        start: "top 75%",
        once: true,
        onEnter: function () {
          gsap.fromTo("#picks .eyebrow",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
          );
          gsap.fromTo("#picks .h-display",
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.1 }
          );
          $$("#picks .pick").forEach(function (pick, i) {
            gsap.fromTo(pick,
              { y: 50, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.8, ease: "power2.out", delay: 0.2 + i * 0.15 }
            );
          });
        }
      });

      // Reviews section
      ScrollTrigger.create({
        trigger: "#reviews",
        start: "top 80%",
        once: true,
        onEnter: function () {
          gsap.fromTo("#reviews .eyebrow",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
          );
          gsap.fromTo("#reviews .h-display",
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.1 }
          );
          gsap.fromTo("#reviews .reviews__score",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, ease: "power2.out", delay: 0.2 }
          );
          gsap.fromTo(".review",
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, ease: "power2.out", stagger: 0.12, delay: 0.3 }
          );
        }
      });

      // Gallery section
      ScrollTrigger.create({
        trigger: "#gallery",
        start: "top 80%",
        once: true,
        onEnter: function () {
          gsap.fromTo("#gallery .eyebrow",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
          );
          gsap.fromTo("#gallery .h-display",
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.1 }
          );
          $$(".g-item").forEach(function (item, i) {
            gsap.fromTo(item,
              { y: 40, opacity: 0, scale: 0.96 },
              { y: 0, opacity: 1, scale: 1, duration: 0.7, ease: "power2.out", delay: 0.15 + i * 0.06 }
            );
          });
        }
      });

      // Instagram section
      ScrollTrigger.create({
        trigger: "#instagram",
        start: "top 80%",
        once: true,
        onEnter: function () {
          gsap.fromTo("#instagram .eyebrow",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
          );
          gsap.fromTo("#instagram .h-display",
            { y: 40, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.1 }
          );
          $$(".ig-tile").forEach(function (tile, i) {
            gsap.fromTo(tile,
              { y: 30, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.2 + i * 0.06 }
            );
          });
        }
      });

      // Location section (calmer)
      ScrollTrigger.create({
        trigger: "#location",
        start: "top 80%",
        once: true,
        onEnter: function () {
          gsap.fromTo("#location .eyebrow",
            { y: 25, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, ease: "power2.out" }
          );
          gsap.fromTo("#location .h-display",
            { y: 35, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", delay: 0.1 }
          );
          $$(".loc-block").forEach(function (block, i) {
            gsap.fromTo(block,
              { y: 25, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.2 + i * 0.08 }
            );
          });
        }
      });

      // Parallax on images throughout the page
      $$("[data-parallax]").forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.08;
        gsap.to(el, {
          y: speed * -150,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: 1.5,
          }
        });
      });

      // Frame image reveal masks
      $$(".reveal--mask .frame").forEach(function (frame) {
        ScrollTrigger.create({
          trigger: frame,
          start: "top 85%",
          once: true,
          onEnter: function () {
            gsap.fromTo(frame,
              { clipPath: "inset(0 100% 0 0)" },
              { clipPath: "inset(0 0% 0 0)", duration: 1.1, ease: "power3.inOut" }
            );
          }
        });
      });

    } else {
      // Reduced motion: show all sections immediately
      $$(".hero-anim, .reveal, .reveal--mask, .hero-item").forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      $$(".reveal--mask .frame").forEach(function (f) {
        f.style.clipPath = "none";
      });
    }
  }

  /* ============================================================
     INIT — Wait for GSAP to load
     ============================================================ */
  function waitForGSAP(attempts) {
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      initPremiumMotion();
    } else if (attempts < 50) {
      setTimeout(function () { waitForGSAP(attempts + 1); }, 100);
    } else {
      // GSAP failed to load — graceful fallback
      $$(".hero-anim, .hero-item").forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      var hv = $("#heroVideo");
      if (hv) hv.style.opacity = "1";
      body.classList.add("is-loaded");
    }
  }

  // Start checking after preloader
  if (reduceMotion) {
    waitForGSAP(0);
  } else {
    // Wait for scripts to load
    if (typeof gsap !== "undefined") {
      waitForGSAP(0);
    } else {
      window.addEventListener("load", function () { waitForGSAP(0); });
    }
  }

})();
