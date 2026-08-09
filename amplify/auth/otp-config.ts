import { secret } from '@aws-amplify/backend';

/**
 * ONE place to choose how phone numbers are verified.
 *
 * createAuthChallenge and verifyAuthChallenge both read this, so they can never
 * disagree about which provider issued a challenge.
 *
 * ---------------------------------------------------------------------------
 * To go live today with Twilio Verify:
 *
 *   1. twilio.com → Verify → Services → create a service named "Stars"
 *   2. echo <your-auth-token> | npx ampx sandbox secret set TWILIO_AUTH_TOKEN --identifier stars
 *   3. set OTP_PROVIDER to 'TWILIO' and fill in the two SIDs below
 *   4. npm run sandbox   (redeploys in ~30s)
 *   5. node scripts/test-otp-provider.mjs +974XXXXXXXX
 *
 * To move back to AWS once your Qatar Sender ID is approved:
 *   set OTP_PROVIDER back to 'SNS' and SMS_SENDER_ID to 'STARS'.
 *
 * To use Firebase instead: set OTP_PROVIDER to 'FIREBASE' and FIREBASE_PROJECT_ID.
 * The backend is ready; the app also needs @react-native-firebase/auth and a
 * native build — see docs/OTP-PROVIDERS.md.
 * ---------------------------------------------------------------------------
 */

/**
 * 'SNS' | 'TWILIO' | 'FIREBASE' | 'DEV'
 *
 * 'DEV' sends no SMS and shows the code on screen. Use it to build and demo the
 * three workspaces while a provider's compliance review is pending. It is NOT a
 * weaker login — it is no login at all, since anyone who knows a registered
 * number can sign in as them. `npm run check:backend` fails while it is active.
 */
export const OTP_PROVIDER = 'TWILIO';

/** Qatar requires a registered Sender ID; blank uses the account default. */
export const SMS_SENDER_ID = '';

/** Starts with "AC". Not a credential — Twilio uses it as the username. */
export const TWILIO_ACCOUNT_SID = '';

/**
 * Optional. Starts with "SK".
 *
 * Set this only if you created an **API key** instead of using the account auth
 * token. Twilio authenticates an API key as `SK…` + its Secret, so pairing an
 * API key Secret with the Account SID fails with 20003 — a very easy mistake,
 * because both values are 32 characters and live on the same console page.
 *
 * Leave blank to authenticate as the account with TWILIO_AUTH_TOKEN.
 */
export const TWILIO_API_KEY_SID = '';

/** Starts with "VA". The Verify service, not the account. */
export const TWILIO_VERIFY_SERVICE_SID = '';

/** Your Firebase project id, e.g. "stars-qa". */
export const FIREBASE_PROJECT_ID = '';

/** Shared by both triggers so a challenge is always checked the way it was issued. */
export const otpEnvironment = {
  OTP_PROVIDER,
  SMS_SENDER_ID,
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_VERIFY_SERVICE_SID,
  TWILIO_AUTH_TOKEN: secret('TWILIO_AUTH_TOKEN'),
  FIREBASE_PROJECT_ID,
};
