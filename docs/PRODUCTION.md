# Production

## What is deployed where

| | |
| --- | --- |
| AWS account | `115246381405` (rodeo) — always use profile `torz` |
| Region | `ap-south-1` |
| Amplify app | `order-tracking` (`d24rn1118uqxmt`), branch **main** |
| Cognito pool | `ap-south-1_rDxWhvKRQ` |
| AppSync API | `wrme73kbxzdsjeyoc7pac5w7my` |
| SMS | Amazon SNS, **production access**, USD 50/month |
| EAS project | `@masta-jazz/stars` (`e5e9573d-c424-4cec-b4f0-a9e8d28f0664`) |

`amplify_outputs.json` currently points at **production**. Regenerate it any time
with:

```powershell
$env:AWS_PROFILE="torz"
npx ampx generate outputs --app-id d24rn1118uqxmt --branch main
```

## Deploying a backend change

```powershell
$env:AWS_PROFILE="torz"
$env:CI="1"
npx ampx pipeline-deploy --branch main --app-id d24rn1118uqxmt
```

This is a **real** environment: its data and user accounts persist. It is not the
sandbox, and `ampx sandbox delete` cannot touch it.

For day-to-day development keep using the sandbox — it is disposable and does not
affect live customers:

```powershell
npm run sandbox        # already pinned to --profile torz
```

Switching between them rewrites `amplify_outputs.json`, so **rebuild the app**
before shipping anything: the file is baked into the binary.

## Shipping app changes

Two very different paths.

### JavaScript-only change → over-the-air, seconds

Screens, text, styling, business logic, translations:

```powershell
npx eas-cli update --branch production --message "what changed"
```

Existing installs pick it up on next launch. No rebuild, no store review.

### Anything native → new build, new submission

A new native module, a permission change, an SDK upgrade, or anything in
`app.json` that affects the native project:

```powershell
npx eas-cli build --profile production --platform android   # .aab for Play
npx eas-cli build --profile production --platform ios       # needs Apple account
```

`runtimeVersion` uses the `appVersion` policy, so bumping `expo.version` in
`app.json` correctly isolates old installs from updates they cannot run.

## Build profiles

| Profile | Output | Use |
| --- | --- | --- |
| `production` | `.aab` | Play Store upload |
| `preview` | `.apk` | Sideload onto a device to test |
| `development` | dev client `.apk` | Live reload against a local Metro |

## First-run checklist for a fresh environment

```powershell
$env:AWS_PROFILE="torz"
node scripts/check-backend.mjs                      # 11 config checks
npm run seed:admin -- +974XXXXXXXX "Owner Name"     # the one manual account
node scripts/seed-content.mjs +974XXXXXXXX          # optional starter catalog
npm run test:all                                    # tiers, authorization, verifier
```

## Before submitting to the stores

- [ ] Replace the placeholder icons in `assets/` (see `docs/PUBLISHING.md`)
- [ ] Publish a real privacy policy and terms, and update the two links in
      `src/components/SettingsShared.tsx`
- [ ] Fill in the three Apple placeholders in `eas.json` → `submit.production.ios`
- [ ] Add a Play service-account key at `secrets/play-service-account.json`
- [ ] Create a demo account and name it in App Review notes — Apple rejects apps
      whose sign-in they cannot complete, and this one is SMS-only
- [ ] Walk `docs/QA-CHECKLIST.md` on one iPhone and one Android device
- [ ] Confirm a real SMS arrives on a Qatari handset (`npm run probe -- +974…`)

## Watch the SMS spend

USD 50/month at roughly $0.02–0.05 per message to Qatar is about 1,000–2,500
sign-ins. When it runs out, `sns:Publish` starts failing and staff simply cannot
sign in — with nothing obviously wrong in the app. Set a billing alarm, and raise
the limit in the SNS console before any real campaign.

## Rolling back

An update:

```powershell
npx eas-cli update:republish --branch production   # pick an earlier update
```

A backend change: revert the code and re-run `pipeline-deploy`. There is no
one-click rollback for infrastructure, which is why `npm run test:all` should
pass before every deploy.
