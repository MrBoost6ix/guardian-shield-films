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

  /* Contact form: open mailto with fields */
  var form = document.querySelector("[data-quote-form]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var name = (fd.get("name") || "").toString().trim();
      var email = (fd.get("email") || "").toString().trim();
      var phone = (fd.get("phone") || "").toString().trim();
      var interest = (fd.get("interest") || "").toString().trim();
      var message = (fd.get("message") || "").toString().trim();
      var body = [
        "Name: " + name,
        "Email: " + email,
        "Phone: " + phone,
        "Interest: " + interest,
        "",
        message
      ].join("\n");
      var url =
        "mailto:hello@shieldfilms.ca?subject=" +
        encodeURIComponent("Quote request — Guardian Shield Films") +
        "&body=" +
        encodeURIComponent(body);
      window.location.href = url;
    });
  }
})();
