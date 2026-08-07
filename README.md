# Stars — vehicle service order tracking

A multi-platform (iOS + Android) app for a vehicle care studio, with three
workspaces in one binary:

| Workspace | Who sees it | What it does |
| --- | --- | --- |
| **Storefront** | everyone, signed out | Home, catalog, public booking |
| **Customer** | phone verified, in `CUSTOMER` | Live roadmap of their order, chat with the team |
| **Supervisor** | phone verified, in `SUPERVISOR` | Create/run orders, manage steps and photos, catalog, chat |
| **Admin** | phone verified, in `ADMIN` | Everything a supervisor can do, plus supervisors and the company profile |

Everything is bilingual (English / العربية with full RTL) and ships four themes
(Light, Dark, Ocean, Sand) switchable in Settings.

---

## 1. How sign-in works

There are **no passwords anywhere**. A user types their phone number, receives a
6-digit SMS code from Amazon SNS, and is routed by their Cognito group.

```
InitiateAuth (CUSTOM_AUTH)
        │
        ├─ defineAuthChallenge   → unknown number? fail immediately, send nothing
        │                        → otherwise ask for CUSTOM_CHALLENGE
        │
        ├─ createAuthChallenge   → issue a 6-digit code, store it in DynamoDB
        │                          with a 5-minute TTL, publish via SNS
        │                        → on a retry or an early resend, re-serve the
        │                          SAME code instead of sending another SMS
        │
        └─ verifyAuthChallenge   → constant-time compare, delete the code on
                                   success so it can never be replayed
```

Guarantees this design gives you, all covered by the test suite:

- An unregistered number never triggers an SMS.
- A wrong digit does not burn a new message; three wrong tries kill the session.
- A code expires after 5 minutes and is single-use.
- Max 5 SMS per number per hour, minimum 45 s between sends — an open sign-in
  screen cannot be used to run up your SNS bill.
- Accounts can only be created by someone already inside the system
  (`AllowAdminCreateUserOnly`), or by the public booking Lambda.

Accounts are created with `MessageAction: SUPPRESS` and
`phone_number_verified: true`, so **Cognito never sends its own SMS** — the app
owns the entire message.

---

## 2. First run

```bash
npm install

# 1. Deploy your own backend sandbox (watches for changes)
npm run sandbox

# 2. In a second terminal, confirm the deployment is wired correctly
node scripts/check-backend.mjs

# 3. Create the first administrator (this is the only account made outside the app)
node scripts/seed-admin.mjs +97455512345 "Your Name"

# 4. Optional: load a starter catalog + company profile
node scripts/seed-content.mjs +97455512345

# 5. Run the app
npm start
```

Then open the app, go to **Track**, enter the admin number, and the SMS code
takes you into the admin workspace.

### The account chain

```
scripts/seed-admin.mjs  →  ADMIN
ADMIN  → Team tab       →  SUPERVISOR
SUPERVISOR → New order  →  CUSTOMER
public Book a Service   →  CUSTOMER
```

A customer's phone number is registered the moment a supervisor saves their
order (or they book online), which is what makes the Track tab work for them.

---

## 3. Verifying the backend

Three scripts talk to the **deployed** backend, not to mocks.

```bash
node scripts/check-backend.mjs      # configuration audit (10 checks)
node scripts/test-auth-flow.mjs     # full OTP lifecycle (16 checks)
node scripts/test-data-flows.mjs    # 3 workspaces + authorization (28 checks)
```

`test-auth-flow.mjs` and `test-data-flows.mjs` create and delete their own
accounts, and use numbers in the `+1 555-01xx` range that telecom standards
reserve for fiction, so **no real handset is ever texted**. Pass your own number
to `test-auth-flow.mjs` to also confirm real delivery:

```bash
node scripts/test-auth-flow.mjs +97455512345   # sends one real SMS
```

To debug a failure:

```bash
node scripts/logs.mjs createauthchallenge 30   # why an SMS did not arrive
node scripts/logs.mjs submitbooking 30         # why a booking failed
node scripts/logs.mjs usermanager 30           # why an account was not created
```

---

## 4. Project layout

```
amplify/                     backend (Amplify Gen 2, deployed to ap-south-1)
  auth/                      phone-only auth + the three custom-auth triggers
  data/resource.ts           GraphQL schema and every authorization rule
  storage/resource.ts        S3 paths for catalog, order and chat images
  functions/
    user-manager/            create supervisors and customers in Cognito
    submit-booking/          public booking → customer account + order
  shared/                    phone normalisation, Cognito helpers, resolver types

shared/                      domain vocabulary used by BOTH backend and app
  domain.ts                  statuses, JSON helpers
  orders.ts                  order numbers, step expansion, totals

app/                         screens (expo-router)
  (tabs)/                    storefront: home, book, track, settings
  (staff)/                   supervisor + admin: orders, catalog, team, settings
  auth/                      phone entry and code verification
  order/[id].tsx             customer roadmap
  staff/order/[id].tsx       staff roadmap with step controls
  staff/order/new.tsx        4-stage order intake
  chat/[id].tsx              order chat, both sides

src/
  theme/                     4 palettes + provider
  i18n/                      en.ts / ar.ts (ar is typed against en)
  auth/                      AuthProvider — the whole OTP client flow
  data/                      queries, mutations and live subscriptions
  ui/                        design system (Button, Input, Roadmap, Sheet…)
  components/                cross-screen cards and settings rows

scripts/                     deployment audits and integration tests
docs/                        QA checklist, publishing guide, SMS setup
```

### Two rules worth knowing before you edit

1. **`a.json()` fields are strings on the wire.** Always write them through
   `toJsonField()` from `shared/domain.ts`; read them with `parseJsonArray()`.
   Passing a raw array is rejected with `Variable 'x' has an invalid value`.
2. **Lambda-backed mutations do not get `event.info`.** Amplify's generated
   resolver sends `{ typeName, fieldName, arguments, identity, … }`. Use
   `resolverFieldName(event)` from `amplify/shared/appsync.ts`.

---

## 5. Going to production

The sandbox is a personal, disposable environment — **never ship an app pointing
at it**. Before building for the stores, create a real branch deployment and
regenerate the config:

```bash
# once: create an Amplify app and connect this repo
npx ampx pipeline-deploy --branch main --app-id <YOUR_AMPLIFY_APP_ID>

# then, before every store build
npx ampx generate outputs --app-id <YOUR_AMPLIFY_APP_ID> --branch main
```

See [`docs/PUBLISHING.md`](docs/PUBLISHING.md) for the full store checklist and
[`docs/SMS-QATAR.md`](docs/SMS-QATAR.md) for the Sender ID registration that
Qatari networks require before OTPs reach real phones.

---

## 6. Useful commands

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run sandbox` | deploy + watch the backend |
| `npm run typecheck` | `tsc --noEmit` over the whole app |
| `npm run doctor` | Expo dependency/config audit |
| `npx expo export --platform ios` | production bundle (catches runtime import errors) |
| `npm run sandbox:delete` | tear the sandbox down |
