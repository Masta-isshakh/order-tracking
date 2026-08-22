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

**Never hard-code the tab bar's height or bottom padding.** React Navigation
treats a numeric `height` in `tabBarStyle` as the *total* bar height and stops
adding the safe-area inset itself, and a `paddingBottom` in the same style
overrides the inset padding it would otherwise apply — so hard-coding both lays
the icons out inside the strip the system keeps for its gesture bar. Use
`useTabBarStyle()` (`src/ui/tabBar.ts`), which derives both from the real inset.
This looks fine on Android three-button navigation, where the inset is 0, and is
broken on every gesture-navigation device.

**Screens inside a tab navigator must pass `edges={{ bottom: false }}`.** The tab
bar already occupies the bottom inset; padding for it again opens a dead band
above the bar.

**`bottomInset` belongs on the list, not the container.** A FAB or a sticky bar
is positioned against the screen container, so shrinking the container to make
scroll room lifts that element off the bottom too. Pad the list's
`contentContainerStyle` with `fabClearance` instead.

**Android does not resize for the keyboard.** React Native calls
`enableEdgeToEdge()` for any app targeting SDK 35+ (this one targets 36), which
sets `decorFitsSystemWindows` to false; Android then ignores `adjustResize` and
expects the app to consume the IME inset. `KeyboardAvoidingView` therefore needs
`behavior="padding"` on Android too — with no behavior it silently does nothing
and the keyboard covers the chat composer and the last field of every form.

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
