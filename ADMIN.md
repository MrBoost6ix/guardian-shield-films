# Admin setup for Guardian Home Defence

The public site is still plain HTML. Admin tools and live text/image overrides stay **off** until you replace the placeholders in `assets/firebase-config.js`. Visitors never need an account.

Do **not** turn on Cloud Storage, and do **not** upgrade the project to the Blaze plan. Since October 2024, creating a Cloud Storage bucket in Firebase requires Blaze (a card on file). This admin stores copy and compressed images in **Cloud Firestore**, which is included on the free Spark plan. See [Firebase’s Storage billing note](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

## 1. Create the Firebase project (Spark)

1. Open [Firebase console](https://console.firebase.google.com/) and choose **Add project**.
2. Name it so the project ID is `guardian-home-defence` if that ID is free. Spark is the default — do not upgrade when asked.
3. Turn off Google Analytics if you do not want it (Analytics is optional and not used by this site).
4. If `guardian-home-defence` is already taken, pick another project ID, then change that ID in `.firebaserc`, in `firebase.json` (`hosting.site`), and in `assets/firebase-config.js` (`projectId` and `authDomain`).

## 2. Turn on Google sign-in

1. **Build → Authentication → Get started**.
2. **Sign-in method → Google → Enable**.
3. Set the public-facing support email to an address you control. Save.
4. **Authentication → Settings → Authorized domains**. `localhost` and `guardian-home-defence.firebaseapp.com` / `.web.app` are added for you. Add a custom domain later if you attach one.

Phone sign-in is not used. It is not available on Spark.

## 3. Create Firestore

1. **Build → Firestore Database → Create database**.
2. Choose **Standard** edition (not MongoDB / Enterprise).
3. Location: `northamerica-northeast1` (Montreal) is a good fit for the GTA. This cannot be changed later.
4. Start in **production mode**. The rules in this repo replace the console defaults when you deploy.

You do not create a Cloud Storage bucket. If the console pushes you toward Storage or a Blaze upgrade, cancel that step.

## 4. Paste the web config

1. Project **gear → Project settings → General → Your apps → Add app → Web** (`</>`).
2. Register the app (Hosting can be unchecked here; you will deploy Hosting from the CLI).
3. Copy the `firebaseConfig` object into `assets/firebase-config.js`, replacing the `YOUR_*` placeholders. You can ignore `storageBucket` and `measurementId` if they appear. This site does not use them.
4. Replace `dom@example.com` in **both**:
   - `GHD_ADMIN_EMAILS` in `assets/firebase-config.js`
   - the `isAdmin()` list in `firestore.rules`

   The address must be the Google account you will sign in with, lowercase. Add more quoted emails in both places if someone else should edit. The rules are what actually block everyone else. The list in the JS file only hides the editor.

## 5. Deploy rules and the site

From this folder, signed in to the Google account that owns the Firebase project:

```bash
npx firebase-tools@13 login
npx firebase-tools@13 deploy --only firestore:rules,hosting --project guardian-home-defence
```

Hosting site id is `guardian-home-defence` (the default site when the project ID matches). The live URLs are:

- https://guardian-home-defence.web.app
- https://guardian-home-defence.firebaseapp.com

`firebase.json` does not upload `ADMIN.md`, the rules file, or `tests/`.

## 6. Edit the site

1. Open the live site, scroll to the footer, and choose **Admin**.
2. Sign in with Google using an allow-listed account. A toolbar appears.
3. **Edit** on a heading, paragraph, button, or card changes the words only (icons and links stay). **Replace** on a photo opens a crop frame locked to that slot’s shape. Images are resized (heroes up to 1920px wide) and saved as WebP.
4. **Save draft** keeps the change private. **Publish** asks you to confirm, then every visitor sees it. **Publish drafts** in the toolbar sends every draft live. **Reset to default** restores the original for that one item.
5. Header, footer, and nav share one set of keys, so editing them once updates every page. Each page’s own headings, service copy, city pages, film cards, and carousel slides have their own keys. Glass-sequence frames are named Intact, Shatter, Held, and Macro.

If Firestore cannot be reached, the built-in HTML stays on screen. Nothing is blanked out.

## Try it on your machine first

The site talks to the Auth and Firestore **emulators** when you open it on `localhost` or `127.0.0.1`, unless you add `?live=1`.

```bash
npx firebase-tools@13 emulators:start --only auth,firestore --project guardian-home-defence
python3 -m http.server 5173
```

For this local trial the config must not still say `YOUR_API_KEY`. Any non-placeholder `apiKey` / `appId` is enough; keep `projectId` as `guardian-home-defence`. Click **Admin**. The emulator opens a test Google account form — use the allow-listed email. Nothing here touches the live project.

## Free-tier limits to stay inside

Spark, as published by Firebase (these are quotas, not a bill):

| Product | Included |
| --- | --- |
| Firestore stored data | 1 GiB |
| Firestore document reads | 50,000 / day |
| Firestore document writes | 20,000 / day |
| Firestore deletes | 20,000 / day |
| Firestore network | 10 GiB / month |
| One document | 1 MiB |
| Hosting stored files | 10 GB |
| Hosting transfer | 360 MB / day |
| Auth | Google sign-in on Spark |

What that means here:

- A normal page view costs **one read** of the published manifest, plus **one read per replaced image on that page**. Repeat visits from the same browser reuse a short cache (about a minute) and then only re-check the manifest.
- The editor keeps each image under about 480 KB (and splits anything larger into chunks under the 1 MiB document cap). A few dozen replaced photos fit in the 1 GiB store with room to spare. Text overrides are tiny.
- 50,000 reads/day is roughly tens of thousands of page views if only a handful of photos have been replaced. That is plenty for this site. If you ever outgrow it, that is the moment to talk about Blaze — not before.
- Do not enable Cloud Storage. A new bucket requires Blaze even if you stay inside Google’s always-free storage tier.

## Placeholders still in the repo

- `assets/firebase-config.js` — `YOUR_API_KEY`, `YOUR_SENDER_ID`, `YOUR_APP_ID`, and `dom@example.com`.
- `firestore.rules` — `dom@example.com` inside `isAdmin()`.
- `assets/config.js` — `quotes@guardianhomedefence.ca` is still the quote-form inbox from before. It is unrelated to admin, and the form will not deliver until that inbox is real (see the comment in that file).

Until the Firebase placeholders are replaced, admin is disabled and the site is the static pages only.
