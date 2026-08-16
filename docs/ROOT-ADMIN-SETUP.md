# Creating the first administrator

Everyone else in Stars is created from inside the app. The **first** admin
cannot be — there is nobody to create them yet — so it is done once, by hand, by
someone with AWS access. That is deliberate: it means the app itself never
carries the power to mint an administrator out of nothing.

Two things have to be true before that first admin can sign in:

| | Where | Why |
| --- | --- | --- |
| 1. Account in the **ADMIN** group | Amazon Cognito | Decides which workspace they see |
| 2. Number allowed to receive SMS | Amazon SNS | Otherwise the sign-in code never arrives |

Step 2 is only needed while your AWS account is in the SMS sandbox. Check with
`node scripts/check-sns.mjs`.

---

## The short version

```bash
cd order-tracking/torz
npm run seed:admin -- +97455708226 "Your Name"
```

That single command does **both** steps: it creates the Cognito account in the
ADMIN group and registers the number with SNS. If SNS sends a verification code,
the script tells you and waits — you pass the code back with:

```bash
npm run seed:admin -- +97455708226 "Your Name" --code 123456
```

Then open the app, go to **Track**, enter that number, and you are in.

Everything below is the same thing done by hand in the AWS console, for when you
want to understand it or do it without the repo.

---

## By hand, part 1 — Cognito

You need your user pool id. It is in `amplify_outputs.json` under
`auth.user_pool_id`, and looks like `ap-south-1_qgUY3hGT4`.

### In the console

1. AWS Console → **Cognito** → **User pools** → open the pool
2. **Users** → **Create user**
3. **Alias / phone number**: `+97455708226` — full international form, no spaces
4. Tick **Mark phone number as verified**
5. **Don't send an invitation** — the app never uses Cognito's own messages
6. Set any password. Nobody ever types it; sign-in is by SMS code. It exists only
   so the account is not stuck in `FORCE_CHANGE_PASSWORD`, which the custom
   sign-in flow cannot use.
7. Create the user, open it, → **Group memberships** → **Add user to group** →
   **ADMIN**

### Or with the AWS CLI

```bash
POOL=ap-south-1_qgUY3hGT4
PHONE=+97455708226

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL" \
  --username "$PHONE" \
  --user-attributes Name=phone_number,Value="$PHONE" \
                    Name=phone_number_verified,Value=true \
                    Name=name,Value="Your Name" \
  --message-action SUPPRESS

# Moves the account out of FORCE_CHANGE_PASSWORD. The value is never used.
aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL" \
  --username "$PHONE" \
  --password "$(openssl rand -base64 24)Aa1!" \
  --permanent

aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$POOL" \
  --username "$PHONE" \
  --group-name ADMIN
```

`--message-action SUPPRESS` matters: without it Cognito sends its own SMS, which
is not the message the app is designed around.

---

## By hand, part 2 — SNS

Skip this if `node scripts/check-sns.mjs` reports **production access**. In that
case any number can be texted and there is no list to manage.

### In the console

1. AWS Console → **Amazon SNS** → *Text messaging (SMS)*
2. **Sandbox destination phone numbers** → **Add phone number**
3. Enter `+97455708226`, language English → **Add phone number**
4. AWS texts a code to that handset
5. Enter it → status becomes **Verified**

### Or with the AWS CLI

```bash
aws sns create-sms-sandbox-phone-number --phone-number +97455708226 --language-code en-US
# ... the handset receives a code ...
aws sns verify-sms-sandbox-phone-number --phone-number +97455708226 --one-time-password 123456

aws sns list-sms-sandbox-phone-numbers    # confirm it says Verified
```

---

## After the first admin

Nothing else is manual. From inside the app:

```text
ADMIN → Team tab       → creates SUPERVISOR or another ADMIN
                         (also registers their number with SNS automatically)
SUPERVISOR → New order → creates the CUSTOMER
Public "Book a service" → creates the CUSTOMER
```

When an admin adds a staff member, the app registers their number with SNS in
the same step and tells the admin what to expect. If AWS sent a verification
code, the admin enters it on **Settings → Phone numbers**, which also lists any
staff who still cannot receive codes.

Customers never need any of this — they are not asked for a code at all.

---

## Who has to pass a code

Set by `OTP_REQUIRED_GROUPS` in
[`amplify/auth/otp-config.ts`](../amplify/auth/otp-config.ts), currently
`ADMIN,SUPERVISOR`.

| Role | Sign-in | Reasoning |
| --- | --- | --- |
| **Admin** | number + SMS code | Can create staff, edit the catalog, see every order |
| **Supervisor** | number + SMS code | Runs orders, edits the catalog, messages customers |
| **Customer** | number only | Can only read their own order; a code would cost an SMS and add friction while protecting nothing extra |

Add `CUSTOMER` to that list to require a code from everyone — but note every
customer's number would then also need to be registered with SNS while the
account is in the sandbox.

---

## When it does not work

```bash
node scripts/check-sns.mjs +97455708226   # sandbox status, verified list, send a test
node scripts/logs.mjs createauthchallenge 30
```

| Symptom | Cause |
| --- | --- |
| "This number isn't registered" | No Cognito account, or not in a group |
| Sign-in works but no code arrives | Number not verified in SNS, or the carrier dropped it |
| Straight in with no code asked | The account is not in ADMIN or SUPERVISOR |
| `sms_send_failed` in the logs | The reason is in the log line — spend limit, opt-out, unregistered sender |

The **monthly spend limit** deserves attention: sandbox accounts default to
**USD 1**, which is roughly 20–30 messages to Qatar. Raise it in the SNS console
before real use, or sign-ins will start failing mid-day with no obvious cause.
