# Publishing Stars to the App Store and Google Play

## What I could not do for you

Submitting an app is an **account-holder action**. It needs your Apple Developer
and Google Play credentials, legal identity, tax and banking details, and
interactive two-factor sign-in. I have no way to do that on your behalf, and you
should not give those credentials to anyone.

What is ready:

- ✅ `app.json` — bundle identifiers, versions, icons, permission strings, RTL
  locales, Android 16 KB page-size compatible SDK targets
- ✅ `eas.json` — development / preview / production build profiles and submit
  configuration with the three placeholders you fill in
- ✅ Both platforms produce a clean production bundle today
- ✅ Privacy-relevant behaviour documented below for the store questionnaires

What you do: create the two developer accounts, run three commands, and fill in
the store listings.

---

## 0. Before anything else: move off the sandbox

The app currently points at a **personal sandbox** backend. Sandboxes are
disposable and can be deleted. Ship a real branch deployment:

```bash
npx ampx pipeline-deploy --branch main --app-id <YOUR_AMPLIFY_APP_ID>
npx ampx generate outputs --app-id <YOUR_AMPLIFY_APP_ID> --branch main
```

Confirm `amplify_outputs.json` now shows the production user pool, then re-run
`node scripts/check-backend.mjs`.

Also complete the Sender ID registration in [`SMS-QATAR.md`](SMS-QATAR.md) —
without it, reviewers in some regions may not receive a login code, and
**Apple will reject an app they cannot sign into**.

---

## 1. Accounts

| | Cost | Notes |
| --- | --- | --- |
| Apple Developer Program | USD 99 / year | An **Organization** account needs a D-U-N-S number, which can take 1–2 weeks |
| Google Play Console | USD 25 once | Personal accounts now need 12 testers for 14 days before production access |
| Expo account | free | `npx eas login` |

---

## 2. Fill in the placeholders

`eas.json` → `submit.production`:

- `appleId` — your Apple ID email
- `ascAppId` — the numeric App ID from App Store Connect (created in step 4)
- `appleTeamId` — from developer.apple.com → Membership
- `serviceAccountKeyPath` — a Google Play service-account JSON. Put it in
  `secrets/` (already git-ignored). **Never commit it.**

`app.json` — the bundle IDs are currently `com.starsqatar.stars` on both
platforms. Change them now if you want something else; after the first upload
they are permanent.

`src/components/SettingsShared.tsx` links to `https://stars.qa/privacy` and
`/terms`. Both stores reject placeholder URLs — publish the real pages and
update those two links.

---

## 3. Icons and screenshots

The current icon is the Expo starter placeholder. Replace before submitting:

| File | Size | Notes |
| --- | --- | --- |
| `assets/icon.png` | 1024×1024 | no transparency, no rounded corners |
| `assets/android-icon-foreground.png` | 1024×1024 | subject inside the middle 66% |
| `assets/android-icon-background.png` | 1024×1024 | solid colour or simple pattern |
| `assets/android-icon-monochrome.png` | 1024×1024 | silhouette for Android themed icons |
| `assets/splash-icon.png` | ~512×512 | transparent background |

Screenshots you need (take them on a device or simulator):

- **iOS**: 6.7" (1290×2796) and 6.5" (1242×2688) — 3 to 10 each
- **Android**: phone screenshots 1080×1920 or larger, plus a 1024×500 feature graphic

Good set to capture: Home, Book a Service, the **tracking roadmap** (the strongest
screen), the chat thread, and the supervisor order board. Capture each in both
English and Arabic — the stores let you upload per-language screenshots and it
noticeably helps in the Gulf.

---

## 4. Build and submit

```bash
npm install -g eas-cli
eas login
eas build:configure          # links the project, writes extra.eas.projectId

# test on real devices first
eas build --profile preview --platform all

# store builds
eas build --profile production --platform ios
eas build --profile production --platform android

# upload
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

For iOS, create the app record in App Store Connect first (My Apps → +), then
copy its Apple ID number into `eas.json` as `ascAppId`.

---

## 5. Store questionnaire answers

Both stores ask what data you collect. For Stars, truthfully:

| Data | Collected | Linked to identity | Used for tracking | Why |
| --- | --- | --- | --- | --- |
| Phone number | yes | yes | **no** | Sign-in and order contact |
| Name | yes | yes | no | Order contact |
| Email (optional) | yes | yes | no | Order contact |
| Photos | yes | yes | no | Vehicle and service-progress images |
| Customer support / messages | yes | yes | no | Order chat |

There is **no advertising, no analytics SDK and no third-party tracking** in this
app, so answer "No" to App Tracking Transparency and to Play's advertising ID
question. Do not add the `com.google.android.gms.permission.AD_ID` permission.

Encryption: `app.json` already declares `usesNonExemptEncryption: false` —
correct, since the app only uses standard HTTPS.

### The review note that prevents a rejection

Apple rejects apps whose login they cannot complete. Because sign-in is
SMS-only, put this in **App Review Information → Notes**:

> Stars uses phone-number sign-in with a one-time SMS code — there is no
> password. Most of the app (home, service catalog, booking) works without any
> account. To review the customer and staff areas, please use the demo number
> below; we have pre-registered it and will monitor it for the code during
> review, or contact us at <your email> and we will supply the current code
> within minutes.
>
> Demo number: +974 XXXX XXXX

Create that demo account before submitting (`node scripts/seed-admin.mjs` for a
staff view, or add it as a customer with a real order so the roadmap is
populated). A reviewer looking at an empty Track tab is a rejection risk.

---

## 6. Android specifics

- Play requires `targetSdkVersion` 35+ for new apps; `app.json` sets 36.
- `versionCode` auto-increments via `autoIncrement: true` in the production
  profile.
- Personal Play accounts created after Nov 2023 must run a **closed test with 12
  testers for 14 continuous days** before production access unlocks. Start this
  early — it is the longest pole in the schedule.
- The production profile builds an `.aab`; Play will not accept an `.apk`.

## 7. iOS specifics

- The camera and photo-library permission strings are already written in
  `app.json` and localised into Arabic through `locales/store/ar.json`. Apple
  rejects generic strings, so keep them specific if you edit them.
- `ios.deploymentTarget` is 16.4 (the minimum for Expo SDK 57).
- First upload can take 30–60 minutes to finish processing before it appears in
  TestFlight.

---

## 8. Release checklist

- [ ] Backend deployed to a **real branch**, not a sandbox
- [ ] `node scripts/check-backend.mjs` — all pass against production
- [ ] Sender ID approved; one real SMS received on a Qatari number
- [ ] SNS spend limit raised
- [ ] First admin seeded on the production pool
- [ ] Catalog and company profile filled in through the app
- [ ] Icons replaced; screenshots captured in EN and AR
- [ ] Privacy policy and terms live at real URLs, links updated
- [ ] Demo account created and named in the review notes
- [ ] `docs/QA-CHECKLIST.md` walked end to end on one iPhone and one Android
- [ ] `eas build --profile preview` installed and tested on real hardware
