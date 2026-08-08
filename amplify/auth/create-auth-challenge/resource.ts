import { defineFunction } from '@aws-amplify/backend';
import { otpEnvironment } from '../otp-config';

/**
 * Issues the one-time code.
 *
 * Which provider delivers it is decided in `amplify/auth/otp-config.ts` — see
 * that file to switch between AWS SNS, Twilio Verify and Firebase. Only the
 * delivery step changes; groups, routing and every authorization rule stay the
 * same whichever provider is active.
 */
export const createAuthChallenge = defineFunction({
  name: 'create-auth-challenge',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 20,
  environment: {
    ...otpEnvironment,
    APP_NAME: 'Stars',
    // Applies to every provider that sends on our behalf, and is what stops an
    // open sign-in screen from being used to run up an SMS bill.
    OTP_TTL_SECONDS: '300',
    RESEND_COOLDOWN_SECONDS: '45',
    MAX_SMS_PER_HOUR: '5',
  },
});
