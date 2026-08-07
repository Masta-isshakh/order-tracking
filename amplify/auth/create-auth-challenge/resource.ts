import { defineFunction } from '@aws-amplify/backend';

/**
 * Generates the one-time code and delivers it over SMS with Amazon SNS.
 *
 * `SMS_SENDER_ID` is wired from backend.ts. Qatar (and most GCC networks) only
 * deliver SMS from a pre-registered alphanumeric Sender ID — leaving it empty
 * makes SNS fall back to the account default, which is the right behaviour while
 * registration is still pending.
 */
export const createAuthChallenge = defineFunction({
  name: 'create-auth-challenge',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 20,
  environment: {
    APP_NAME: 'Stars',
    SMS_SENDER_ID: '',
    OTP_TTL_SECONDS: '300',
    RESEND_COOLDOWN_SECONDS: '45',
    MAX_SMS_PER_HOUR: '5',
  },
});
