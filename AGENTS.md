# Working on Stars

Vehicle-service order tracking. Expo SDK 57 + React Native 0.86 + expo-router,
with an Amplify Gen 2 backend in `ap-south-1`. Read `README.md` first for the
architecture; this file is the list of things that will bite you.

## Versions move fast

Check the [exact versioned docs](https://docs.expo.dev/versions/v57.0.0/) before
writing platform code.

## Non-obvious rules, learned the hard way

**`a.json()` fields are strings on the wire.** AppSync's `AWSJSON` scalar takes a
JSON-encoded *string*, and the Amplify Data client passes values through
untouched. Writing a raw array fails with
`Variable 'steps' has an invalid value`. Always write through `toJsonField()`
(`shared/domain.ts`) and read with `parseJsonArray()`.

**Lambda-backed mutations do not receive `event.info`.** Amplify's generated
resolver builds the payload by hand:
`{ typeName, fieldName, arguments, identity, source, request, prev }`.
Reading `event.info.fieldName` throws. Use `resolverFieldName(event)` from
`amplify/shared/appsync.ts`.

**Per-model `allow.resource()` does not exist.** Function access to models is
granted once, at the schema level, in the trailing
`.authorization((allow) => [allow.resource(fn)])`.

**Do not clear `AutoVerifiedAttributes`.** Cognito requires it to stay a superset
of `AttributesRequireVerificationBeforeUpdate`, and clearing it fails stack
creation. Cognito still never sends SMS here, because every account is created
with `MessageAction: SUPPRESS` and `phone_number_verified: true`.

**Grant every Cognito action a Lambda actually calls.** `ensureUserInGroup()`
takes an update path for existing users, so `updateUserAttributes` and
`enableUser` are needed alongside `createUser`.

**RTL is a style, not a restart.** The root `<Screen>` sets `direction: 'rtl'`
and Yoga flips the layout live. Never call `I18nManager.forceRTL` — it needs a
native reload. Keep phone numbers, prices and order codes LTR
(`OtpField` pins `direction: 'ltr'` for exactly this reason).

**`ar.ts` is typed against `en.ts`.** `en.ts` must not be `as const`, or every
Arabic string becomes a type error.

## Before you say it works

```bash
npm run typecheck
node scripts/check-backend.mjs
node scripts/test-auth-flow.mjs
node scripts/test-data-flows.mjs
npx expo export --platform ios      # catches runtime import errors tsc misses
```

The two test scripts run against the real deployed backend and clean up after
themselves. They use `+1 555-01xx` numbers, which are reserved for fiction, so
they never text a real handset.

## Debugging

`node scripts/logs.mjs <lambda-name-fragment> [minutes]` — the handlers emit
structured JSON. Log group fragments: `createauthchallenge`,
`verifyauthchallenge`, `defineauthchallenge`, `submitbooking`, `usermanager`.

Note: the local `aws` CLI in this environment resolves to a different account
than `ampx` deploys to. Use the Node scripts (they share Amplify's credential
chain), not `aws cognito-idp ...`.
