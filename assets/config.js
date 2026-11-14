/* =====================================================================
   GUARDIAN HOME DEFENCE — SITE CONFIG (the ONLY place to change these)
   ---------------------------------------------------------------------
   ⚠️  PLACEHOLDER: quotes@guardianhomedefence.ca does NOT exist yet.
   Replace QUOTE_EMAIL with a real inbox Dom controls.

   FORM_ENDPOINT:
     - Leave "" to use FormSubmit (https://formsubmit.co) with QUOTE_EMAIL.
       The FIRST submission sends a one-time activation email to
       QUOTE_EMAIL; click "Activate Form" in it, then the form delivers.
     - Or paste a Formspree endpoint, e.g. "https://formspree.io/f/abcdwxyz"
       (free account at formspree.io → New form → copy the endpoint).
   If sending fails, the form falls back to a pre-filled mailto: link
   to QUOTE_EMAIL.
   ===================================================================== */
window.GHD_CONFIG = {
  QUOTE_EMAIL: "quotes@guardianhomedefence.ca", // ⚠️ PLACEHOLDER — replace
  FORM_ENDPOINT: ""                               // optional Formspree URL
};
