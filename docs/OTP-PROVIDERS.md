# Choosing how phone numbers get verified

Stars supports three OTP providers behind one switch. **Everything else about
authentication is identical** whichever you pick — the Cognito custom-auth flow,
the ADMIN/SUPERVISOR/CUSTOMER groups, the row-level rules that stop one customer
reading another's order. Only the delivery step changes.

Change the provider in **one file**: [`amplify/auth/otp-config.ts`](../amplify/auth/otp-config.ts).

---

## Which one should you use?

| | **Twilio Verify** | **AWS SNS** | **Firebase** |
| --- | --- | --- | --- |
| Time to *test* | **~15 minutes** | already deployed | hours + a native build |
| Qatar Sender ID | may be needed | needed | not applicable |
| Client changes | **none** | none | native module + custom build |
| Works in Expo Go | **yes** | yes | no |
| Cost per verification | ~$0.05 + SMS | ~$0.02–0.04 | $0.01–0.46 (Blaze plan required) |
| Who holds the code | Twilio | you | Google |

### Correction worth reading

An earlier version of this file claimed Twilio needs no per-country
registration. **That is not true for Qatar.** Twilio documents its own
[Qatar alphanumeric Sender ID registration](https://support.twilio.com/hc/en-us/articles/6448318408603-Documents-Required-and-Instructions-to-Register-Your-Alphanumeric-Sender-ID-in-Qatar),
with the same kind of document burden as AWS — and alphanumeric sender IDs are
[not available on trial accounts](https://help.twilio.com/articles/223181348-Alphanumeric-Sender-ID-for-Twilio-Programmable-SMS)
at all.

What is still genuinely different: Twilio Verify can fall back to Twilio's
shared long-code pool, so it **may** deliver to Qatar with no registration at
all, whereas AWS SNS with no origination identity usually will not. Nobody can
tell you from a document which applies to your traffic — a 15-minute test can.

**So: test Twilio first ([`TWILIO-SETUP.md`](TWILIO-SETUP.md)).**

- If codes arrive → you are live today. Register the Sender ID later at leisure
  for better branding and deliverability.
- If they do not → you are registering a Sender ID either way, so register with
  AWS, stay on SNS, and pay roughly half per message.

**Firebase is the weakest fit here**, despite being the obvious name. It is
[no longer free](https://firebase.google.com/docs/phone-number-verification/pricing) —
SMS verification has required the Blaze billing plan since September 2024 — and on
React Native it needs `@react-native-firebase/auth`, which is a native module.
That means no more Expo Go, a custom dev client, SHA-1/SHA-256 fingerprints
registered per build keystore, and an APNs auth key uploaded to Firebase for iOS
silent-push verification. You would trade a self-service AWS form for a
permanently heavier build pipeline. The backend support is implemented and ready
if you want it anyway.

---

## Option A — Twilio Verify (live today)

### 1. Create the service

1. Sign up at [twilio.com](https://www.twilio.com) and note your **Account SID**
   (starts `AC…`) and **Auth Token** from the console dashboard.
2. Console → **Verify** → **Services** → *Create new*. Name it `Stars`.
   Copy the **Service SID** (starts `VA…`).
3. In that service, keep the code length at 6 to match the app's input boxes.

### 2. Store the auth token

```bash
echo <your-auth-token> | npx ampx sandbox secret set TWILIO_AUTH_TOKEN --identifier stars
```

The token is the only secret. The two SIDs are identifiers — Twilio uses the
Account SID as an HTTP username — so they live in plain config.

### 3. Flip the switch

In `amplify/auth/otp-config.ts`:

```ts
export const OTP_PROVIDER = 'TWILIO';
export const TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
export const TWILIO_VERIFY_SERVICE_SID = 'VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
```

### 4. Deploy and prove it

```bash
npm run sandbox                                    # ~30s
node scripts/test-otp-provider.mjs +974XXXXXXXX    # sends one real SMS
```

The script sends to your number, waits for you to type the code, and confirms
Cognito issued tokens. That is end-to-end proof, not a simulation.

**Nothing in the app changes.** From the device's point of view Twilio and SNS
are the same experience: enter number → receive 6 digits → type them.

> Confirm Qatar coverage on your Twilio account before launch. Twilio maintains
> registered senders for Qatar, but availability is account- and traffic-dependent
> — the test above is the definitive answer.

---

## Option B — AWS SNS (cheapest, needs registration)

This is the default and is already deployed. It works today for any country
where you hold an origination identity. For Qatar you need a registered Sender
ID — see [`SMS-QATAR.md`](SMS-QATAR.md). Once approved:

```ts
export const OTP_PROVIDER = 'SNS';
export const SMS_SENDER_ID = 'STARS';
```

Redeploy, then `node scripts/test-otp-provider.mjs +974XXXXXXXX`.

---

## Working while a provider's compliance review is pending

Every SMS provider gates production sending behind business verification —
Twilio behind an approved Primary Compliance Profile, AWS behind a registered
Sender ID. Neither is something the app can route around, and neither should
stop you building.

Two ways to keep going. Use both.

### 1. Verify your team's numbers (real SMS, no code change)

Twilio delivers to any number you add as a Verified Caller ID, even before the
compliance profile clears. Add yourself and each supervisor at
<https://console.twilio.com/us1/develop/phone-numbers/manage/verified>.

That is your whole staff running the real app, with real codes, today. Customers
come online the day the profile is approved — no code change, nothing to
migrate, because their accounts already exist in the CUSTOMER group.

### 2. DEV mode (no SMS at all)

For demos, or to onboard testers without verifying each number, set
`OTP_PROVIDER = 'DEV'` in [`otp-config.ts`](../amplify/auth/otp-config.ts) and
redeploy. The backend issues a real code, sends nothing, and returns it so the
verify screen can display it on a red banner.

**This is not weaker security — it is none.** Anyone who knows a registered
number can sign in as that person. Three things make it hard to ship by
accident:

- `npm run check:backend` **fails** while DEV is active
- Every challenge logs at ERROR level
- The verify screen shows an unmissable red warning

Switch back with one line the moment your provider is approved:

```ts
export const OTP_PROVIDER = 'TWILIO';   // or 'SNS'
```

Nothing else changes. Groups, workspace routing and every authorization rule are
independent of how the code is delivered — which is the whole point of the
provider switch.

## Option C — Firebase Phone Auth

The backend is **complete**: `verifyAuthChallenge` validates the Firebase ID
token against Google's published signing certificates, checks issuer, audience,
expiry and signature, and — critically — refuses the token unless its
`phone_number` matches the account being signed into. Without that last check
anyone holding any valid token for your project could sign in as anyone.

What remains is the client, and it is not small:

1. Create a Firebase project; enable **Authentication → Phone**.
2. Add an iOS app (bundle `com.starsqatar.stars`) and an Android app (package
   `com.starsqatar.stars`). Download `GoogleService-Info.plist` and
   `google-services.json`.
3. Upload an **APNs auth key** to Firebase (iOS silent-push verification;
   without it iOS falls back to a reCAPTCHA web view).
4. Register the **SHA-1 and SHA-256** fingerprints of every Android signing key,
   including the EAS build keystore (`eas credentials`). Miss this and Android
   verification fails with `app-not-authorized`.
5. Install and configure the native modules:

   ```bash
   npx expo install @react-native-firebase/app @react-native-firebase/auth
   ```

   Add both to `plugins` in `app.json` along with the two config files, then
   rebuild — Expo Go can no longer run the app.

6. In `src/auth/AuthProvider.tsx`, when `startSignIn` reports
   `provider === 'FIREBASE'`, call `signInWithPhoneNumber` from
   `@react-native-firebase/auth`, then pass the resulting **ID token** (not the
   6-digit code) to `confirmSignIn` as the challenge response. The backend does
   the rest.

Then set:

```ts
export const OTP_PROVIDER = 'FIREBASE';
export const FIREBASE_PROJECT_ID = 'your-project-id';
```

Until step 6 is done the app fails fast with a clear message rather than showing
a code box that can never be satisfied.

---

## What stays true on every provider

The protections are implemented once, above the provider layer:

- An unregistered number is refused before anything is sent.
- A wrong digit re-serves the existing challenge instead of sending a new message.
- Resend is blocked for 45 seconds; max 5 sends per number per hour.
- A failed delivery produces an unanswerable challenge rather than a silent hang.
- A used code is burned and cannot be replayed.

Rate limits live in `amplify/auth/create-auth-challenge/handler.ts` and apply to
SNS and Twilio alike (Firebase enforces its own on the device).

## Debugging

```bash
node scripts/logs.mjs createauthchallenge 30
node scripts/logs.mjs verifyauthchallenge 30
```

Every attempt logs one structured line naming the provider and the outcome:
`sms_sent`, `twilio_send_failed`, `sms_suppressed_cooldown`,
`otp_rejected` with a reason, and so on.
