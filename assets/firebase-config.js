/* =====================================================================
   GUARDIAN HOME DEFENCE — FIREBASE WEB CONFIG
   ---------------------------------------------------------------------
   This is the ONLY file that holds the Firebase web config and the
   admin allow-list.

   Until the placeholders below are replaced, the public site behaves
   exactly as the static pages: no Firebase SDK is downloaded, nothing
   is requested, and admin tools stay hidden.

   Setup steps: see ADMIN.md.

   ⚠️  PLACEHOLDERS Dom must replace before deploy:
     1. The whole GHD_FIREBASE object (Firebase console → Project
        settings → Your apps → SDK setup and configuration).
     2. dom@example.com in GHD_ADMIN_EMAILS.
     3. The same email inside firestore.rules (isAdmin). The rules are
        what actually reject everyone else; this list only hides the UI.
   ===================================================================== */
(function () {
  "use strict";

  /* Tests and the local emulator may set a real config before this file
     runs. Never overwrite a config that is already filled in. */
  var existing = window.GHD_FIREBASE;
  if (!existing || !existing.apiKey || String(existing.apiKey).indexOf("YOUR_") === 0) {
    window.GHD_FIREBASE = {
      apiKey: "YOUR_API_KEY",
      authDomain: "guardian-home-defence.firebaseapp.com",
      projectId: "guardian-home-defence",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };
  }

  if (!window.GHD_ADMIN_EMAILS || !window.GHD_ADMIN_EMAILS.length) {
    window.GHD_ADMIN_EMAILS = [
      "dom@example.com" // ⚠️ PLACEHOLDER — the Google account Dom signs in with
    ];
  }
})();
