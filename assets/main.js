(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var heroParallax = document.querySelector(".hero-parallax");
  var installParallax = document.querySelector(".install-parallax");
  var ticking = false;

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateOnScroll);
      ticking = true;
    }
  }

  function updateOnScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle("is-scrolled", y > 24);

    if (!reduced) {
      if (heroParallax) {
        heroParallax.style.transform = "translate3d(0," + (y * 0.35) + "px,0)";
      }
      if (installParallax) {
        var rect = installParallax.parentElement.getBoundingClientRect();
        var viewH = window.innerHeight || document.documentElement.clientHeight;
        var progress = (viewH - rect.top) / (viewH + rect.height);
        var offset = (progress - 0.5) * 80;
        installParallax.style.transform = "translate3d(0," + offset + "px,0)";
      }
    }
    ticking = false;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  updateOnScroll();

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

  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", function (e) {
    reduced = e.matches;
    if (reduced) {
      if (heroParallax) heroParallax.style.transform = "";
      if (installParallax) installParallax.style.transform = "";
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
  var reveals = document.querySelectorAll(".reveal");
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
