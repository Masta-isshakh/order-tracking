/**
 * Shared helpers for the backend integration scripts.
 *
 * Talks to the deployed AppSync API the same way the app does — with a Cognito
 * id token for signed-in roles, and with SigV4-signed identity-pool credentials
 * for the guest paths — so the tests exercise the real authorization rules.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes, randomInt } from 'node:crypto';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';

const here = dirname(fileURLToPath(import.meta.url));
export const outputs = JSON.parse(readFileSync(join(here, '..', '..', 'amplify_outputs.json'), 'utf8'));

export const REGION = outputs.auth.aws_region;
export const USER_POOL_ID = outputs.auth.user_pool_id;
export const CLIENT_ID = outputs.auth.user_pool_client_id;
export const IDENTITY_POOL_ID = outputs.auth.identity_pool_id;
export const GRAPHQL_URL = outputs.data.url;
export const OTP_TABLE = outputs.custom?.otpTableName;

export const idp = new CognitoIdentityProviderClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const throwawayPassword = () =>
  `Aa1!${randomBytes(18).toString('base64url').replace(/[^A-Za-z0-9]/g, '')}${randomInt(9)}`;

/**
 * Creates (or reuses) a pool user in the given group.
 *
 * `created` says whether this call brought the account into existence. Callers
 * MUST check it before cleaning up: deleting a pre-existing account — a real
 * admin who happens to share the test number — destroys live access.
 */
export const provisionUser = async (phone, name, group) => {
  let username;
  let sub;
  let created = false;

  try {
    const existing = await idp.send(new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: phone }));
    username = existing.Username;
    sub = existing.UserAttributes.find((a) => a.Name === 'sub')?.Value;
  } catch (err) {
    if (!(err instanceof UserNotFoundException)) throw err;
    const newUser = await idp.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: phone,
        UserAttributes: [
          { Name: 'phone_number', Value: phone },
          { Name: 'phone_number_verified', Value: 'true' },
          { Name: 'name', Value: name },
        ],
        MessageAction: 'SUPPRESS',
        DesiredDeliveryMediums: [],
      }),
    );
    username = newUser.User.Username;
    sub = newUser.User.Attributes.find((a) => a.Name === 'sub')?.Value;
    created = true;
    await idp.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        Password: throwawayPassword(),
        Permanent: true,
      }),
    );
  }

  await idp.send(
    new AdminAddUserToGroupCommand({ UserPoolId: USER_POOL_ID, Username: username, GroupName: group }),
  );

  return { phone, username, sub, group, created };
};

export const deleteUser = async (username) => {
  try {
    await idp.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: username }));
  } catch {
    // Already gone.
  }
};

/**
 * Signs in through the real custom-auth flow, reading the issued code from the
 * OTP table instead of a handset. Proves the whole trigger chain works for each
 * role, not just that the account exists.
 */
export const signInWithOtp = async (phone) => {
  const start = await idp.send(
    new InitiateAuthCommand({
      AuthFlow: 'CUSTOM_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: phone },
    }),
  );

  // No-verification mode: the challenge is satisfied by any answer, so there is
  // no code to look up.
  if (start.ChallengeParameters?.provider === 'NONE') {
    const done = await idp.send(
      new RespondToAuthChallengeCommand({
        ChallengeName: 'CUSTOM_CHALLENGE',
        ClientId: CLIENT_ID,
        Session: start.Session,
        ChallengeResponses: { USERNAME: phone, ANSWER: 'no-verification' },
      }),
    );
    const token = done.AuthenticationResult?.IdToken;
    if (!token) throw new Error(`no-verification sign-in failed for ${phone}`);
    return token;
  }

  const record = await ddb.send(
    new GetCommand({ TableName: OTP_TABLE, Key: { phone }, ConsistentRead: true }),
  );
  const code = record.Item?.code;
  if (!code) {
    // Only SNS stores the code where a test can read it. Twilio and Firebase
    // hold it themselves by design, so unattended sign-in is impossible there.
    const provider = start.ChallengeParameters?.provider ?? 'unknown';
    if (provider !== 'SNS') {
      throw new Error(
        `these tests need OTP_PROVIDER='SNS' (currently '${provider}'). ` +
          `${provider} keeps the code on its own servers, so a script cannot read it. ` +
          `Set OTP_PROVIDER back to 'SNS' in amplify/auth/otp-config.ts and redeploy, ` +
          `or use "npm run check:otp -- +974..." which asks you to type the code.`,
      );
    }
    throw new Error(`no OTP was issued for ${phone}`);
  }

  const done = await idp.send(
    new RespondToAuthChallengeCommand({
      ChallengeName: 'CUSTOM_CHALLENGE',
      ClientId: CLIENT_ID,
      Session: start.Session,
      ChallengeResponses: { USERNAME: phone, ANSWER: code },
    }),
  );

  const idToken = done.AuthenticationResult?.IdToken;
  if (!idToken) throw new Error(`sign-in failed for ${phone}`);
  return idToken;
};

/** Runs a GraphQL document as a signed-in user. */
export const gqlAsUser = async (idToken, query, variables = {}) => {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: idToken },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
};

/** Runs a GraphQL document as an unauthenticated visitor (identity pool + SigV4). */
export const gqlAsGuest = async (query, variables = {}) => {
  const credentials = await fromCognitoIdentityPool({
    identityPoolId: IDENTITY_POOL_ID,
    clientConfig: { region: REGION },
  })();

  const url = new URL(GRAPHQL_URL);
  const body = JSON.stringify({ query, variables });

  const signer = new SignatureV4({
    credentials,
    region: REGION,
    service: 'appsync',
    sha256: Sha256,
  });

  const signed = await signer.sign({
    method: 'POST',
    hostname: url.hostname,
    path: url.pathname,
    protocol: url.protocol,
    headers: { 'Content-Type': 'application/json', host: url.hostname },
    body,
  });

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: signed.headers,
    body,
  });
  return response.json();
};

/** Minimal assertion helpers with a shared failure counter. */
export const createReporter = () => {
  const state = { failures: 0 };
  return {
    state,
    ok: (label, extra = '') => console.log(`  PASS  ${label}${extra ? ` — ${extra}` : ''}`),
    fail: (label, extra = '') => {
      state.failures += 1;
      console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ''}`);
    },
    expect(condition, label, extra = '') {
      if (condition) this.ok(label, extra);
      else this.fail(label, extra);
      return condition;
    },
  };
};

/** True when the response is an authorization refusal rather than a real error. */
export const isUnauthorized = (result) =>
  (result.errors ?? []).some(
    (error) =>
      error.errorType === 'Unauthorized' ||
      /not authorized/i.test(error.message ?? ''),
  );
