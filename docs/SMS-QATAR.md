# Making OTP SMS actually arrive in Qatar

The code path is verified and working — `scripts/test-auth-flow.mjs` proves SNS
accepts every message and the whole challenge lifecycle behaves. What that test
**cannot** prove is carrier delivery, because that depends on account-level
registration with the Qatari networks.

Read this before your first real customer tries to sign in.

## What is already true of your account

| Item | Status |
| --- | --- |
| Region | `ap-south-1` (Mumbai) — SNS SMS supported |
| SMS sandbox | **Out of sandbox** (production access confirmed) |
| Monthly spend limit | **USD 50** |
| Registered origination identities | **none** |

## The one thing left to do: register a Sender ID

Qatar (Ooredoo and Vodafone Qatar) will not deliver A2P SMS from an
unregistered alphanumeric Sender ID. Without one, `sns:Publish` still succeeds —
you get a `MessageId` — but the message is dropped at the carrier and the
customer never sees a code. This is the single most likely cause of "the code
never arrived".

1. AWS Console → **Amazon SNS** → *Text messaging (SMS)* → **Sender IDs** →
   *Request sender ID*.
2. Country **Qatar**, Sender ID **`STARS`** (up to 11 characters, letters and
   digits, no spaces).
3. Fill in the company details and give a sample message. Use the exact template
   the app sends:

   ```
   Stars: 123456 is your verification code. It expires in 5 minutes. Do not share this code with anyone.
   ```

4. Approval typically takes a few business days.

### Turning it on once approved

The Lambda already reads the Sender ID from an environment variable and simply
omits the attribute while it is blank. Set it in
`amplify/auth/create-auth-challenge/resource.ts`:

```ts
environment: {
  APP_NAME: 'Stars',
  SMS_SENDER_ID: 'STARS',   // <- change from '' once approved
  OTP_TTL_SECONDS: '300',
  RESEND_COOLDOWN_SECONDS: '45',
  MAX_SMS_PER_HOUR: '5',
},
```

Then redeploy (`npm run sandbox`, or your pipeline for production).

## Raise the spend limit before launch

USD 50/month is roughly 1,500–2,000 messages to Qatar. Request an increase in
the SNS console (*Text messaging → Account spend limit*) well before go-live —
AWS treats it as a support case and it is not instant. When the limit is hit,
publishing fails and the app shows "We couldn't send the SMS", which is the
correct behaviour but a bad launch day.

## Checking delivery

```bash
node scripts/logs.mjs createauthchallenge 30
```

Every attempt logs one structured line:

```json
{"level":"INFO","trigger":"createAuthChallenge","message":"sms_sent","destination":"+974 •••• 2345","messageId":"…","sendCount":1}
```

- `sms_sent` — SNS accepted it. If the phone shows nothing, it is a carrier /
  Sender ID problem, not an app problem.
- `sms_send_failed` — the error text names the cause (spend limit, opt-out,
  invalid number, unregistered Sender ID).
- `sms_suppressed_cooldown` — resend tapped within 45 s; the same code stays
  valid, by design.
- `sms_suppressed_rate_limited` / `sms_blocked_rate_limited` — the hourly cap.

To see per-message carrier receipts, enable SNS delivery-status logging
(*Text messaging → Delivery status logging*, 100% sample rate). It is an
account-wide setting, which is why it is not part of this stack.

## Adding another country later

`src/lib/phone.ts` already offers Qatar, Saudi Arabia, UAE, Bahrain, Kuwait,
Oman and India in the country picker. Each additional country needs its own
registration:

| Country | Requirement |
| --- | --- |
| Qatar, UAE, Oman | pre-registered Sender ID |
| Saudi Arabia | Sender ID registered with the CITC |
| India | full TRAI DLT registration (Entity ID, Template ID, Sender ID) |
| Bahrain, Kuwait | Sender ID recommended; shared routes usually deliver |
