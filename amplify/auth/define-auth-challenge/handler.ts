import type { DefineAuthChallengeTriggerHandler } from 'aws-lambda';

/** How many wrong codes a user may submit within a single sign-in session. */
const MAX_ROUNDS = 3;

/**
 * Sign-in state machine for phone-only (passwordless) auth.
 *
 * Cognito invokes this trigger:
 *   1. right after InitiateAuth  -> we ask for a CUSTOM_CHALLENGE (an SMS code)
 *   2. after every RespondToAuthChallenge -> we issue tokens, retry, or fail
 *
 * The `userNotFound` branch matters: with PreventUserExistenceErrors enabled,
 * Cognito runs this trigger even for numbers that were never registered. If we
 * did not fail explicitly there, the flow would loop forever and — worse —
 * createAuthChallenge would send an SMS to a stranger's phone.
 */
export const handler: DefineAuthChallengeTriggerHandler = async (event) => {
  const session = event.request.session ?? [];

  if (event.request.userNotFound) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;
  }

  // First round: no challenge has been presented yet.
  if (session.length === 0) {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
    return event;
  }

  const last = session[session.length - 1];

  // Anything other than our custom challenge means the client tried a flow we do
  // not support (SRP, password, migration). Refuse rather than fall through.
  if (last.challengeName !== 'CUSTOM_CHALLENGE') {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;
  }

  if (last.challengeResult === true) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
    return event;
  }

  const rounds = session.filter((s) => s.challengeName === 'CUSTOM_CHALLENGE').length;
  if (rounds >= MAX_ROUNDS) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;
  }

  // Wrong code, retries remain. createAuthChallenge will re-serve the SAME code
  // (it is persisted in DynamoDB) instead of sending another SMS.
  event.response.issueTokens = false;
  event.response.failAuthentication = false;
  event.response.challengeName = 'CUSTOM_CHALLENGE';
  return event;
};
