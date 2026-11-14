(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduced = motionQuery.matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var narrowQuery = window.matchMedia("(max-width: 899px)");
  var narrow = narrowQuery.matches;
  var hero = document.querySelector("[data-hero]");
  var heroScene = document.querySelector(".hero-scene");
  var heroParallax = document.querySelector(".hero-parallax");
  var heroMid = document.querySelector(".hero-layer-mid");
  var heroNear = document.querySelector(".hero-layer-near");
  var heroContent = document.querySelector(".hero-content");
  var installParallax = document.querySelector(".install-parallax");
  var compareStory = document.querySelector(".compare-story");
  var compareFill = document.querySelector("[data-compare-fill]");
  var filmPin = document.querySelector("[data-film-pin]");
  var filmStage = document.querySelector("[data-film-stage]");
  var filmCards = filmPin ? Array.prototype.slice.call(filmPin.querySelectorAll("[data-film-card]")) : [];
  var progressEl = null;
  var ticking = false;

  if (header && !reduced) {
    progressEl = document.createElement("div");
    progressEl.className = "scroll-progress";
    progressEl.setAttribute("aria-hidden", "true");
    header.appendChild(progressEl);
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function clearDepth() {
    [heroScene, heroParallax, heroMid, heroNear, heroContent, installParallax].forEach(function (el) {
      if (el) el.style.transform = "";
    });
    document.querySelectorAll(".compare-bg, .compare-content").forEach(function (el) {
      el.style.transform = "";
    });
    if (compareFill) compareFill.style.transform = "";
    if (filmStage) filmStage.style.transform = "";
    filmCards.forEach(function (card) {
      card.style.transform = "";
      card.style.opacity = "";
      card.style.zIndex = "";
    });
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateOnScroll);
      ticking = true;
    }
  }

  function updateOnScroll() {
    var y = window.scrollY || window.pageYOffset;
    var viewH = window.innerHeight || document.documentElement.clientHeight;
    if (header) header.classList.toggle("is-scrolled", y > 24);

    if (progressEl) {
      var max = Math.max(1, document.documentElement.scrollHeight - viewH);
      progressEl.style.transform = "scaleX(" + (y / max) + ")";
    }

    if (!reduced) {
      if (hero && heroParallax) {
        var heroH = hero.offsetHeight || 1;
        var hp = clamp(y / heroH, 0, 1);
        heroParallax.style.transform = "translate3d(0," + (y * 0.22).toFixed(2) + "px,0) scale(" + (1.16 - hp * 0.14).toFixed(4) + ")";
        if (heroMid) heroMid.style.transform = "translate3d(0," + (y * 0.12).toFixed(2) + "px,0)";
        if (heroNear) heroNear.style.transform = "translate3d(0," + (y * 0.05).toFixed(2) + "px,0)";
        if (heroContent) heroContent.style.transform = "translate3d(0," + (hp * -16).toFixed(2) + "px,0)";
      }
      if (installParallax) {
        var rect = installParallax.parentElement.getBoundingClientRect();
        var progress = (viewH - rect.top) / (viewH + rect.height);
        var offset = (progress - 0.5) * 70;
        installParallax.style.transform = "translate3d(0," + offset.toFixed(2) + "px,0) scale(1.06)";
      }

      document.querySelectorAll(".compare-panel").forEach(function (panel) {
        var bg = panel.querySelector(".compare-bg");
        var copy = panel.querySelector(".compare-content");
        if (!bg) return;
        var prect = panel.getBoundingClientRect();
        var pp = clamp((viewH - prect.top) / (viewH + prect.height), 0, 1);
        bg.style.transform = "scale(" + (1.14 - pp * 0.1).toFixed(4) + ")";
        if (copy) copy.style.transform = "translate3d(0," + ((0.5 - pp) * 22).toFixed(2) + "px,0)";
      });

      if (compareStory && compareFill && !compareStory.hasAttribute("data-glass-story")) {
        var cr = compareStory.getBoundingClientRect();
        var total = Math.max(1, compareStory.offsetHeight - viewH * 0.35);
        var cp = clamp((viewH * 0.15 - cr.top) / total, 0, 1);
        compareFill.style.transform = "scaleX(" + cp.toFixed(4) + ")";
      }

      if (filmPin && filmCards.length && !narrow) {
        var fr = filmPin.getBoundingClientRect();
        var span = Math.max(1, filmPin.offsetHeight - viewH);
        var fp = clamp(-fr.top / span, 0, 1);
        if (filmStage) {
          filmStage.style.transform = "rotateX(" + ((0.45 - fp) * 6).toFixed(2) + "deg)";
        }
        filmCards.forEach(function (card, i) {
          var wave = Math.sin(fp * Math.PI + i * 0.55) * 16;
          var lift = Math.abs(i - fp * (filmCards.length - 1));
          card.style.transform = "translate3d(0," + wave.toFixed(1) + "px," + ((1.2 - lift) * 28).toFixed(1) + "px)";
          card.style.opacity = "";
          card.style.zIndex = String(8 - Math.round(lift));
        });
      } else if (filmCards.length) {
        if (filmStage) filmStage.style.transform = "";
        filmCards.forEach(function (card) {
          card.style.transform = "";
          card.style.opacity = "";
          card.style.zIndex = "";
        });
      }
    }
    ticking = false;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    narrow = narrowQuery.matches;
    onScroll();
  }, { passive: true });
  updateOnScroll();

  if (hero && finePointer) {
    hero.addEventListener("pointermove", function (e) {
      if (reduced || !heroScene) return;
      var r = hero.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      heroScene.style.transform = "rotateX(" + (-py * 3.2).toFixed(2) + "deg) rotateY(" + (px * 4).toFixed(2) + "deg)";
    });
    hero.addEventListener("pointerleave", function () {
      if (heroScene) heroScene.style.transform = "";
    });
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
      document.body.style.overflow = open ? "" : "hidden";
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
        document.body.style.overflow = "";
      });
    });
  }

  motionQuery.addEventListener("change", function (e) {
    reduced = e.matches;
    if (reduced) {
      clearDepth();
      if (progressEl) progressEl.remove();
      progressEl = null;
    } else if (header && !progressEl) {
      progressEl = document.createElement("div");
      progressEl.className = "scroll-progress";
      progressEl.setAttribute("aria-hidden", "true");
      header.appendChild(progressEl);
      updateOnScroll();
    }
  });

  /* —— Shatter comparison panels —— */
  function spawnShards(container, count) {
    if (!container) return;
    container.innerHTML = "";
    var i;
    for (i = 0; i < count; i++) {
      var shard = document.createElement("span");
      shard.className = "shard";
      var left = 35 + Math.random() * 30;
      var top = 30 + Math.random() * 30;
      var tx = (Math.random() - 0.5) * 220;
      var ty = 180 + Math.random() * 320;
      var rot = (Math.random() - 0.5) * 360;
      shard.style.left = left + "%";
      shard.style.top = top + "%";
      shard.style.setProperty("--tx", tx + "px");
      shard.style.setProperty("--ty", ty + "px");
      shard.style.setProperty("--rot", rot + "deg");
      shard.style.setProperty("--d", (Math.random() * 0.45) + "s");
      shard.style.setProperty("--sw", (16 + Math.random() * 28) + "px");
      shard.style.setProperty("--sh", (20 + Math.random() * 36) + "px");
      container.appendChild(shard);
    }
  }

  var panels = document.querySelectorAll(".compare-panel");
  panels.forEach(function (panel) {
    var shards = panel.querySelector(".shatter-shards");
    if (panel.classList.contains("is-without")) {
      spawnShards(shards, reduced ? 0 : 28);
    }

    if (reduced) {
      panel.classList.add("is-active");
      return;
    }

    var played = false;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
            if (!played) {
              played = true;
              panel.classList.add("is-active");
            }
          }
        });
      },
      { threshold: [0.35, 0.5, 0.65] }
    );
    io.observe(panel);
  });

  /* —— Installer carousel —— */
  var carousel = document.querySelector("[data-carousel]");
  if (carousel) {
    var track = carousel.querySelector(".carousel-track");
    var slides = Array.prototype.slice.call(carousel.querySelectorAll(".carousel-slide"));
    var dotsWrap = carousel.querySelector(".carousel-dots");
    var prevBtn = carousel.querySelector(".carousel-btn.prev");
    var nextBtn = carousel.querySelector(".carousel-btn.next");
    var index = 0;
    var timer = null;
    var autoMs = 5200;

    function goTo(i) {
      if (!slides.length) return;
      index = (i + slides.length) % slides.length;
      track.style.transform = "translate3d(" + (-index * 100) + "%,0,0)";
      slides.forEach(function (s, n) {
        s.setAttribute("aria-hidden", n === index ? "false" : "true");
      });
      if (dotsWrap) {
        Array.prototype.forEach.call(dotsWrap.children, function (dot, n) {
          dot.setAttribute("aria-current", n === index ? "true" : "false");
        });
      }
    }

    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    function stopAuto() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function startAuto() {
      stopAuto();
      if (reduced || slides.length < 2) return;
      timer = setInterval(next, autoMs);
    }

    if (dotsWrap) {
      slides.forEach(function (_, n) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "Go to slide " + (n + 1));
        b.addEventListener("click", function () {
          goTo(n);
          startAuto();
        });
        dotsWrap.appendChild(b);
      });
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { prev(); startAuto(); });
    if (nextBtn) nextBtn.addEventListener("click", function () { next(); startAuto(); });

    /* Swipe */
    var startX = 0;
    var deltaX = 0;
    var dragging = false;

    function onPointerDown(e) {
      dragging = true;
      startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      deltaX = 0;
      stopAuto();
      track.style.transition = "none";
    }

    function onPointerMove(e) {
      if (!dragging) return;
      var x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      deltaX = x - startX;
      var pct = (deltaX / carousel.offsetWidth) * 100;
      track.style.transform = "translate3d(" + (-index * 100 + pct) + "%,0,0)";
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      track.style.transition = "";
      if (Math.abs(deltaX) > 50) {
        if (deltaX < 0) next();
        else prev();
      } else {
        goTo(index);
      }
      startAuto();
    }

    carousel.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    carousel.addEventListener("touchstart", onPointerDown, { passive: true });
    carousel.addEventListener("touchmove", onPointerMove, { passive: true });
    carousel.addEventListener("touchend", onPointerUp);

    carousel.addEventListener("mouseenter", stopAuto);
    carousel.addEventListener("mouseleave", startAuto);

    goTo(0);
    startAuto();

    motionQuery.addEventListener("change", function () {
      if (reduced) stopAuto();
      else startAuto();
    });
  }

  /* —— Year + email placeholders (from assets/config.js) —— */
  var CFG = window.GHD_CONFIG || {};
  var QUOTE_EMAIL = CFG.QUOTE_EMAIL || "";
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
  if (QUOTE_EMAIL) {
    document.querySelectorAll("a[data-quote-email]").forEach(function (a) {
      a.href = "mailto:" + QUOTE_EMAIL;
    });
    document.querySelectorAll("[data-quote-email-text]").forEach(function (el) {
      el.textContent = QUOTE_EMAIL;
    });
  }

  /* —— Scroll reveal —— */
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var timelineOK = false;
  try { timelineOK = CSS.supports("animation-timeline: view()"); } catch (err) { timelineOK = false; }
  if (!timelineOK) {
    document.querySelectorAll(".section-head, .compare-intro").forEach(function (el) { reveals.push(el); });
  }
  if (reveals.length) {
    if (reduced || !("IntersectionObserver" in window)) {
      reveals.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      document.documentElement.classList.add("js-reveal");
      var rio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("is-visible"); rio.unobserve(en.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      reveals.forEach(function (el) { rio.observe(el); });
    }
  }

  /* Magnetic controls + card tilt. Pointer-fine only; cleared for reduced motion. */
  if (finePointer) {
    document.querySelectorAll(".btn, .nav-cta, .chip").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        if (reduced) return;
        var r = el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2);
        var y = e.clientY - (r.top + r.height / 2);
        el.style.transform = "translate3d(" + (x * 0.15).toFixed(2) + "px," + (y * 0.26).toFixed(2) + "px,0)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });

    document.querySelectorAll(".svc-card, .area-card, .step-card, .product-detail-media").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        if (reduced) return;
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = "perspective(900px) translateY(-6px) rotateX(" + (-py * 4.5).toFixed(2) + "deg) rotateY(" + (px * 5.5).toFixed(2) + "deg)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* —— Quote form —— */
  var form = document.querySelector("[data-quote-form]");
  if (form) {
    var statusEl = form.querySelector(".form-status");
    var thanks = document.querySelector(".form-thanks");
    var submitBtn = form.querySelector('button[type="submit"]');

    // Prefill from ?service=…&city=…
    try {
      var qs = new URLSearchParams(window.location.search);
      var svc = qs.get("service"), city = qs.get("city");
      if (svc) {
        var cb = form.querySelector('input[name="services"][data-slug="' + svc + '"]');
        if (cb) cb.checked = true;
      }
      if (city) {
        var opt = form.querySelector('select[name="city"] option[data-slug="' + city + '"]');
        if (opt) opt.selected = true;
      }
    } catch (err) {}

    function errFor(el) {
      if (el.name === "services" || el.name === "consent") return form.querySelector('.field-error[data-for="' + el.name + '"]');
      var lab = el.closest("label");
      return lab ? lab.querySelector(".field-error") : null;
    }
    function setErr(el, msg) {
      var e = errFor(el);
      if (e) e.textContent = msg || "";
      if (el.type !== "checkbox") el.setAttribute("aria-invalid", msg ? "true" : "false");
    }
    function validate() {
      var ok = true, first = null;
      function fail(el, msg) { setErr(el, msg); ok = false; if (!first) first = el; }
      var name = form.elements.name, email = form.elements.email, phone = form.elements.phone;
      var city = form.elements.city, ptype = form.elements.property_type, msg = form.elements.message;
      [name, email, phone, city, ptype, msg].forEach(function (el) { setErr(el, ""); });
      if (name.value.trim().length < 2) fail(name, "Please enter your name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) fail(email, "Please enter a valid email address.");
      var digits = phone.value.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) fail(phone, "Please enter a phone number with area code.");
      if (!city.value) fail(city, "Please choose your area.");
      var boxes = form.querySelectorAll('input[name="services"]');
      var anyChecked = Array.prototype.some.call(boxes, function (b) { return b.checked; });
      setErr(boxes[0], anyChecked ? "" : "Pick at least one service.");
      if (!anyChecked) { ok = false; if (!first) first = boxes[0]; }
      if (!ptype.value) fail(ptype, "Please choose a property type.");
      if (msg.value.trim().length < 10) fail(msg, "Please add a few details (at least 10 characters).");
      var consent = form.elements.consent;
      setErr(consent, consent.checked ? "" : "Please confirm we can contact you.");
      if (!consent.checked) { ok = false; if (!first) first = consent; }
      if (first) first.focus();
      return ok;
    }
    form.addEventListener("input", function (e) { if (e.target.getAttribute("aria-invalid") === "true") setErr(e.target, ""); });
    form.addEventListener("change", function (e) { if (e.target.type === "checkbox") setErr(e.target, ""); });

    function collect() {
      var fd = new FormData(form);
      var services = fd.getAll("services");
      return {
        name: (fd.get("name") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        phone: (fd.get("phone") || "").toString().trim(),
        city: (fd.get("city") || "").toString(),
        services: services.join(", "),
        property_type: (fd.get("property_type") || "").toString(),
        message: (fd.get("message") || "").toString().trim(),
        photo_note: (fd.get("photo_note") || "").toString().trim()
      };
    }
    function mailtoUrl(d) {
      var body = [
        "Name: " + d.name, "Email: " + d.email, "Phone: " + d.phone, "City: " + d.city,
        "Services: " + d.services, "Property type: " + d.property_type,
        "Photo note: " + (d.photo_note || "—"), "", d.message
      ].join("\n");
      return "mailto:" + QUOTE_EMAIL + "?subject=" + encodeURIComponent("Quote request — " + d.city + " — Guardian Home Defence") + "&body=" + encodeURIComponent(body);
    }
    function showThanks() {
      form.hidden = true;
      if (thanks) { thanks.hidden = false; thanks.focus(); }
    }
    function showFallback(d, why) {
      statusEl.className = "form-status is-error";
      statusEl.innerHTML = "";
      statusEl.appendChild(document.createTextNode((why || "We couldn't send your request online.") + " "));
      var a = document.createElement("a");
      a.href = mailtoUrl(d); a.className = "link";
      a.textContent = "Send it by email instead →";
      statusEl.appendChild(a);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.elements._honey && form.elements._honey.value) return; // bot
      if (!validate()) {
        statusEl.className = "form-status is-error";
        statusEl.textContent = "Please fix the highlighted fields.";
        return;
      }
      var d = collect();
      var endpoint = CFG.FORM_ENDPOINT || (QUOTE_EMAIL ? "https://formsubmit.co/ajax/" + encodeURIComponent(QUOTE_EMAIL) : "");
      if (!endpoint) { showFallback(d); return; }
      var payload = {
        name: d.name, email: d.email, phone: d.phone, city: d.city, services: d.services,
        property_type: d.property_type, message: d.message, photo_note: d.photo_note,
        _subject: "New quote request — " + d.city + " — Guardian Home Defence",
        _replyto: d.email, _template: "table", _captcha: "false"
      };
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
      statusEl.className = "form-status";
      statusEl.textContent = "";
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (res) {
        var j = res.j || {};
        var success = res.ok && (j.ok === true || j.success === true || j.success === "true");
        if (success) { showThanks(); }
        else { showFallback(d, j.message ? "Online sending isn't active yet." : null); }
      }).catch(function () {
        showFallback(d);
      }).then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send quote request";
      });
    });
  }
})();
