/**
 * Checks whichever OTP provider is currently configured.
 *
 *   node scripts/test-otp-provider.mjs                 # safe: reserved test number
 *   node scripts/test-otp-provider.mjs +974XXXXXXXX    # sends ONE real message
 *
 * With SNS the script can read the issued code from the OTP table, so it
 * completes a full sign-in unattended. Twilio owns its codes, so for Twilio the
 * script proves the message was accepted for delivery and then waits for you to
 * type the code you received — which is the only way to prove real delivery.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  deleteUser,
  idp,
  provisionUser,
  outputs,
  CLIENT_ID,
  REGION,
  USER_POOL_ID,
  OTP_TABLE,
  createReporter,
} from './lib/backend-test-kit.mjs';
import { InitiateAuthCommand, RespondToAuthChallengeCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, GetFunctionConfigurationCommand, ListFunctionsCommand } from '@aws-sdk/client-lambda';

const r = createReporter();
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const lambda = new LambdaClient({ region: REGION });

const PHONE = process.argv[2] ?? '+15550102222';
const REAL = !!process.argv[2];

/* Read the provider straight off the deployed Lambda, not from local source —
   what matters is what is actually running. */
const findFunction = async (fragment) => {
  let marker;
  do {
    const page = await lambda.send(new ListFunctionsCommand({ Marker: marker, MaxItems: 50 }));
    const hit = (page.Functions ?? []).find((f) => f.FunctionName.toLowerCase().includes(fragment));
    if (hit) return hit.FunctionName;
    marker = page.NextMarker;
  } while (marker);
  return null;
};

const createFn = await findFunction('createauthchallenge');
if (!createFn) {
  console.error('Could not find the create-auth-challenge Lambda. Is the backend deployed?');
  process.exit(1);
}

const config = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: createFn }));
const env = config.Environment?.Variables ?? {};
const provider = env.OTP_PROVIDER ?? 'SNS';

console.log(`\nStars OTP provider test (${REGION})`);
console.log(`  provider     ${provider}`);
if (provider === 'SNS') console.log(`  sender id    ${env.SMS_SENDER_ID || '(account default — Qatar needs one)'}`);
if (provider === 'TWILIO') console.log(`  verify svc   ${env.TWILIO_VERIFY_SERVICE_SID || '(not set)'}`);
if (provider === 'FIREBASE') console.log(`  project      ${env.FIREBASE_PROJECT_ID || '(not set)'}`);
console.log(`  test number  ${PHONE}${REAL ? '  ← a real message will be sent' : '  (reserved fiction range)'}\n`);

if (provider === 'FIREBASE') {
  console.log('  Firebase mode is verified from the device, not from here:');
  console.log('  the app performs the SMS exchange and answers with an ID token.');
  console.log('  Run the app on a device to test. See docs/OTP-PROVIDERS.md.\n');
  process.exit(0);
}

let username = null;
try {
  const user = await provisionUser(PHONE, 'OTP Provider Test', 'CUSTOMER');
  // Never delete an account we did not create — this is usually a real number.
  username = user.created ? user.username : null;
  if (!user.created) console.log('  (existing account — it will be left alone)');
  r.ok('test account provisioned');

  const start = await idp.send(
    new InitiateAuthCommand({
      AuthFlow: 'CUSTOM_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: PHONE },
    }),
  );

  const params = start.ChallengeParameters ?? {};
  r.expect(start.ChallengeName === 'CUSTOM_CHALLENGE', 'challenge issued', start.ChallengeName);
  r.expect(params.provider === provider, 'challenge issued by the configured provider', params.provider);

  if (params.deliveryFailed === 'true') {
    r.fail(
      'provider accepted the message',
      'delivery failed — run: node scripts/logs.mjs createauthchallenge 10',
    );
  } else if (params.throttled === 'true') {
    r.fail('provider accepted the message', 'throttled — wait an hour or use a different number');
  } else {
    r.ok('provider accepted the message', params.destination);
  }

  if (provider === 'SNS') {
    const record = await ddb.send(
      new GetCommand({ TableName: OTP_TABLE, Key: { phone: PHONE }, ConsistentRead: true }),
    );
    const code = record.Item?.code;
    r.expect(!!code && /^\d{6}$/.test(code), 'six-digit code stored');

    if (code) {
      const done = await idp.send(
        new RespondToAuthChallengeCommand({
          ChallengeName: 'CUSTOM_CHALLENGE',
          ClientId: CLIENT_ID,
          Session: start.Session,
          ChallengeResponses: { USERNAME: PHONE, ANSWER: code },
        }),
      );
      r.expect(!!done.AuthenticationResult?.IdToken, 'correct code signs in');
    }
  } else if (provider === 'TWILIO') {
    if (!REAL) {
      console.log(
        '\n  Twilio generates and holds the code, so it cannot be read from here.',
      );
      console.log('  Re-run with your own number to complete the check:');
      console.log('    node scripts/test-otp-provider.mjs +974XXXXXXXX\n');
    } else {
      const rl = createInterface({ input: stdin, output: stdout });
      const code = (await rl.question('  Enter the 6-digit code you received: ')).trim();
      rl.close();

      const done = await idp.send(
        new RespondToAuthChallengeCommand({
          ChallengeName: 'CUSTOM_CHALLENGE',
          ClientId: CLIENT_ID,
          Session: start.Session,
          ChallengeResponses: { USERNAME: PHONE, ANSWER: code },
        }),
      );
      r.expect(!!done.AuthenticationResult?.IdToken, 'the code you received signs in');
    }
  }
} catch (err) {
  r.fail('unexpected error', err?.name ? `${err.name}: ${err.message}` : String(err));
} finally {
  if (username) {
    await deleteUser(username);
    console.log('\n  test account removed');
  }
}

console.log(
  r.state.failures === 0
    ? `\n${provider} provider is working.\n`
    : `\n${r.state.failures} check(s) failed.\n`,
);
process.exit(r.state.failures === 0 ? 0 : 1);
