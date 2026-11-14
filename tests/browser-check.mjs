/**
 * Headless check for the glass sequence (desktop + mobile + reduced motion)
 * and, when ADMIN=1, the emulator admin flow.
 *
 *   node tests/browser-check.mjs
 *   ADMIN=1 node tests/browser-check.mjs
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = "/opt/cursor/artifacts";
mkdirSync(artifacts, { recursive: true });

const types = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith("/")) rel += "index.html";
      const file = normalize(join(root, rel));
      if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
      try {
        const body = readFileSync(file);
        res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404); res.end("missing");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function track(page, errors) {
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("requestfailed", (req) => {
    const url = req.url();
    const reason = (req.failure() && req.failure().errorText) || "";
    if (url.startsWith("data:") || url.includes("favicon") || reason === "net::ERR_ABORTED") return;
    errors.push("request failed " + url + " " + reason);
  });
}

async function scrollTo(page, t) {
  await page.evaluate((progress) => {
    document.documentElement.style.scrollBehavior = "auto";
    const el = document.querySelector("[data-glass-scroll]");
    const total = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + total * progress);
  }, t);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function shot(page, name) {
  const file = join(artifacts, name);
  await page.locator("[data-glass-stage], .glass-static-grid").first().screenshot({ path: file });
  return file;
}

const server = await startServer();
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const errors = [];
let failed = false;

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const blocked = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("googleapis.com") || url.includes("gstatic.com") || url.includes("firestore")) blocked.push(url);
  });
  track(page, errors);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-glass-stage]");
  if (blocked.length) errors.push("firebase network with placeholder config: " + blocked.join(", "));
  const adminCount = await page.locator(".admin-entry").count();
  if (adminCount !== 0) errors.push("admin entry visible without firebase config");

  const frames = [
    [0.06, "glass_desktop_intact.png"],
    [0.21, "glass_desktop_cracks.png"],
    [0.34, "glass_desktop_shatter.png"],
    [0.76, "glass_desktop_held.png"],
    [0.97, "glass_desktop_macro.png"]
  ];
  for (const [t, name] of frames) {
    await scrollTo(page, t);
    await shot(page, name);
    if (name.includes("shatter")) {
      const pixels = await page.evaluate(() => {
        const canvas = document.querySelector("[data-glass-canvas]");
        const ctx = canvas.getContext("2d");
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let hit = 0;
        for (let i = 3; i < data.length; i += 24) if (data[i] > 12) hit++;
        return { hit, progress: document.querySelector("[data-glass-story]").style.getPropertyValue("--glass-t") };
      });
      console.log("shatter pixels", pixels);
      if (pixels.hit < 8) errors.push("shatter frame drew too few particles: " + pixels.hit);
    }
  }

  const bench = await page.evaluate(async () => {
    const el = document.querySelector("[data-glass-scroll]");
    const total = el.offsetHeight - innerHeight;
    const top = el.getBoundingClientRect().top + scrollY;
    const frames = [];
    let last = performance.now();
    let y = top;
    const end = top + total;
    await new Promise((resolve) => {
      function step(now) {
        frames.push(now - last);
        last = now;
        y += (end - top) / 160;
        scrollTo(0, y);
        if (y < end) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
    frames.sort((a, b) => a - b);
    const avg = frames.reduce((sum, n) => sum + n, 0) / frames.length;
    return { avg, p95: frames[Math.floor(frames.length * 0.95)] || 0, n: frames.length };
  });
  console.log("desktop frame ms", bench);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  track(mobile, errors);
  await mobile.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await scrollTo(mobile, 0.34);
  await shot(mobile, "glass_mobile_shatter.png");
  await scrollTo(mobile, 0.76);
  await shot(mobile, "glass_mobile_held.png");
  const mobileBench = await mobile.evaluate(async () => {
    const el = document.querySelector("[data-glass-scroll]");
    const total = el.offsetHeight - innerHeight;
    const top = el.getBoundingClientRect().top + scrollY;
    const frames = [];
    let last = performance.now();
    let y = top;
    const end = top + total * 0.5;
    await new Promise((resolve) => {
      function step(now) {
        frames.push(now - last);
        last = now;
        y += (end - top) / 90;
        scrollTo(0, y);
        if (y < end) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
    frames.sort((a, b) => a - b);
    return { avg: frames.reduce((s, n) => s + n, 0) / frames.length, p95: frames[Math.floor(frames.length * 0.95)] || 0 };
  });
  console.log("mobile frame ms", mobileBench);

  const still = await browser.newPage({ viewport: { width: 390, height: 844 } });
  track(still, errors);
  await still.emulateMedia({ reducedMotion: "reduce" });
  await still.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  const mode = await still.evaluate(() => ({
    cinematic: getComputedStyle(document.querySelector(".glass-cinematic")).display,
    staticBlock: getComputedStyle(document.querySelector(".glass-static")).display,
    without: document.querySelector(".glass-static h2").textContent
  }));
  console.log("reduced motion", mode);
  if (mode.cinematic !== "none" || mode.staticBlock === "none") errors.push("reduced motion did not show the static sequence");
  if (!mode.without.includes("Without Guardian")) errors.push("reduced motion missing without copy");
  await still.evaluate(() => {
    const el = document.querySelector(".glass-static");
    const top = el.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo(0, top);
  });
  await still.locator(".glass-static-grid").screenshot({ path: join(artifacts, "glass_reduced_motion.png") });

  for (const path of ["/services.html", "/service-area-toronto.html", "/products.html", "/contact.html"]) {
    const extra = [];
    const p = await browser.newPage();
    track(p, extra);
    await p.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: "networkidle" });
    const h1 = await p.locator("h1").innerText();
    if (!h1.trim()) extra.push(path + " missing h1");
    if (extra.length) errors.push(path + " " + extra.join(" | "));
    await p.close();
  }

  if (process.env.ADMIN === "1") {
    await runAdmin(browser, port, errors);
  }
} catch (err) {
  errors.push(String(err && err.stack || err));
} finally {
  await browser.close();
  server.close();
}

if (errors.length) {
  console.error("FAILURES\n" + errors.join("\n"));
  failed = true;
} else {
  console.log("browser check ok");
}
process.exit(failed ? 1 : 0);

async function runAdmin(browser, port, errors) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.GHD_FIREBASE = {
      apiKey: "local-only",
      authDomain: "localhost",
      projectId: "guardian-home-defence",
      appId: "local-app"
    };
    window.GHD_ADMIN_EMAILS = ["dom@example.com"];
  });
  const page = await context.newPage({ viewport: { width: 1280, height: 800 } });
  track(page, errors);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.__ghdEmulatorSignIn === "function", null, { timeout: 30000 });
  await page.evaluate(() => window.__ghdEmulatorSignIn("dom@example.com"));
  await page.waitForSelector("body.is-admin");
  await page.locator("h1 .ghd-edit-btn").click();
  await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes[0].nodeValue = "Make every home ";
  });
  await page.locator(".ghd-popover button", { hasText: "Publish" }).click();
  await page.locator(".ghd-confirm button", { hasText: "Confirm" }).click();
  await page.waitForFunction(() => document.querySelector("h1").textContent.includes("Make every home"));

  const png = join(artifacts, "admin-sample.png");
  writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIUlEQVQoU2NkYGD4z0AEYBxVSFJgOIwBYw0kG5gGAAAkqQJ/4m0x2QAAAABJRU5ErkJggg==", "base64"));
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("header picture .ghd-edit-btn").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(png);
  await page.locator(".ghd-modal button", { hasText: "Publish" }).click();
  await page.locator(".ghd-confirm button", { hasText: "Confirm" }).click();
  await page.waitForFunction(() => document.querySelector("header img").src.startsWith("data:image/"));
  await page.screenshot({ path: join(artifacts, "admin_signed_in.png") });

  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("h1").textContent.includes("Make every home"));
  const logo = await page.locator("header img").getAttribute("src");
  if (!logo || !logo.startsWith("data:image/")) errors.push("logo override did not persist");
  const heading = await page.locator("h1").innerText();
  if (!heading.includes("Make every home")) errors.push("heading override did not persist: " + heading);

  await page.evaluate(() => window.__ghdEmulatorSignIn("stranger@example.com"));
  await page.waitForSelector(".ghd-adminbar");
  const denied = await page.locator("[data-admin-who]").innerText();
  if (!denied.includes("isn't on the admin allow-list")) errors.push("stranger was not rejected in the UI: " + denied);
  const code = await page.evaluate(async () => {
    const { getApp } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js");
    const { getFirestore, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    try {
      await setDoc(doc(getFirestore(getApp()), "published", "manifest"), { texts: { hacked: "no" } });
      return "allowed";
    } catch (err) {
      return err.code || String(err);
    }
  });
  if (code !== "permission-denied") errors.push("stranger write returned " + code);
  console.log("admin flow ok, stranger code", code);
}
