/**
 * Firestore rules: allow-listed verified Google users can write;
 * everyone else can read published content and nothing else.
 *
 * Run:
 *   npx firebase-tools emulators:exec --only firestore --project guardian-home-defence "node tests/rules.test.mjs"
 */
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const testEnv = await initializeTestEnvironment({
  projectId: "guardian-home-defence",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") }
});

const adminToken = { email: "dom@example.com", email_verified: true };
const strangerToken = { email: "stranger@example.com", email_verified: true };
const unverifiedToken = { email: "dom@example.com", email_verified: false };

function db(ctx) { return ctx.firestore(); }

try {
  await testEnv.clearFirestore();

  const admin = testEnv.authenticatedContext("admin-uid", adminToken);
  await assertSucceeds(setDoc(doc(db(admin), "published", "manifest"), {
    texts: { "index.main.sample": "Homes that hold" },
    imageIndex: {},
    rev: 1
  }));
  await assertSucceeds(setDoc(doc(db(admin), "publishedImages", "chrome.logo"), {
    mime: "image/webp",
    b64: "QUJDRA==",
    chunks: 1,
    alt: "logo",
    w: 8,
    h: 8
  }));
  await assertSucceeds(setDoc(doc(db(admin), "drafts", "manifest"), { texts: { secret: "draft" }, imageIndex: {} }));

  const anon = testEnv.unauthenticatedContext();
  const published = await assertSucceeds(getDoc(doc(db(anon), "published", "manifest")));
  if (!published.exists() || published.data().texts["index.main.sample"] !== "Homes that hold") {
    throw new Error("Anonymous visitor could not read published text");
  }
  await assertSucceeds(getDoc(doc(db(anon), "publishedImages", "chrome.logo")));
  await assertFails(getDoc(doc(db(anon), "drafts", "manifest")));
  await assertFails(setDoc(doc(db(anon), "published", "manifest"), { texts: { hacked: "no" } }));

  const stranger = testEnv.authenticatedContext("stranger-uid", strangerToken);
  await assertFails(setDoc(doc(db(stranger), "published", "manifest"), { texts: { hacked: "no" } }));
  await assertFails(setDoc(doc(db(stranger), "publishedImages", "chrome.logo"), { b64: "eA==", chunks: 1 }));
  await assertFails(getDoc(doc(db(stranger), "drafts", "manifest")));
  await assertSucceeds(getDoc(doc(db(stranger), "published", "manifest")));

  const unverified = testEnv.authenticatedContext("unverified-uid", unverifiedToken);
  await assertFails(setDoc(doc(db(unverified), "published", "manifest"), { texts: { hacked: "no" } }));

  console.log("rules ok: admin write, public read, stranger and unverified denied");
} finally {
  await testEnv.cleanup();
}
