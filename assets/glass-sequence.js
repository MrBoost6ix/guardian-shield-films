/* Scroll-scrubbed patio-door sequence.
   Intact wide shot → strike → unprotected glass explodes toward the camera
   → the same door again → strike → filmed glass holds → macro punch-in.
   Reduced motion never reaches this file's animation: the static
   before/after block stays on screen and this script returns immediately. */
(function () {
  "use strict";

  var story = document.querySelector("[data-glass-story]");
  if (!story) return;

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var narrowQuery = window.matchMedia("(max-width: 700px)");
  var scrollEl = story.querySelector("[data-glass-scroll]");
  var stage = story.querySelector("[data-glass-stage]");
  var shakeEl = story.querySelector("[data-glass-shake]");
  var canvas = story.querySelector("[data-glass-canvas]");
  var cracks = story.querySelector("[data-glass-cracks]");
  var flashEl = story.querySelector("[data-glass-flash]");
  var sheenEl = story.querySelector("[data-glass-sheen]");
  var glowEl = story.querySelector("[data-glass-glow]");
  var liveEl = story.querySelector("[data-glass-live]");
  var soundBtn = story.querySelector("[data-glass-sound]");
  var layers = {
    before: story.querySelector('[data-glass="before"]'),
    shatter: story.querySelector('[data-glass="shatter"]'),
    held: story.querySelector('[data-glass="held"]'),
    macro: story.querySelector('[data-glass="macro"]')
  };
  var copies = {
    without: story.querySelector('[data-glass-copy="without"]'),
    with: story.querySelector('[data-glass-copy="with"]')
  };
  var fills = story.querySelectorAll("[data-compare-fill]");

  var IMPACT_BEFORE = { x: 0.735, y: 0.30 };
  var IMPACT_SHATTER = { x: 0.50, y: 0.46 };
  var IMPACT_HELD = { x: 0.60, y: 0.40 };
  var IMG_W = 1280;
  var IMG_H = 720;

  var reduced = motionQuery.matches;
  var running = false;
  var raf = 0;
  var ticking = false;
  var lastPhase = "";
  var prevT = 0;
  var soundOn = false;
  var audioCtx = null;
  var shardBudget = 0;
  var shards = [];
  var sparks = [];
  var crackPaths = [];
  var cover = null;
  var canvasCssW = 0;
  var canvasCssH = 0;
  var slowFrames = 0;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeShards(count, seed) {
    var rand = mulberry32(seed);
    var list = [];
    var i;
    for (i = 0; i < count; i++) {
      var ang = rand() * Math.PI * 2;
      var speed = 0.25 + rand() * 0.95;
      list.push({
        ox: (rand() - 0.5) * 0.05,
        oy: (rand() - 0.5) * 0.04,
        vx: Math.cos(ang) * speed * (0.22 + rand() * 0.38),
        vy: Math.sin(ang) * speed * 0.16 - 0.04,
        vz: 0.45 + rand() * 1.25,
        rot: rand() * Math.PI,
        vr: (rand() - 0.5) * 7,
        size: 5 + rand() * (narrowQuery.matches ? 16 : 26),
        delay: rand() * 0.12,
        tone: rand()
      });
    }
    return list;
  }

  function makeCracks(origin, count, seed) {
    var rand = mulberry32(seed);
    var list = [];
    var c;
    for (c = 0; c < count; c++) {
      var ang = (Math.PI * 2 * c) / count + (rand() - 0.5) * 0.4;
      var x = origin.x;
      var y = origin.y;
      var pts = [[x, y]];
      var depth = 5 + Math.floor(rand() * 4);
      var d;
      for (d = 0; d < depth; d++) {
        ang += (rand() - 0.5) * 0.7;
        var len = 0.035 + rand() * 0.055;
        x = clamp(x + Math.cos(ang) * len, 0.02, 0.98);
        y = clamp(y + Math.sin(ang) * len * 0.72, 0.02, 0.98);
        pts.push([x, y]);
        if (rand() > 0.72) {
          var branch = ang + (rand() > 0.5 ? 0.6 : -0.6);
          var bx = x + Math.cos(branch) * (0.03 + rand() * 0.04);
          var by = y + Math.sin(branch) * 0.03;
          pts.push([bx, by]);
          pts.push([x, y]);
        }
      }
      list.push(pts);
    }
    return list;
  }

  function buildCracks() {
    if (!cracks) return;
    crackPaths = makeCracks(IMPACT_BEFORE, narrowQuery.matches ? 10 : 16, 0x51a11);
    var svg = "";
    crackPaths.forEach(function (pts) {
      var d = pts.map(function (p, i) {
        return (i ? "L" : "M") + (p[0] * 160).toFixed(2) + " " + (p[1] * 90).toFixed(2);
      }).join(" ");
      svg += '<path d="' + d + '" pathLength="1" />';
    });
    cracks.innerHTML = svg;
  }

  function coverMap(stageW, stageH) {
    var ir = IMG_W / IMG_H;
    var sr = stageW / Math.max(1, stageH);
    var dw;
    var dh;
    var ox;
    var oy;
    if (sr > ir) {
      dw = stageW;
      dh = stageW / ir;
      ox = 0;
      oy = (stageH - dh) / 2;
    } else {
      dh = stageH;
      dw = stageH * ir;
      oy = 0;
      ox = (stageW - dw) / 2;
    }
    return { ox: ox, oy: oy, dw: dw, dh: dh };
  }

  function resizeCanvas() {
    if (!canvas || !stage) return;
    var rect = stage.getBoundingClientRect();
    var narrow = narrowQuery.matches;
    var dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.5);
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    if (w === canvasCssW && h === canvasCssH && canvas.width === Math.round(w * dpr)) {
      cover = coverMap(w, h);
      return;
    }
    canvasCssW = w;
    canvasCssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    var ctx = canvas.getContext("2d", { alpha: true });
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cover = coverMap(w, h);
    if (cracks) {
      cracks.style.left = cover.ox + "px";
      cracks.style.top = cover.oy + "px";
      cracks.style.width = cover.dw + "px";
      cracks.style.height = cover.dh + "px";
    }
  }

  function point(nx, ny) {
    return [cover.ox + nx * cover.dw, cover.oy + ny * cover.dh];
  }

  function drawShards(ctx, list, origin, u, fade) {
    if (!cover || u <= 0 || fade <= 0) return;
    var i;
    var drawn = 0;
    var cap = shardBudget || list.length;
    for (i = 0; i < list.length && drawn < cap; i++) {
      var s = list[i];
      var lt = u - s.delay;
      if (lt <= 0) continue;
      drawn++;
      var z = s.vz * lt;
      var persp = 1 / Math.max(0.22, 1.18 - Math.min(z, 1.05));
      var px = origin.x + s.ox + s.vx * lt * persp;
      var py = origin.y + s.oy + (s.vy * lt + 0.08 * lt * lt) * persp;
      var xy = point(px, py);
      var size = s.size * Math.min(persp, 4.2);
      var alpha = fade * (1 - clamp((z - 0.15) / 1.15, 0, 1)) * clamp(lt / 0.04, 0, 1);
      if (alpha < 0.03 || size < 0.6) continue;
      ctx.save();
      ctx.translate(xy[0], xy[1]);
      ctx.rotate(s.rot + s.vr * lt);
      ctx.globalAlpha = alpha;
      var icy = s.tone > 0.9 ? "rgba(212,168,75,0.45)" : "rgba(226,240,255,0.72)";
      ctx.fillStyle = icy;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(0.6, size * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.16, -size * 0.15);
      ctx.lineTo(size * 0.22, size * 0.95);
      ctx.lineTo(-size * 0.08, size * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function setOpacity(el, value) {
    if (el) el.style.opacity = String(clamp(value, 0, 1));
  }

  function render(t) {
    var narrow = narrowQuery.matches;
    var strike1 = seg(t, 0.155, 0.20);
    var flash1 = Math.pow(1 - clamp(Math.abs(t - 0.188) / 0.028, 0, 1), 2);
    var shatterIn = smooth(seg(t, 0.175, 0.23));
    var shatterHold = 1 - smooth(seg(t, 0.46, 0.55));
    var shatter = shatterIn * shatterHold;
    var crackAmt = smooth(seg(t, 0.15, 0.22)) * (1 - smooth(seg(t, 0.22, 0.28)));
    var back = smooth(seg(t, 0.48, 0.57));
    var strike2 = seg(t, 0.60, 0.66);
    var flash2 = Math.pow(1 - clamp(Math.abs(t - 0.64) / 0.026, 0, 1), 2);
    var heldIn = smooth(seg(t, 0.63, 0.72));
    var macroIn = smooth(seg(t, 0.84, 0.98));
    var sheen = smooth(seg(t, 0.64, 0.74)) * (1 - smooth(seg(t, 0.90, 1)));
    var withoutCopy = smooth(seg(t, 0.02, 0.08)) * (1 - smooth(seg(t, 0.46, 0.54)));
    var withCopy = smooth(seg(t, 0.68, 0.76));
    var particleU = seg(t, 0.185, 0.50);
    var sparkU = seg(t, 0.63, 0.70);

    var shakeAmp = 0;
    if (t > 0.16 && t < 0.24) shakeAmp = (1 - seg(t, 0.16, 0.24)) * (narrow ? 5 : 9);
    if (t > 0.61 && t < 0.70) shakeAmp = Math.max(shakeAmp, (1 - seg(t, 0.61, 0.70)) * (narrow ? 3.5 : 6));
    var sx = shakeAmp ? Math.sin(t * 540) * shakeAmp : 0;
    var sy = shakeAmp ? Math.cos(t * 470) * shakeAmp * 0.65 : 0;
    if (shakeEl) shakeEl.style.transform = shakeAmp ? "translate3d(" + sx.toFixed(2) + "px," + sy.toFixed(2) + "px,0)" : "";

    setOpacity(layers.before, 1 - Math.max(shatter, heldIn) * 0.98);
    setOpacity(layers.shatter, shatter * (1 - back));
    setOpacity(layers.held, heldIn * (1 - macroIn * 0.85));
    setOpacity(layers.macro, macroIn);

    if (layers.before) layers.before.style.transform = "scale(" + (1.06 + strike1 * 0.025).toFixed(4) + ")";
    if (layers.shatter) layers.shatter.style.transform = "scale(" + (1.05 + shatter * 0.03).toFixed(4) + ")";
    var heldScale = 1.04 + smooth(seg(t, 0.74, 1)) * 0.16 + strike2 * 0.02;
    if (layers.held) layers.held.style.transform = "scale(" + heldScale.toFixed(4) + ")";
    if (layers.macro) layers.macro.style.transform = "scale(" + (1.14 - macroIn * 0.14).toFixed(4) + ")";

    if (cracks) {
      cracks.style.opacity = String(crackAmt);
      cracks.querySelectorAll("path").forEach(function (path, index) {
        var local = clamp(crackAmt * 1.25 - index * 0.012, 0, 1);
        path.style.strokeDashoffset = String(1 - local);
      });
    }
    setOpacity(flashEl, Math.max(flash1, flash2 * 0.85));
    if (sheenEl) {
      sheenEl.style.opacity = String(sheen * 0.95);
      sheenEl.style.transform = "translate3d(" + ((sheen * 28) - 18).toFixed(1) + "%,0,0)";
    }
    if (glowEl && cover) {
      var gp = point(IMPACT_HELD.x, IMPACT_HELD.y);
      var glow = sheen * (1 - macroIn);
      glowEl.style.opacity = String(glow);
      glowEl.style.left = gp[0] + "px";
      glowEl.style.top = gp[1] + "px";
      glowEl.style.transform = "translate(-50%,-50%) scale(" + (0.7 + glow * 0.5).toFixed(3) + ")";
    }
    setOpacity(copies.without, withoutCopy);
    setOpacity(copies.with, withCopy);
    if (copies.without) copies.without.style.pointerEvents = withoutCopy > 0.45 ? "auto" : "none";
    if (copies.with) copies.with.style.pointerEvents = withCopy > 0.45 ? "auto" : "none";
    if (copies.without) copies.without.setAttribute("aria-hidden", withoutCopy > 0.4 ? "false" : "true");
    if (copies.with) copies.with.setAttribute("aria-hidden", withCopy > 0.4 ? "false" : "true");

    fills.forEach(function (fill) {
      fill.style.transform = "scaleX(" + t.toFixed(4) + ")";
    });

    if (canvas && cover && (particleU > 0 || sparkU > 0)) {
      var ctx = canvas.getContext("2d");
      if (ctx) {
        var started = performance.now();
        ctx.clearRect(0, 0, canvasCssW, canvasCssH);
        drawShards(ctx, shards, IMPACT_SHATTER, particleU, 1 - smooth(seg(t, 0.42, 0.52)));
        drawShards(ctx, sparks, IMPACT_HELD, sparkU, (1 - smooth(seg(t, 0.68, 0.73))) * 0.55);
        if (performance.now() - started > 12) slowFrames++;
        else if (slowFrames > 0) slowFrames--;
        if (slowFrames > 4 && shardBudget > 18) {
          shardBudget = Math.max(18, Math.floor(shardBudget * 0.65));
          slowFrames = 0;
        }
      }
    } else if (canvas) {
      var clearCtx = canvas.getContext("2d");
      if (clearCtx) clearCtx.clearRect(0, 0, canvasCssW, canvasCssH);
    }

    var phase = macroIn > 0.65 ? "macro" : (heldIn > 0.5 ? "held" : (shatter > 0.45 ? "shatter" : "intact"));
    if (liveEl && phase !== lastPhase) {
      lastPhase = phase;
      liveEl.textContent = phase === "shatter"
        ? "Without Guardian Home Defence, the glass explodes inward."
        : phase === "held"
          ? "With Guardian Home Defence, the filmed glass cracks and holds."
          : phase === "macro"
            ? "Close view: the hammer stops on the filmed glass."
            : "";
    }
    maybePlay(t);
    prevT = t;
    story.style.setProperty("--glass-t", t.toFixed(4));
  }

  function maybePlay(t) {
    if (!soundOn || !audioCtx || reduced) return;
    if (prevT < 0.188 && t >= 0.188) playHit("shatter");
    else if (prevT < 0.64 && t >= 0.64 && !(prevT < 0.188 && t >= 0.64)) playHit("hold");
  }

  function playHit(kind) {
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      var ctx = audioCtx;
      var dur = kind === "shatter" ? 0.42 : 0.26;
      var length = Math.floor(ctx.sampleRate * dur);
      var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      var i;
      for (i = 0; i < length; i++) {
        var env = Math.pow(1 - i / length, kind === "shatter" ? 1.7 : 3.2);
        var noise = (Math.random() * 2 - 1) * env;
        var freq = kind === "shatter" ? 78 : 64;
        var thump = Math.sin((i / ctx.sampleRate) * Math.PI * 2 * freq) * Math.pow(1 - i / length, 5);
        data[i] = noise * (kind === "shatter" ? 0.55 : 0.22) + thump * 0.75;
      }
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = kind === "shatter" ? 2400 : 700;
      var gain = ctx.createGain();
      gain.gain.value = kind === "shatter" ? 0.2 : 0.12;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch (err) {}
  }

  function progress() {
    if (!scrollEl) return 0;
    var rect = scrollEl.getBoundingClientRect();
    var total = Math.max(1, scrollEl.offsetHeight - window.innerHeight);
    return clamp(-rect.top / total, 0, 1);
  }

  function frame() {
    ticking = false;
    if (reduced || !running) return;
    render(progress());
  }

  function request() {
    if (ticking || reduced) return;
    ticking = true;
    raf = window.requestAnimationFrame(frame);
  }

  function warmImages() {
    Object.keys(layers).forEach(function (key) {
      var img = layers[key];
      if (img && img.decode) img.decode().catch(function () {});
    });
  }

  function start() {
    if (reduced || running) return;
    running = true;
    document.documentElement.classList.add("js-glass");
    var count = narrowQuery.matches ? 48 : 100;
    shardBudget = count;
    shards = makeShards(count, 0x6c455);
    sparks = makeShards(narrowQuery.matches ? 14 : 22, 0x901d);
    buildCracks();
    resizeCanvas();
    warmImages();
    if (stage) stage.classList.add("is-live");
    render(progress());
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
  }

  function stop() {
    running = false;
    window.removeEventListener("scroll", request);
    window.removeEventListener("resize", onResize);
    if (raf) window.cancelAnimationFrame(raf);
    if (shakeEl) shakeEl.style.transform = "";
    if (stage) stage.classList.remove("is-live");
    document.documentElement.classList.remove("js-glass");
  }

  function onResize() {
    resizeCanvas();
    request();
  }

  function setSound(on) {
    soundOn = !!on;
    try { localStorage.setItem("ghd-glass-sound", soundOn ? "on" : "off"); } catch (err) {}
    if (soundBtn) {
      soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
      soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
    }
    if (soundOn && !audioCtx && window.AudioContext) {
      audioCtx = new AudioContext();
    }
    if (!soundOn && audioCtx && audioCtx.state === "running") audioCtx.suspend();
    if (soundOn && audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  if (soundBtn) {
    try { soundOn = localStorage.getItem("ghd-glass-sound") === "on"; } catch (err) { soundOn = false; }
    soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
    soundBtn.addEventListener("click", function () {
      setSound(!soundOn);
    });
  }

  document.addEventListener("pointerdown", function () {
    if (soundOn && audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    if (soundOn && !audioCtx && window.AudioContext) audioCtx = new AudioContext();
  }, { passive: true });

  motionQuery.addEventListener("change", function () {
    reduced = motionQuery.matches;
    if (reduced) stop();
    else start();
  });

  if (!reduced) start();

  window.__ghdGlass = {
    progress: progress,
    render: render
  };
})();
