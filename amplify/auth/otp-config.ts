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

/** 'SNS' | 'TWILIO' | 'FIREBASE' */
export const OTP_PROVIDER = 'SNS';

/** Qatar requires a registered Sender ID; blank uses the account default. */
export const SMS_SENDER_ID = '';

/** Starts with "AC". Not a credential — Twilio uses it as the username. */
export const TWILIO_ACCOUNT_SID = '';

/** Starts with "VA". The Verify service, not the account. */
export const TWILIO_VERIFY_SERVICE_SID = '';

/** Your Firebase project id, e.g. "stars-qa". */
export const FIREBASE_PROJECT_ID = '';

/** Shared by both triggers so a challenge is always checked the way it was issued. */
export const otpEnvironment = {
  OTP_PROVIDER,
  SMS_SENDER_ID,
  TWILIO_ACCOUNT_SID,
  TWILIO_VERIFY_SERVICE_SID,
  TWILIO_AUTH_TOKEN: secret('TWILIO_AUTH_TOKEN'),
  FIREBASE_PROJECT_ID,
};
