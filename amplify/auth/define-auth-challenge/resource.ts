import { defineFunction } from '@aws-amplify/backend';

/**
 * Drives the passwordless sign-in state machine. Cognito calls this before and
 * after every challenge round to ask "what next?".
 */
export const defineAuthChallenge = defineFunction({
  name: 'define-auth-challenge',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 10,
});
