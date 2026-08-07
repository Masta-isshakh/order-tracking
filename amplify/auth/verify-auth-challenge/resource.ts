import { defineFunction } from '@aws-amplify/backend';

/** Checks the code the user typed against the one createAuthChallenge issued. */
export const verifyAuthChallenge = defineFunction({
  name: 'verify-auth-challenge',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 10,
});
