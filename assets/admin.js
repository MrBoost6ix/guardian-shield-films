/* Admin editing and published overrides.
   No-ops completely when assets/firebase-config.js still has placeholders,
   so the static site never depends on Firebase being configured.
   Images are stored in Firestore (not Cloud Storage) because new Storage
   buckets require the Blaze plan. See ADMIN.md. */
(function () {
  "use strict";

  var CFG = window.GHD_FIREBASE || {};
  var PLACEHOLDER_EMAIL = "dom@example.com";

  function configured() {
    if (!CFG.apiKey || !CFG.projectId || !CFG.appId) return false;
    if (String(CFG.apiKey).indexOf("YOUR_") === 0) return false;
    if (String(CFG.appId).indexOf("YOUR_") === 0) return false;
    if (String(CFG.projectId).indexOf("YOUR_") === 0) return false;
    return true;
  }

  if (!configured()) return;

  var SDK = "https://www.gstatic.com/firebasejs/11.10.0";
  var CHUNK = 480000;
  var VISITOR_CACHE_MS = 60000;

  function allowList() {
    return (window.GHD_ADMIN_EMAILS || [PLACEHOLDER_EMAIL]).map(function (email) {
      return String(email || "").trim().toLowerCase();
    }).filter(Boolean);
  }

  function isAllowListed(user) {
    if (!user || !user.email || user.emailVerified === false) return false;
    return allowList().indexOf(String(user.email).toLowerCase()) !== -1;
  }

  function useEmulator() {
    var host = location.hostname;
    var local = host === "localhost" || host === "127.0.0.1";
    var params = new URLSearchParams(location.search);
    return local && params.get("live") !== "1";
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "class") node.className = attrs[key];
      else if (key === "text") node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  boot().catch(function (err) {
    console.warn("Guardian admin unavailable. Showing built-in content.", err);
    showBanner("Couldn't reach Firestore. The built-in site content is showing.");
  });

  async function boot() {
    var appMod = await import(SDK + "/firebase-app.js");
    var authMod = await import(SDK + "/firebase-auth.js");
    var dbMod = await import(SDK + "/firebase-firestore.js");
    var app = appMod.initializeApp(CFG);
    var auth = authMod.getAuth(app);
    var db = dbMod.getFirestore(app);
    var emulator = useEmulator();
    if (emulator) {
      authMod.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      dbMod.connectFirestoreEmulator(db, "127.0.0.1", 8080);
      window.__ghdEmulatorSignIn = function (email) {
        return emulatorGoogleSignIn(authMod, auth, email);
      };
      window.__ghdSignInWithCustomToken = function (token) {
        return authMod.signInWithCustomToken(auth, token);
      };
    }

    var api = createApi(dbMod, db);
    var ui = createUi(authMod, auth, api);
    await api.loadPublished({ force: false });
    authMod.onAuthStateChanged(auth, function (user) {
      ui.setUser(user);
      if (user && isAllowListed(user)) api.loadDrafts().catch(function () {});
    });
    authMod.getRedirectResult(auth).catch(function () {});
  }

  function b64url(value) {
    return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function emulatorGoogleSignIn(authMod, auth, email) {
    var now = Math.floor(Date.now() / 1000);
    var header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
    var body = b64url(JSON.stringify({
      sub: email,
      email: email,
      email_verified: true,
      aud: CFG.projectId,
      iss: "https://accounts.google.com",
      iat: now,
      exp: now + 3600
    }));
    var credential = authMod.GoogleAuthProvider.credential(header + "." + body + ".emulator");
    return authMod.signInWithCredential(auth, credential);
  }

  function createApi(dbMod, db) {
    var doc = dbMod.doc;
    var getDoc = dbMod.getDoc;
    var setDoc = dbMod.setDoc;
    var deleteDoc = dbMod.deleteDoc;
    var runTransaction = dbMod.runTransaction;

    function publishedManifest() { return doc(db, "published", "manifest"); }
    function draftManifest() { return doc(db, "drafts", "manifest"); }
    function imageDoc(col, id) { return doc(db, col, id); }
    function partDoc(col, id, index) { return doc(db, col, id, "parts", String(index)); }

    function cache() {
      window.__GHD_CACHE = window.__GHD_CACHE || { texts: {}, images: {}, imageIndex: {}, rev: 0, savedAt: 0 };
      return window.__GHD_CACHE;
    }

    function saveCache() {
      var data = cache();
      data.savedAt = Date.now();
      try {
        localStorage.setItem("ghd-published-v1", JSON.stringify(data));
      } catch (err) {
        try {
          localStorage.setItem("ghd-published-v1", JSON.stringify({
            texts: data.texts,
            imageIndex: data.imageIndex,
            images: {},
            rev: data.rev,
            savedAt: data.savedAt,
            imagesOmitted: true
          }));
        } catch (err2) {}
      }
    }

    function idsOnPage(kind) {
      var seen = {};
      $all("[data-edit-id]").forEach(function (node) {
        if (kind && node.getAttribute("data-edit") !== kind) return;
        seen[node.getAttribute("data-edit-id")] = true;
      });
      return Object.keys(seen);
    }

    function restoreMedia(node) {
      if (node.getAttribute("data-edit") === "bg") {
        if (node.classList.contains("is-custom-bg")) {
          node.classList.remove("is-custom-bg");
          node.style.removeProperty("--hero-img");
        }
        return;
      }
      if (node.tagName === "IMG" && node.src && node.src.indexOf("data:") === 0) {
        var picture = node.closest("picture");
        if (picture && picture.__ghdDefaultHtml != null) picture.innerHTML = picture.__ghdDefaultHtml;
        else if (node.__ghdDefaultSrc) {
          node.src = node.__ghdDefaultSrc;
          if (node.__ghdDefaultAlt != null) node.alt = node.__ghdDefaultAlt;
        }
      }
    }

    function applyPublished() {
      var engine = window.GHDContent;
      var data = cache();
      if (!engine) return;
      $all("[data-edit-id]").forEach(function (node) {
        engine.remember(node);
        var id = node.getAttribute("data-edit-id");
        var kind = node.getAttribute("data-edit");
        if (kind === "text") {
          if (Object.prototype.hasOwnProperty.call(data.texts, id)) engine.writeValue(node, data.texts[id]);
          else if (node.__ghdDefault != null) engine.writeValue(node, node.__ghdDefault);
        }
        if (kind === "image" || kind === "bg") {
          if (data.images[id]) {
            var alt = data.imageIndex[id] && data.imageIndex[id].alt;
            engine.applyImageUrl(node, data.images[id], alt);
          } else if (!data.imageIndex[id]) restoreMedia(node);
        }
      });
    }

    async function readImage(col, id, meta) {
      var snap = await getDoc(imageDoc(col, id));
      if (!snap.exists()) return null;
      var data = snap.data() || {};
      var mime = data.mime || (meta && meta.mime) || "image/webp";
      var pieces = [];
      var count = data.chunks || 1;
      if (count <= 1) {
        if (!data.b64) return null;
        pieces = [data.b64];
      } else {
        var i;
        for (i = 0; i < count; i++) {
          var part = await getDoc(partDoc(col, id, i));
          if (!part.exists() || !part.data().b64) return null;
          pieces.push(part.data().b64);
        }
      }
      return {
        url: "data:" + mime + ";base64," + pieces.join(""),
        alt: data.alt || (meta && meta.alt) || "",
        w: data.w || (meta && meta.w) || 0,
        h: data.h || (meta && meta.h) || 0,
        mime: mime
      };
    }

    async function writeImage(col, id, payload) {
      var pieces = [];
      var i;
      for (i = 0; i < payload.b64.length; i += CHUNK) pieces.push(payload.b64.slice(i, i + CHUNK));
      if (pieces.length > 6) throw new Error("Image is still too large after compression.");
      await setDoc(imageDoc(col, id), {
        mime: payload.mime,
        alt: payload.alt || "",
        w: payload.w || 0,
        h: payload.h || 0,
        chunks: pieces.length,
        b64: pieces.length === 1 ? pieces[0] : ""
      });
      var p;
      for (p = 0; p < pieces.length; p++) {
        if (pieces.length === 1) await deleteDoc(partDoc(col, id, p)).catch(function () {});
        else await setDoc(partDoc(col, id, p), { b64: pieces[p] });
      }
      for (p = pieces.length; p < 6; p++) await deleteDoc(partDoc(col, id, p)).catch(function () {});
      return { chunks: pieces.length, mime: payload.mime, alt: payload.alt || "", w: payload.w || 0, h: payload.h || 0 };
    }

    async function deleteImage(col, id) {
      var p;
      for (p = 0; p < 6; p++) await deleteDoc(partDoc(col, id, p)).catch(function () {});
      await deleteDoc(imageDoc(col, id)).catch(function () {});
    }

    async function mutateManifest(which, fn) {
      var ref = which === "drafts" ? draftManifest() : publishedManifest();
      await runTransaction(db, async function (tx) {
        var snap = await tx.get(ref);
        var data = snap.exists() ? snap.data() : { texts: {}, imageIndex: {} };
        data.texts = Object.assign({}, data.texts || {});
        data.imageIndex = Object.assign({}, data.imageIndex || {});
        fn(data);
        data.rev = Date.now();
        tx.set(ref, data);
      });
    }

    async function loadPublished(options) {
      var data = cache();
      var fresh = data.savedAt && (Date.now() - data.savedAt) < VISITOR_CACHE_MS && !data.imagesOmitted;
      if (fresh && !(options && options.force)) {
        applyPublished();
        return;
      }
      var snap = await getDoc(publishedManifest());
      var remote = snap.exists() ? snap.data() : { texts: {}, imageIndex: {}, rev: 0 };
      data.texts = remote.texts || {};
      data.imageIndex = remote.imageIndex || {};
      data.rev = remote.rev || 0;
      var needed = idsOnPage("image").concat(idsOnPage("bg"));
      var id;
      for (var n = 0; n < needed.length; n++) {
        id = needed[n];
        if (!data.imageIndex[id]) {
          delete data.images[id];
          continue;
        }
        if (data.images[id] && !data.imagesOmitted && !(options && options.forceImages)) continue;
        var image = await readImage("publishedImages", id, data.imageIndex[id]);
        if (image) data.images[id] = image.url;
      }
      data.imagesOmitted = false;
      saveCache();
      applyPublished();
    }

    async function loadDrafts() {
      var snap = await getDoc(draftManifest());
      if (!snap.exists()) return;
      var remote = snap.data() || {};
      var engine = window.GHDContent;
      var data = cache();
      Object.keys(remote.texts || {}).forEach(function (id) {
        $all('[data-edit-id="' + cssEscape(id) + '"]').forEach(function (node) {
          if (engine) engine.writeValue(node, remote.texts[id]);
        });
      });
      var index = remote.imageIndex || {};
      for (var id in index) {
        if (!Object.prototype.hasOwnProperty.call(index, id)) continue;
        var image = await readImage("draftImages", id, index[id]);
        if (!image || !engine) continue;
        $all('[data-edit-id="' + cssEscape(id) + '"]').forEach(function (node) {
          engine.applyImageUrl(node, image.url, image.alt);
        });
      }
      data.__draftCount = Object.keys(remote.texts || {}).length + Object.keys(index).length;
      document.dispatchEvent(new CustomEvent("ghd-drafts", { detail: remote }));
    }

    return {
      loadPublished: loadPublished,
      loadDrafts: loadDrafts,
      mutateManifest: mutateManifest,
      writeImage: writeImage,
      deleteImage: deleteImage,
      cache: cache,
      saveCache: saveCache,
      applyPublished: applyPublished,
      publishedManifest: publishedManifest,
      draftManifest: draftManifest
    };
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  function createUi(authMod, auth, api) {
    var user = null;
    var editing = null;
    var banner = el("div", { class: "ghd-banner", role: "status" });
    banner.hidden = true;
    document.body.appendChild(banner);
    var bar = buildBar();
    document.body.appendChild(bar);
    var entry = el("button", { class: "admin-entry", type: "button", text: "Admin" });
    entry.addEventListener("click", onEntry);
    var footer = $(".footer-bottom");
    if (footer) footer.appendChild(entry);

    function showBanner(message) {
      if (!message) {
        banner.hidden = true;
        banner.textContent = "";
        return;
      }
      banner.hidden = false;
      banner.textContent = message;
    }
    window.__ghdBanner = showBanner;

    function buildBar() {
      var node = el("div", { class: "ghd-adminbar", hidden: "hidden" });
      node.appendChild(el("strong", { class: "ghd-adminbar-title", text: "Guardian admin" }));
      node.appendChild(el("span", { class: "ghd-adminbar-who", "data-admin-who": "" }));
      node.appendChild(el("span", { class: "ghd-adminbar-drafts", "data-admin-drafts": "" }));
      var actions = el("div", { class: "ghd-adminbar-actions" });
      actions.appendChild(button("Publish drafts", "data-admin-publish", publishDrafts));
      actions.appendChild(button("Discard drafts", "data-admin-discard", discardDrafts));
      actions.appendChild(button("Sign out", "data-admin-out", function () { authMod.signOut(auth); }));
      node.appendChild(actions);
      return node;
    }

    function button(label, attr, handler) {
      var node = el("button", { type: "button", class: "ghd-mini", text: label });
      node.setAttribute(attr, "");
      node.addEventListener("click", handler);
      return node;
    }

    function setUser(next) {
      user = next;
      var admin = isAllowListed(user);
      document.body.classList.toggle("is-admin", admin);
      document.body.classList.toggle("is-signed-in", !!user);
      bar.hidden = !user;
      entry.hidden = !!user;
      var who = $("[data-admin-who]", bar);
      if (!user) {
        who.textContent = "";
        clearButtons();
        return;
      }
      if (!admin) {
        who.textContent = user.email + " isn't on the admin allow-list.";
        $("[data-admin-publish]", bar).hidden = true;
        $("[data-admin-discard]", bar).hidden = true;
        clearButtons();
        return;
      }
      who.textContent = user.email;
      $("[data-admin-publish]", bar).hidden = false;
      $("[data-admin-discard]", bar).hidden = false;
      api.loadPublished({ force: true }).then(function () { return api.loadDrafts(); }).then(updateDraftCount).catch(function (err) {
        showBanner(err && err.code === "permission-denied" ? "Firestore denied this account." : "Couldn't load drafts.");
      });
      mountButtons();
      $all(".glass-slotbar").forEach(function (node) { node.setAttribute("aria-hidden", "false"); });
    }

    function updateDraftCount() {
      var label = $("[data-admin-drafts]", bar);
      var count = (api.cache().__draftCount) || 0;
      label.textContent = count ? count + (count === 1 ? " draft" : " drafts") : "No drafts";
    }

    document.addEventListener("ghd-drafts", function (event) {
      var remote = event.detail || {};
      api.cache().__draftCount = Object.keys(remote.texts || {}).length + Object.keys(remote.imageIndex || {}).length;
      updateDraftCount();
    });

    async function onEntry() {
      var provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      try {
        await authMod.signInWithPopup(auth, provider);
      } catch (err) {
        if (err && err.code === "auth/popup-blocked") {
          await authMod.signInWithRedirect(auth, provider);
          return;
        }
        if (err && err.code === "auth/popup-closed-by-user") return;
        showBanner("Google sign-in didn't complete. On localhost the Auth emulator must be running.");
      }
    }

    function mountButtons() {
      clearButtons();
      $all("[data-edit-id]").forEach(function (node) {
        if (node.getAttribute("data-edit-ui") === "slotbar") return;
        var host = node.tagName === "IMG" ? (node.closest("picture") || node.parentElement) : node;
        if (!host || host.querySelector(":scope > .ghd-edit-btn")) return;
        if (getComputedStyle(host).position === "static") host.style.position = "relative";
        var kind = node.getAttribute("data-edit");
        var control = el("button", {
          type: "button",
          class: "ghd-edit-btn",
          text: kind === "text" ? "✎" : "↑",
          "aria-label": kind === "text" ? "Edit text" : "Replace image"
        });
        control.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          if (kind === "text") beginText(node);
          else beginImage(node);
        });
        host.appendChild(control);
      });
      $all("[data-glass-replace]").forEach(function (control) {
        if (control.__ghdBound) return;
        control.__ghdBound = true;
        control.addEventListener("click", function () {
          var target = document.querySelector('[data-edit-id="' + cssEscape(control.getAttribute("data-glass-replace")) + '"]');
          if (target) beginImage(target);
        });
      });
    }

    function clearButtons() {
      $all(".ghd-edit-btn").forEach(function (node) { node.remove(); });
      closeEditor();
    }

    function closeEditor() {
      if (!editing) return;
      editing.el.removeAttribute("contenteditable");
      editing.el.classList.remove("is-editing");
      if (editing.popover) editing.popover.remove();
      editing = null;
    }

    function beginText(node) {
      closeEditor();
      var engine = window.GHDContent;
      engine.remember(node);
      var before = engine.readValue(node);
      var signature = elementSignature(node);
      node.setAttribute("contenteditable", "true");
      node.classList.add("is-editing");
      node.focus();
      var pop = editorPopover(node, async function (action) {
        if (action === "cancel") {
          engine.writeValue(node, before);
          closeEditor();
          return;
        }
        if (elementSignature(node) !== signature) {
          showBanner("Only the words can change. Icons and links stay put — press Cancel and try again.");
          return;
        }
        var value = engine.readValue(node);
        if (!validText(value)) {
          showBanner("That text is too long to store.");
          return;
        }
        var id = node.getAttribute("data-edit-id");
        if (action === "reset") {
          if (!(await confirmDialog("Reset this text to the original wording?"))) return;
          await api.mutateManifest("published", function (data) { delete data.texts[id]; });
          await api.mutateManifest("drafts", function (data) { delete data.texts[id]; });
          delete api.cache().texts[id];
          api.saveCache();
          engine.writeValue(node, node.__ghdDefault);
          closeEditor();
          showBanner("Restored the original text.");
          return;
        }
        var publishing = action === "publish";
        var ok = await confirmDialog(publishing
          ? "Publish this text so every visitor sees it?"
          : "Save this as a private draft? Visitors won't see it until you publish drafts.");
        if (!ok) return;
        await api.mutateManifest(publishing ? "published" : "drafts", function (data) {
          data.texts[id] = value;
        });
        if (publishing) {
          api.cache().texts[id] = value;
          api.saveCache();
          await api.mutateManifest("drafts", function (data) { delete data.texts[id]; });
        }
        closeEditor();
        showBanner(publishing ? "Published." : "Draft saved.");
        api.loadDrafts().catch(function () {});
      });
      editing = { el: node, popover: pop };
    }

    function editorPopover(anchor, onAction) {
      var pop = el("div", { class: "ghd-popover", role: "toolbar" });
      [["Save draft", "draft"], ["Publish", "publish"], ["Reset to default", "reset"], ["Cancel", "cancel"]].forEach(function (pair) {
        var control = el("button", { type: "button", class: "ghd-mini" + (pair[1] === "publish" ? " is-primary" : ""), text: pair[0] });
        control.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          onAction(pair[1]).catch(function (err) {
            showBanner(err && err.code === "permission-denied" ? "Firestore denied that save." : "The save didn't go through.");
          });
        });
        pop.appendChild(control);
      });
      document.body.appendChild(pop);
      placePopover(pop, anchor);
      return pop;
    }

    function placePopover(pop, anchor) {
      var rect = anchor.getBoundingClientRect();
      pop.style.top = Math.min(window.innerHeight - 64, rect.bottom + 8) + "px";
      pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, rect.left)) + "px";
    }

    function beginImage(node) {
      closeEditor();
      var input = el("input", { type: "file", accept: "image/*" });
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (file) openCrop(node, file).catch(function (err) { showBanner(err.message || "Couldn't read that image."); });
      });
      input.click();
    }

    async function openCrop(node, file) {
      var bitmap = await loadBitmap(file);
      var aspect = aspectOf(node);
      var maxW = parseInt(node.getAttribute("data-edit-max") || "1920", 10) || 1920;
      var dialog = el("div", { class: "ghd-modal", role: "dialog", "aria-modal": "true", "aria-label": "Crop image" });
      var frame = el("div", { class: "ghd-crop-frame" });
      var preview = el("canvas", { class: "ghd-crop-canvas" });
      frame.appendChild(preview);
      var zoom = el("input", { type: "range", min: "1", max: "4", step: "0.01", value: "1", "aria-label": "Zoom" });
      var altInput = el("input", { type: "text", value: node.getAttribute("alt") || "", maxlength: "300", "aria-label": "Image description" });
      var actions = el("div", { class: "ghd-modal-actions" });
      dialog.appendChild(el("p", { class: "ghd-modal-title", text: "Fit the photo to this slot" }));
      dialog.appendChild(frame);
      dialog.appendChild(el("label", { class: "ghd-zoom-label", text: "Zoom" }));
      dialog.appendChild(zoom);
      dialog.appendChild(el("label", { class: "ghd-zoom-label", text: "Description" }));
      dialog.appendChild(altInput);
      dialog.appendChild(actions);
      document.body.appendChild(dialog);

      var frameW = Math.min(720, window.innerWidth - 48);
      var frameH = frameW / aspect;
      if (frameH > window.innerHeight * 0.55) {
        frameH = window.innerHeight * 0.55;
        frameW = frameH * aspect;
      }
      frame.style.width = frameW + "px";
      frame.style.height = frameH + "px";
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      preview.width = Math.round(frameW * dpr);
      preview.height = Math.round(frameH * dpr);
      var ctx = preview.getContext("2d");
      var natW = bitmap.width;
      var natH = bitmap.height;
      var zoomValue = 1;
      var offsetX = 0;
      var offsetY = 0;

      function baseScale() {
        return Math.max(frameW / natW, frameH / natH);
      }
      function clampOffset() {
        var scale = baseScale() * zoomValue;
        var drawnW = natW * scale;
        var drawnH = natH * scale;
        offsetX = Math.min(0, Math.max(frameW - drawnW, offsetX));
        offsetY = Math.min(0, Math.max(frameH - drawnH, offsetY));
      }
      function draw() {
        clampOffset();
        var scale = baseScale() * zoomValue;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, frameW, frameH);
        ctx.drawImage(bitmap, offsetX, offsetY, natW * scale, natH * scale);
      }
      draw();
      zoom.addEventListener("input", function () {
        zoomValue = parseFloat(zoom.value) || 1;
        draw();
      });
      var drag = null;
      frame.addEventListener("pointerdown", function (event) {
        drag = { x: event.clientX, y: event.clientY, ox: offsetX, oy: offsetY };
        frame.setPointerCapture(event.pointerId);
      });
      frame.addEventListener("pointermove", function (event) {
        if (!drag) return;
        offsetX = drag.ox + (event.clientX - drag.x);
        offsetY = drag.oy + (event.clientY - drag.y);
        draw();
      });
      function endDrag() { drag = null; }
      frame.addEventListener("pointerup", endDrag);
      frame.addEventListener("pointercancel", endDrag);

      function close() {
        dialog.remove();
        if (bitmap.close) bitmap.close();
      }
      actions.appendChild(actionButton("Cancel", function () { close(); }));
      actions.appendChild(actionButton("Reset to default", function () {
        resetImage(node).then(close).catch(function (err) {
          showBanner(err && err.code === "permission-denied" ? "Firestore denied that reset." : "Reset didn't go through.");
        });
      }));
      actions.appendChild(actionButton("Save draft", function () {
        finishCrop(false);
      }));
      actions.appendChild(actionButton("Publish", function () {
        finishCrop(true);
      }, true));

      async function finishCrop(publishing) {
        var ok = await confirmDialog(publishing
          ? "Publish this image so every visitor sees it?"
          : "Save this image as a private draft?");
        if (!ok) return;
        var blob = await exportCrop(bitmap, {
          aspect: aspect,
          maxW: maxW,
          frameW: frameW,
          frameH: frameH,
          offsetX: offsetX,
          offsetY: offsetY,
          scale: baseScale() * zoomValue
        });
        var b64 = await blobToB64(blob);
        var id = node.getAttribute("data-edit-id");
        var alt = altInput.value.trim();
        var meta = await api.writeImage(publishing ? "publishedImages" : "draftImages", id, {
          b64: b64,
          mime: blob.type || "image/webp",
          alt: alt,
          w: blob.__w,
          h: blob.__h
        });
        await api.mutateManifest(publishing ? "published" : "drafts", function (data) {
          data.imageIndex[id] = meta;
        });
        if (publishing) {
          var url = "data:" + meta.mime + ";base64," + b64;
          api.cache().images[id] = url;
          api.cache().imageIndex[id] = meta;
          api.saveCache();
          await api.mutateManifest("drafts", function (data) { delete data.imageIndex[id]; });
          await api.deleteImage("draftImages", id);
          window.GHDContent.applyImageUrl(node, url, alt);
          $all('[data-edit-id="' + cssEscape(id) + '"]').forEach(function (other) {
            if (other !== node) window.GHDContent.applyImageUrl(other, url, alt);
          });
        }
        close();
        showBanner(publishing ? "Image published." : "Image draft saved.");
        api.loadDrafts().catch(function () {});
      }
    }

    async function resetImage(node) {
      if (!(await confirmDialog("Remove the replacement and restore the original image?"))) return;
      var id = node.getAttribute("data-edit-id");
      await api.mutateManifest("published", function (data) { delete data.imageIndex[id]; });
      await api.mutateManifest("drafts", function (data) { delete data.imageIndex[id]; });
      await api.deleteImage("publishedImages", id);
      await api.deleteImage("draftImages", id);
      delete api.cache().images[id];
      delete api.cache().imageIndex[id];
      api.saveCache();
      $all('[data-edit-id="' + cssEscape(id) + '"]').forEach(function (target) {
        if (target.getAttribute("data-edit") === "bg") {
          target.classList.remove("is-custom-bg");
          target.style.removeProperty("--hero-img");
          return;
        }
        var picture = target.closest("picture");
        if (picture && picture.__ghdDefaultHtml != null) {
          picture.innerHTML = picture.__ghdDefaultHtml;
          return;
        }
        if (target.__ghdDefaultSrc) target.src = target.__ghdDefaultSrc;
        if (target.__ghdDefaultAlt != null) target.alt = target.__ghdDefaultAlt;
      });
      showBanner("Original image restored.");
      mountButtons();
    }

    async function publishDrafts() {
      if (!(await confirmDialog("Publish every draft to the live site?"))) return;
      showBanner("Publishing drafts…");
      try {
        var remote = await readDraftManifest();
        var texts = remote.texts || {};
        var index = remote.imageIndex || {};
        var id;
        for (id in texts) {
          if (Object.prototype.hasOwnProperty.call(texts, id)) {
            var value = texts[id];
            await api.mutateManifest("published", function (data) { data.texts[id] = value; });
            api.cache().texts[id] = value;
          }
        }
        for (id in index) {
          if (!Object.prototype.hasOwnProperty.call(index, id)) continue;
          await copyDraftImage(id, index[id]);
        }
        await api.mutateManifest("drafts", function (data) {
          data.texts = {};
          data.imageIndex = {};
        });
        api.saveCache();
        api.applyPublished();
        api.cache().__draftCount = 0;
        updateDraftCount();
        showBanner("Drafts published.");
      } catch (err) {
        showBanner(err && err.code === "permission-denied" ? "Firestore denied that publish." : "Publishing drafts didn't finish.");
      }
      dbMod = null;
    }

    async function readDraftManifest() {
      var mod = await import(SDK + "/firebase-firestore.js");
      var appMod = await import(SDK + "/firebase-app.js");
      var db = mod.getFirestore(appMod.getApp());
      var snap = await mod.getDoc(mod.doc(db, "drafts", "manifest"));
      return snap.exists() ? snap.data() : { texts: {}, imageIndex: {} };
    }

    async function copyDraftImage(id, meta) {
      var mod = await import(SDK + "/firebase-firestore.js");
      var appMod = await import(SDK + "/firebase-app.js");
      var db = mod.getFirestore(appMod.getApp());
      var snap = await mod.getDoc(mod.doc(db, "draftImages", id));
      if (!snap.exists()) return;
      var data = snap.data();
      var b64 = data.b64 || "";
      if ((data.chunks || 1) > 1) {
        var parts = [];
        var i;
        for (i = 0; i < data.chunks; i++) {
          var part = await mod.getDoc(mod.doc(db, "draftImages", id, "parts", String(i)));
          parts.push(part.exists() ? part.data().b64 : "");
        }
        b64 = parts.join("");
      }
      var written = await api.writeImage("publishedImages", id, {
        b64: b64,
        mime: data.mime,
        alt: data.alt,
        w: data.w,
        h: data.h
      });
      await api.mutateManifest("published", function (manifest) { manifest.imageIndex[id] = written; });
      api.cache().images[id] = "data:" + written.mime + ";base64," + b64;
      api.cache().imageIndex[id] = written;
      await api.deleteImage("draftImages", id);
    }

    async function discardDrafts() {
      if (!(await confirmDialog("Discard drafts and go back to the published site?"))) return;
      var remote = await readDraftManifest();
      var id;
      for (id in (remote.imageIndex || {})) {
        if (Object.prototype.hasOwnProperty.call(remote.imageIndex, id)) await api.deleteImage("draftImages", id);
      }
      await api.mutateManifest("drafts", function (data) {
        data.texts = {};
        data.imageIndex = {};
      });
      await api.loadPublished({ force: true, forceImages: true });
      api.cache().__draftCount = 0;
      updateDraftCount();
      showBanner("Drafts discarded.");
    }

    return { setUser: setUser, showBanner: showBanner };
  }

  function showBanner(message) {
    if (window.__ghdBanner) window.__ghdBanner(message);
  }

  function elementSignature(node) {
    return $all("*", node).map(function (child) { return child.tagName; }).join(",");
  }

  function validText(value) {
    if (typeof value === "string") return value.length <= 4000;
    if (!Array.isArray(value) || value.length > 24) return false;
    return value.every(function (part) { return String(part).length <= 4000; });
  }

  function aspectOf(node) {
    var rect = node.getBoundingClientRect();
    if (rect.width > 8 && rect.height > 8) return rect.width / rect.height;
    var w = parseFloat(node.getAttribute("width")) || node.naturalWidth || 16;
    var h = parseFloat(node.getAttribute("height")) || node.naturalHeight || 9;
    return w / h || 1;
  }

  function actionButton(label, handler, primary) {
    var control = el("button", { type: "button", class: "ghd-mini" + (primary ? " is-primary" : ""), text: label });
    control.addEventListener("click", function () { handler(); });
    return control;
  }

  function confirmDialog(message) {
    return new Promise(function (resolve) {
      var dialog = el("div", { class: "ghd-modal ghd-confirm", role: "dialog", "aria-modal": "true" });
      dialog.appendChild(el("p", { text: message }));
      var actions = el("div", { class: "ghd-modal-actions" });
      var no = actionButton("Go back", function () { dialog.remove(); resolve(false); });
      var yes = actionButton("Confirm", function () { dialog.remove(); resolve(true); }, true);
      actions.appendChild(no);
      actions.appendChild(yes);
      dialog.appendChild(actions);
      document.body.appendChild(dialog);
      yes.focus();
    });
  }

  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () {
        return loadImageElement(file);
      });
    }
    return loadImageElement(file);
  }

  function loadImageElement(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file isn't an image this browser can open.")); };
      img.src = url;
    });
  }

  async function exportCrop(bitmap, geom) {
    var outW = Math.min(geom.maxW, Math.max(1, Math.round(geom.frameW / geom.scale * (geom.frameW / geom.frameW))));
    outW = Math.min(geom.maxW, Math.max(1, Math.round(geom.frameW / geom.scale)));
    var outH = Math.max(1, Math.round(outW / geom.aspect));
    var canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    var ctx = canvas.getContext("2d");
    var sx = Math.max(0, -geom.offsetX / geom.scale);
    var sy = Math.max(0, -geom.offsetY / geom.scale);
    var sw = geom.frameW / geom.scale;
    var sh = geom.frameH / geom.scale;
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);
    var quality = 0.82;
    var blob = await canvasToBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", quality);
    while (blob && blob.size > 480000 && quality > 0.5) {
      quality -= 0.08;
      var next = await canvasToBlob(canvas, blob.type || "image/webp", quality);
      if (!next) break;
      blob = next;
    }
    if (blob && blob.size > 700000) {
      canvas.width = Math.round(outW * 0.75);
      canvas.height = Math.round(outH * 0.75);
      ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      blob = await canvasToBlob(canvas, "image/webp", 0.7) || await canvasToBlob(canvas, "image/jpeg", 0.7);
      outW = canvas.width;
      outH = canvas.height;
    }
    if (!blob) throw new Error("This browser couldn't compress the image.");
    blob.__w = outW;
    blob.__h = outH;
    return blob;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
    });
  }

  function blobToB64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var value = String(reader.result || "");
        var comma = value.indexOf(",");
        resolve(comma >= 0 ? value.slice(comma + 1) : value);
      };
      reader.onerror = function () { reject(new Error("Couldn't encode the image.")); };
      reader.readAsDataURL(blob);
    });
  }
})();
