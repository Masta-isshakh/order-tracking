import { defineFunction } from '@aws-amplify/backend';
import { otpEnvironment } from '../otp-config';

/**
 * Checks the answer the user submitted.
 *
 * How it checks depends on who issued the challenge, which createAuthChallenge
 * records in `privateChallengeParameters.provider`: compare a stored code (SNS),
 * ask Twilio (TWILIO), or validate a Firebase ID token against Google's signing
 * certificates (FIREBASE).
 */
export const verifyAuthChallenge = defineFunction({
  name: 'verify-auth-challenge',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 15,
  environment: otpEnvironment,
});
