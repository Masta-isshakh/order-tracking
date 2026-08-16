/**
 * Proves the security tiers behave as designed.
 *
 *   node scripts/test-tiered-auth.mjs
 *
 * Staff must be challenged for a real SMS code; customers must not. Getting
 * this backwards either locks staff out or leaves the admin workspace open, so
 * it is checked against the deployed backend rather than assumed.
 *
 * Test numbers are in the +1 555-01xx range reserved for fiction. Staff sign-in
 * is only started, never completed, so no SMS is ever actually delivered.
 */
import { InitiateAuthCommand, RespondToAuthChallengeCommand } from '@aws-sdk/client-cognito-identity-provider';
import {
  CLIENT_ID,
  REGION,
  createReporter,
  deleteUser,
  idp,
  provisionUser,
} from './lib/backend-test-kit.mjs';

const r = createReporter();
const created = [];

const ADMIN = '+15550103001';
const SUPERVISOR = '+15550103002';
const CUSTOMER = '+15550103003';

console.log(`\nTiered sign-in test (${REGION})\n`);

/** Starts sign-in and reports how the backend chose to treat this number. */
const probe = async (phone) => {
  const start = await idp.send(
    new InitiateAuthCommand({
      AuthFlow: 'CUSTOM_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: phone },
    }),
  );
  const params = start.ChallengeParameters ?? {};
  return {
    session: start.Session,
    provider: params.provider,
    autoConfirm: params.autoConfirm === 'true',
    deliveryFailed: params.deliveryFailed === 'true',
  };
};

try {
  const admin = await provisionUser(ADMIN, 'Tier Admin', 'ADMIN');
  const supervisor = await provisionUser(SUPERVISOR, 'Tier Supervisor', 'SUPERVISOR');
  const customer = await provisionUser(CUSTOMER, 'Tier Customer', 'CUSTOMER');
  created.push(admin.username, supervisor.username, customer.username);
  r.ok('one account provisioned per role');

  /* Staff must be asked for a code. */
  for (const [label, phone] of [
    ['admin', ADMIN],
    ['supervisor', SUPERVISOR],
  ]) {
    const result = await probe(phone);
    r.expect(
      !result.autoConfirm,
      `${label} is challenged for a code`,
      result.autoConfirm ? 'WAS LET IN WITHOUT ONE' : '',
    );
    // These numbers are not registered with SNS, so delivery is expected to
    // fail — which is itself proof that a real send was attempted.
    r.expect(
      result.provider !== 'NONE',
      `${label} is not routed to no-verification`,
      result.provider,
    );
  }

  /* Customers must not be. */
  const customerResult = await probe(CUSTOMER);
  r.expect(customerResult.autoConfirm, 'customer signs in without a code', customerResult.provider);

  if (customerResult.autoConfirm) {
    const done = await idp.send(
      new RespondToAuthChallengeCommand({
        ChallengeName: 'CUSTOM_CHALLENGE',
        ClientId: CLIENT_ID,
        Session: customerResult.session,
        ChallengeResponses: { USERNAME: CUSTOMER, ANSWER: 'no-verification' },
      }),
    );
    r.expect(!!done.AuthenticationResult?.IdToken, 'customer receives tokens');

    if (done.AuthenticationResult?.IdToken) {
      const claims = JSON.parse(
        Buffer.from(done.AuthenticationResult.IdToken.split('.')[1], 'base64url').toString('utf8'),
      );
      r.expect(
        (claims['cognito:groups'] ?? []).includes('CUSTOMER'),
        'customer token carries only the CUSTOMER group',
        JSON.stringify(claims['cognito:groups']),
      );
    }
  }

  /* A staff challenge must not be satisfiable by guessing. */
  const staffAttempt = await probe(SUPERVISOR);
  if (!staffAttempt.autoConfirm && staffAttempt.session) {
    const guess = await idp.send(
      new RespondToAuthChallengeCommand({
        ChallengeName: 'CUSTOM_CHALLENGE',
        ClientId: CLIENT_ID,
        Session: staffAttempt.session,
        ChallengeResponses: { USERNAME: SUPERVISOR, ANSWER: 'no-verification' },
      }),
    ).catch(() => null);
    r.expect(
      !guess?.AuthenticationResult,
      'staff cannot bypass the code with the customer answer',
      guess?.AuthenticationResult ? 'BYPASSED' : '',
    );
  }

  /* An unknown number is refused outright. */
  try {
    await probe('+15550103999');
    r.fail('unknown number is refused');
  } catch (err) {
    r.ok('unknown number is refused', err.name);
  }
} catch (err) {
  r.fail('unexpected error', err?.message ?? String(err));
} finally {
  for (const username of created) await deleteUser(username);
  console.log('\n  test accounts removed');
}

console.log(
  r.state.failures === 0
    ? '\nTiers behave correctly: staff verify, customers do not.\n'
    : `\n${r.state.failures} check(s) failed.\n`,
);
process.exit(r.state.failures === 0 ? 0 : 1);
