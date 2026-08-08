# Twilio Verify — click-by-click setup

Total time: about 15 minutes to a real SMS on your own phone.

**Read this first.** The goal of this walkthrough is not "switch to Twilio
forever" — it is to find out, quickly and cheaply, whether Twilio delivers to
Qatari numbers *without* a registered Sender ID. If it does, you are live today.
If it does not, you need a Sender ID either way, and AWS SNS (already deployed,
roughly half the price) is the better home. Step 8 is where you get the answer.

---

## Step 1 — Create the account

1. Go to **<https://www.twilio.com/try-twilio>**
2. Fill in first name, last name, email, password. Tick the terms box.
3. Click **Start your free trial**.
4. Open the confirmation email from Twilio and click **Confirm your email**.
5. Twilio asks for a phone number to verify *you*. Enter your own Qatari number
   in full international form: `+974XXXXXXXX`. Click **Verify**.
6. Type the 6-digit code Twilio texts you. **If that code never arrives, stop
   here** — Twilio cannot reach your number at all, and nothing later in this
   guide will work. Go to [`SMS-QATAR.md`](SMS-QATAR.md) and register the AWS
   Sender ID instead.
7. Twilio then asks a few onboarding questions. Answer:
   - *Which Twilio product are you here to use?* → **Verify**
   - *What do you plan to build?* → **User verification / 2FA**
   - *How do you want to build?* → **With code**
   - *What is your preferred coding language?* → **Node.js**
8. Click **Get Started with Twilio**. You land on the **Console** dashboard.

Your trial includes free credit (about $15). That is plenty for testing.

---

## Step 2 — Turn on Qatar in Geo Permissions

This is the step people miss. Twilio blocks most countries by default, and the
error it returns is unhelpful.

1. In the left sidebar click **Messaging**.
   (If you do not see it: click **Explore Products** at the bottom of the
   sidebar, find **Messaging**, and pin it.)
2. Expand **Settings** → click **Geo permissions**.
3. In the search box type **Qatar**.
4. Tick the checkbox next to **Qatar**.
5. Scroll to the bottom and click **Save**.

While you are there, tick any other country your staff or customers use
(Saudi Arabia, UAE, India…). Changes take effect within a minute.

---

## Step 3 — Create the Verify service

1. Left sidebar → **Explore Products** → under *Account Security* click
   **Verify**. (Or go straight to <https://console.twilio.com/us1/develop/verify/services>)
2. Click **Services** → **Create new**.
3. **Friendly name**: type `Stars`

   > This matters — Twilio puts the friendly name into the default message body,
   > so your customers will read *"Your Stars verification code is 123456"*.
   > Type it exactly as you want it to appear.

4. Click **Create**.
5. You land on the service settings page. Confirm:
   - **Code length** = `6` (must match the app's six input boxes)
   - **SMS** is enabled under *Delivery channels*
6. At the top of the page, copy the **Service SID**. It starts with `VA` and is
   34 characters. Keep it somewhere for Step 5.

---

## Step 4 — Copy your account credentials

1. Click the **Twilio logo** (top-left) to return to the Console home.
2. Scroll to the **Account Info** panel at the bottom of the page.
3. Copy the **Account SID** — starts with `AC`, 34 characters.
4. Next to **Auth Token**, click **Show**, then copy it.

> The Auth Token is a password for your whole Twilio account. Do not paste it
> into a chat, a commit, or a screenshot. Step 5 puts it in AWS Secrets Manager.

You should now have three values:

| | Looks like |
| --- | --- |
| Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| Auth Token | a 32-character hex string |
| Verify Service SID | `VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

---

## Step 5 — Store the Auth Token

Open a terminal in the project folder and run — replacing the placeholder with
your real token:

```bash
cd order-tracking/torz
echo YOUR_AUTH_TOKEN_HERE | npx ampx sandbox secret set TWILIO_AUTH_TOKEN --identifier stars
```

Expected output:

```text
Successfully created version 2 of secret TWILIO_AUTH_TOKEN
```

The token is now in AWS Secrets Manager. It never touches the repo, and the two
auth Lambdas read it at deploy time.

---

## Step 6 — Point the app at Twilio

Open **`amplify/auth/otp-config.ts`** and change three lines:

```ts
export const OTP_PROVIDER = 'TWILIO';

export const TWILIO_ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
export const TWILIO_VERIFY_SERVICE_SID = 'VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
```

Leave `SMS_SENDER_ID` and `FIREBASE_PROJECT_ID` empty. Save the file.

Those two SIDs are identifiers, not credentials — Twilio uses the Account SID as
an HTTP username — so they are safe in the repo. Only the Auth Token is secret.

---

## Step 7 — Deploy

```bash
npm run sandbox
```

Wait for:

```text
✔ Deployment completed
[Sandbox] Watching for file changes...
```

Roughly 60–90 seconds. If the sandbox is already running in another terminal it
redeploys automatically when you save the file — no need to restart it.

---

## Step 8 — The moment of truth

```bash
npm run check:otp -- +974XXXXXXXX
```

Use your own number, the same one you verified in Step 1.

The script provisions a temporary account, starts a real sign-in, asks Twilio to
text you, then waits:

```text
Stars OTP provider test (ap-south-1)
  provider     TWILIO
  verify svc   VAxxxxxxxx...
  test number  +974XXXXXXXX  ← a real message will be sent

  PASS  test account provisioned
  PASS  challenge issued — CUSTOM_CHALLENGE
  PASS  challenge issued by the configured provider — TWILIO
  PASS  provider accepted the message — +974 •••• 2345

  Enter the 6-digit code you received:
```

Type the code from your phone and press Enter:

```text
  PASS  the code you received signs in

  test account removed

TWILIO provider is working.
```

**That is end-to-end proof** — real Twilio delivery, real Cognito tokens, real
group membership. Not a simulation.

### If the code never arrives

```bash
npm run logs -- createauthchallenge 10
```

Match the logged reason against this table:

The log line carries Twilio's numeric code, e.g.
`{"message":"twilio_send_failed","reason":"http=400 code=21408 Permission to send an SMS has not been enabled for the region"}`

| Code in the log | What it means | Fix |
| --- | --- | --- |
| `code=21408` | Qatar not enabled for your account | Redo Step 2 |
| `code=60410` | Twilio blocked the destination | Geo permissions, or contact Twilio support |
| `code=20003` | Bad credentials | Re-check the Account SID, re-run Step 5 |
| `code=20404` | Wrong Verify Service SID | Re-copy from Step 3 (must start `VA`) |
| `code=60200` | Malformed number | Must be `+974` followed by 8 digits |
| `code=60205` | Number cannot receive SMS | Landline or VoIP — try another handset |
| `twilio_not_configured` | SIDs still blank | Redo Step 6, then redeploy |
| `twilio_rate_limited` / `code=60203` | Too many sends to this number | Wait 10 minutes |
| `sms_sent` but no SMS on the phone | Twilio accepted it, the carrier dropped it | **This is the Qatar Sender ID case — see below** |

The last row is the important one. `sms_sent` means Twilio took the message and
Ooredoo/Vodafone discarded it. At that point you have two choices, and I would
pick the second:

1. Register an alphanumeric Sender ID with Twilio
   ([Qatar requirements](https://support.twilio.com/hc/en-us/articles/6448318408603-Documents-Required-and-Instructions-to-Register-Your-Alphanumeric-Sender-ID-in-Qatar)) —
   note this needs a **paid** account, trials cannot use alphanumeric senders.
2. Register the same thing with AWS instead ([`SMS-QATAR.md`](SMS-QATAR.md)),
   set `OTP_PROVIDER` back to `'SNS'`, and pay about half per message.

Same paperwork either way. AWS is cheaper and already deployed.

---

## Step 9 — Before real customers use it

Trial accounts have two limits that will bite you in production:

- They can **only text numbers you have verified** in the Twilio console.
- Every message is prefixed with *"Sent from your Twilio trial account"*.

To remove both:

1. Console → **Billing** (or the **Upgrade** banner at the top).
2. Click **Upgrade your account**.
3. Add a card and buy credit (the minimum is usually $20).

Then re-run Step 8 with a colleague's number — one you have *not* verified in
Twilio — to confirm you can now reach arbitrary customers. This is the single
most common "it worked in testing" failure.

### Recommended hardening

- **Verify Fraud Guard**: Verify → your service → *Fraud Guard*. Leave it on. It
  blocks SMS-pumping attacks against your sign-in screen.
- **Spend alerts**: Billing → *Usage triggers* → alert at, say, $25/month.
- **API Key instead of Auth Token**: Console → Account → *API keys & tokens* →
  create a Standard key. You can store its SID/Secret in place of the account
  Auth Token, so a leak is revocable without rotating your whole account.

---

## Step 10 — Going back to AWS later

When your AWS Sender ID is approved, in `amplify/auth/otp-config.ts`:

```ts
export const OTP_PROVIDER = 'SNS';
export const SMS_SENDER_ID = 'STARS';
```

`npm run sandbox`, then `npm run check:otp -- +974XXXXXXXX` again. Nothing else
changes — not the app, not the accounts, not a single customer's sign-in.

---

## What never changes

Whichever provider is active:

- An unregistered number is refused before anything is sent.
- A wrong digit re-serves the existing challenge instead of sending a new SMS.
- Resend is blocked for 45 seconds; max 5 sends per number per hour.
- A failed delivery produces an unanswerable challenge, not a silent hang.
- A used code is burned and cannot be replayed.

Run `npm run test:all` after any provider change to confirm all 73 checks still
pass.
