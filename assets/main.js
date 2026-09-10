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
})();
