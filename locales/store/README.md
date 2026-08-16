# Store / system-prompt localisation

These files are **not currently wired into `app.json`**, and that is deliberate.

## Why they were removed

`expo.locales` looks like an iOS-only feature, but Expo also turns each entry
into an Android `res/values-b+<lang>/strings.xml`. The keys here are iOS
Info.plist keys, so Android's release lint fails the build with:

```text
Error: "CFBundleDisplayName" is translated here but not found in
default locale [ExtraTranslation]
```

That is `lintVitalRelease`, which runs on release builds only — so it passes
locally and fails in EAS after a full 20-minute Gradle run.

## What is lost right now

Only the **Arabic wording of the iOS permission prompts**. The English wording
still ships, set by the `expo-image-picker` plugin block in `app.json`, and it is
what Apple reviews. Nothing in the app UI is affected — the whole interface is
still fully bilingual through `src/i18n/`.

## How to restore it properly

Either of these works; both keep Android lint happy:

1. **Split by platform.** Keep an iOS-only locales map by moving the app config
   to `app.config.ts` and emitting `locales` only when
   `process.env.EAS_BUILD_PLATFORM === 'ios'`.
2. **Silence the Android check.** Add a small config plugin that sets
   `lint { disable "ExtraTranslation" }` in `android/app/build.gradle`, then
   re-add the `locales` block.

Option 1 is cleaner: these really are iOS keys, and Android has no use for them.
