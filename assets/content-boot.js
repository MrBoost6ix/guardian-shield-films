/* Apply cached content overrides as the HTML is parsed, before first paint.
   Firestore is not contacted here. If there is no cache, the built-in
   copy and images stay exactly as authored. */
(function () {
  "use strict";

  try {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.classList.add("js-glass");
    }
  } catch (err) {}

  var cache = null;
  try {
    cache = JSON.parse(localStorage.getItem("ghd-published-v1") || "null");
  } catch (err) {
    cache = null;
  }
  if (!cache || typeof cache !== "object") cache = { texts: {}, images: {}, imageIndex: {} };
  cache.texts = cache.texts || {};
  cache.images = cache.images || {};
  cache.imageIndex = cache.imageIndex || {};
  window.__GHD_CACHE = cache;

  function textNodes(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("[data-year], .req, .field-error, .form-status")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.nodeValue || !String(node.nodeValue).trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function readValue(el) {
    var nodes = textNodes(el);
    if (!nodes.length) return "";
    if (nodes.length === 1) return nodes[0].nodeValue;
    return nodes.map(function (node) { return node.nodeValue; });
  }

  function writeValue(el, value) {
    if (value == null) return;
    var nodes = textNodes(el);
    if (typeof value === "string") {
      if (!el.querySelector("*")) {
        el.textContent = value;
        return;
      }
      if (nodes[0]) nodes[0].nodeValue = value;
      return;
    }
    if (Array.isArray(value)) {
      for (var i = 0; i < nodes.length && i < value.length; i++) {
        if (value[i] != null) nodes[i].nodeValue = String(value[i]);
      }
    }
  }

  function remember(el) {
    if (el.__ghdReady) return;
    var kind = el.getAttribute("data-edit");
    if (kind === "text") el.__ghdDefault = readValue(el);
    if (kind === "image") {
      var picture = el.closest("picture");
      if (picture && picture.__ghdDefaultHtml == null) picture.__ghdDefaultHtml = picture.innerHTML;
      el.__ghdDefaultSrc = el.getAttribute("src") || "";
      el.__ghdDefaultAlt = el.getAttribute("alt") || "";
    }
    if (kind === "bg") el.__ghdDefaultBg = el.getAttribute("data-bg") || "";
    el.__ghdReady = true;
  }

  function applyImageUrl(el, url, alt) {
    if (!url) return;
    if (el.getAttribute("data-edit") === "bg") {
      el.style.setProperty("--hero-img", "url(\"" + String(url).replace(/"/g, "%22") + "\")");
      el.classList.add("is-custom-bg");
      return;
    }
    var picture = el.closest("picture");
    if (picture) {
      picture.querySelectorAll("source").forEach(function (source) { source.remove(); });
    }
    if (el.tagName === "IMG") {
      el.src = url;
      if (alt != null && alt !== "") el.alt = alt;
    }
  }

  function applyElement(el) {
    remember(el);
    var id = el.getAttribute("data-edit-id");
    if (!id || !cache) return;
    var kind = el.getAttribute("data-edit");
    if (kind === "text" && Object.prototype.hasOwnProperty.call(cache.texts, id)) {
      writeValue(el, cache.texts[id]);
    }
    if ((kind === "image" || kind === "bg") && cache.images[id]) {
      var alt = cache.imageIndex[id] && cache.imageIndex[id].alt;
      applyImageUrl(el, cache.images[id], alt);
    }
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches("[data-edit-id]")) applyElement(root);
    root.querySelectorAll("[data-edit-id]").forEach(applyElement);
  }

  var observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) scan(node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", function () {
    scan(document);
    observer.disconnect();
  });

  window.GHDContent = {
    textNodes: textNodes,
    readValue: readValue,
    writeValue: writeValue,
    remember: remember,
    applyImageUrl: applyImageUrl,
    applyElement: applyElement,
    scan: scan
  };
})();
