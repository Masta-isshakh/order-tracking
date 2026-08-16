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
 * 'SNS' | 'TWILIO' | 'FIREBASE' | 'DEV' | 'NONE'
 *
 * Two no-SMS modes exist for use while a provider's compliance review is
 * pending:
 *
 *   'DEV'   issues a real code, sends nothing, shows it on screen.
 *   'NONE'  no code at all — entering a registered number signs you in.
 *
 * Neither is a weaker login; both are no login, because knowing someone's
 * registered number is enough to become them. `npm run check:backend` fails
 * while either is active so they cannot quietly reach real customers.
 *
 * Switching back to real verification is this one line — nothing else in the
 * app changes, because workspace routing depends on Cognito groups rather than
 * on how the number was proven.
 */
export const OTP_PROVIDER = 'SNS';

/**
 * Which Cognito groups must pass a real SMS code to sign in.
 *
 * Staff hold the destructive powers — editing the catalog, running orders,
 * creating other staff — so they verify. Customers can only ever read their own
 * order, so requiring a code there would add friction and SMS cost for no
 * security gain. Anyone not in a listed group signs in on the number alone.
 *
 * Set to `''` to require verification from nobody, or add CUSTOMER to require it
 * from everyone.
 */
export const OTP_REQUIRED_GROUPS = 'ADMIN,SUPERVISOR';

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
  OTP_REQUIRED_GROUPS,
  SMS_SENDER_ID,
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_VERIFY_SERVICE_SID,
  TWILIO_AUTH_TOKEN: secret('TWILIO_AUTH_TOKEN'),
  FIREBASE_PROJECT_ID,
};
