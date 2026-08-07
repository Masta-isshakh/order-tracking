/**
 * End-to-end test of the passwordless phone sign-in.
 *
 *   node scripts/test-auth-flow.mjs [+E164]
 *
 * Drives the real Cognito custom-auth flow, reads the issued code straight out of
 * the OTP table, and checks that a correct code signs in while a wrong code, an
 * unknown number and a replayed code all fail. The test account is deleted at the
 * end.
 *
 * The default number is in the +1 555-01xx range, which telecom standards reserve
 * for fiction, so no real handset is ever texted. Pass your own number to also
 * confirm real SMS delivery (that costs one message).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes, randomInt } from 'node:crypto';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const here = dirname(fileURLToPath(import.meta.url));
const outputs = JSON.parse(readFileSync(join(here, '..', 'amplify_outputs.json'), 'utf8'));

const region = outputs.auth.aws_region;
const UserPoolId = outputs.auth.user_pool_id;
const ClientId = outputs.auth.user_pool_client_id;
const OtpTable = outputs.custom?.otpTableName;

const PHONE = process.argv[2] ?? '+15550100137';
const REAL_SMS = !!process.argv[2];

const idp = new CognitoIdentityProviderClient({ region });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

let failures = 0;
const ok = (label, extra = '') => console.log(`  PASS  ${label}${extra ? ` — ${extra}` : ''}`);
const bad = (label, extra = '') => {
  failures += 1;
  console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ''}`);
};
const expect = (condition, label, extra) => (condition ? ok(label, extra) : bad(label, extra));

const password = () =>
  `Aa1!${randomBytes(18).toString('base64url').replace(/[^A-Za-z0-9]/g, '')}${randomInt(9)}`;

const readIssuedCode = async (phone) => {
  const res = await ddb.send(new GetCommand({ TableName: OtpTable, Key: { phone }, ConsistentRead: true }));
  return res.Item ?? null;
};

const startAuth = (phone) =>
  idp.send(
    new InitiateAuthCommand({
      AuthFlow: 'CUSTOM_AUTH',
      ClientId,
      AuthParameters: { USERNAME: phone },
    }),
  );

const answer = (session, phone, code) =>
  idp.send(
    new RespondToAuthChallengeCommand({
      ChallengeName: 'CUSTOM_CHALLENGE',
      ClientId,
      Session: session,
      ChallengeResponses: { USERNAME: phone, ANSWER: code },
    }),
  );

const decodeJwt = (token) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

console.log(`\nStars auth flow test (${region})`);
console.log(`  pool ${UserPoolId}`);
console.log(`  test number ${PHONE}${REAL_SMS ? ' (real SMS will be sent)' : ' (reserved fiction range)'}\n`);

if (!OtpTable) {
  console.error('amplify_outputs.json has no custom.otpTableName — redeploy the backend.');
  process.exit(1);
}

let createdUsername = null;

try {
  /* 1. An unregistered number must be refused before any SMS is sent. */
  const strangerPhone = '+15550100999';
  try {
    await startAuth(strangerPhone);
    bad('unknown number is refused', 'the flow started anyway');
  } catch (err) {
    expect(
      err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException',
      'unknown number is refused without sending SMS',
      err.name,
    );
  }
  const strangerRecord = await readIssuedCode(strangerPhone);
  expect(!strangerRecord, 'no code was issued for the unknown number');

  /* 2. Provision a customer the way the app does. */
  const created = await idp.send(
    new AdminCreateUserCommand({
      UserPoolId,
      Username: PHONE,
      UserAttributes: [
        { Name: 'phone_number', Value: PHONE },
        { Name: 'phone_number_verified', Value: 'true' },
        { Name: 'name', Value: 'Auth Flow Test' },
      ],
      MessageAction: 'SUPPRESS',
      DesiredDeliveryMediums: [],
    }),
  );
  createdUsername = created.User.Username;
  await idp.send(
    new AdminSetUserPasswordCommand({
      UserPoolId,
      Username: createdUsername,
      Password: password(),
      Permanent: true,
    }),
  );
  await idp.send(
    new AdminAddUserToGroupCommand({
      UserPoolId,
      Username: createdUsername,
      GroupName: 'CUSTOMER',
    }),
  );
  ok('test customer provisioned');

  /* 3. Start sign-in: a challenge and an SMS. */
  const first = await startAuth(PHONE);
  expect(first.ChallengeName === 'CUSTOM_CHALLENGE', 'custom challenge issued', first.ChallengeName);
  expect(
    !!first.ChallengeParameters?.destination,
    'masked destination returned to the client',
    first.ChallengeParameters?.destination,
  );
  expect(
    first.ChallengeParameters?.deliveryFailed !== 'true',
    'SNS accepted the message',
    first.ChallengeParameters?.deliveryFailed === 'true' ? 'delivery failed — check CloudWatch' : '',
  );

  const record = await readIssuedCode(PHONE);
  expect(!!record?.code && /^\d{6}$/.test(record.code), 'six-digit code stored with a TTL');
  expect(record?.expiresAt > Date.now(), 'code has not already expired');

  /* 4. A wrong code must not sign anyone in. */
  const wrong = String((Number(record.code) + 1) % 1000000).padStart(6, '0');
  const wrongAttempt = await answer(first.Session, PHONE, wrong);
  expect(
    !wrongAttempt.AuthenticationResult && wrongAttempt.ChallengeName === 'CUSTOM_CHALLENGE',
    'wrong code is rejected and a retry is offered',
  );

  const afterWrong = await readIssuedCode(PHONE);
  expect(
    afterWrong?.code === record.code && afterWrong?.sendCount === record.sendCount,
    'retry re-serves the same code without sending another SMS',
  );

  /* 5. The right code signs in with the correct group. */
  const success = await answer(wrongAttempt.Session, PHONE, record.code);
  expect(!!success.AuthenticationResult?.IdToken, 'correct code returns tokens');

  if (success.AuthenticationResult?.IdToken) {
    const claims = decodeJwt(success.AuthenticationResult.IdToken);
    expect(claims.phone_number === PHONE, 'id token carries the phone number', claims.phone_number);
    expect(
      (claims['cognito:groups'] ?? []).includes('CUSTOMER'),
      'id token carries the CUSTOMER group',
      JSON.stringify(claims['cognito:groups']),
    );
    expect(!!success.AuthenticationResult.RefreshToken, 'refresh token issued');
  }

  /* 6. The code must be single-use. */
  const burned = await readIssuedCode(PHONE);
  expect(!burned, 'code is deleted after a successful sign-in');

  const replay = await startAuth(PHONE);
  const replayed = await answer(replay.Session, PHONE, record.code);
  expect(!replayed.AuthenticationResult, 'the old code cannot be replayed');
} catch (err) {
  bad('unexpected error', err?.name ? `${err.name}: ${err.message}` : String(err));
} finally {
  if (createdUsername) {
    await idp
      .send(new AdminDeleteUserCommand({ UserPoolId, Username: createdUsername }))
      .then(() => console.log('\n  cleaned up the test account'))
      .catch(() => console.log('\n  could not delete the test account — remove it manually'));
  }
}

console.log(failures === 0 ? '\nAll auth checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
