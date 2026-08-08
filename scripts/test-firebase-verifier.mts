/**
 * Unit checks for the Firebase ID-token verifier.
 *
 *   npx tsx scripts/test-firebase-verifier.mts
 *
 * Google's real signing keys are stubbed with a locally generated key pair, so
 * signatures actually validate. That matters: without it every case would be
 * refused at "unknown signing key" and the claim checks — expiry, audience,
 * issuer, phone match — would never run, so the test would pass even if they
 * were deleted.
 *
 * The accept case is included deliberately. A verifier that refuses everything
 * would satisfy the refusal cases while being useless.
 */
import { createSign, generateKeyPairSync } from 'node:crypto';

const PROJECT = 'stars-test-project';
const PHONE = '+97455512345';
const KID = 'test-signing-key';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

// Stand in for Google's cert endpoint. `createPublicKey` accepts a public-key
// PEM as readily as the X.509 certificate Google actually returns.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: unknown) => {
  const url = String(input);
  if (url.includes('securetoken@system.gserviceaccount.com')) {
    return new Response(JSON.stringify({ [KID]: publicPem }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
    });
  }
  return realFetch(input as never, init as never);
}) as typeof fetch;

// Imported after the stub is in place so the cert cache never sees the real URL.
const { verifyFirebaseIdToken } = await import('../amplify/shared/otp/firebase');

let failures = 0;

const check = async (
  label: string,
  token: string,
  shouldPass: boolean,
  phone = PHONE,
) => {
  const outcome = await verifyFirebaseIdToken(token, phone);
  const good = outcome.correct === shouldPass;
  if (good) {
    console.log(
      `  PASS  ${label} — ${outcome.correct ? 'accepted' : `refused (${outcome.reason})`}`,
    );
  } else {
    failures += 1;
    console.log(
      `  FAIL  ${label} — expected ${shouldPass ? 'accept' : 'refuse'}, got ${
        outcome.correct ? 'accept' : `refuse (${outcome.reason})`
      }`,
    );
  }
};

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** Builds a token signed by our stubbed-in key, so the signature is valid. */
const sign = (claimOverrides: Record<string, unknown> = {}, kid = KID, alg = 'RS256') => {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: 'firebase-uid-123',
    iat: now - 10,
    exp: now + 3600,
    phone_number: PHONE,
    firebase: { sign_in_provider: 'phone' },
    ...claimOverrides,
  };
  for (const [key, value] of Object.entries(claims)) {
    if (value === undefined) delete claims[key];
  }
  const body = `${b64({ alg, kid, typ: 'JWT' })}.${b64(claims)}`;
  const signer = createSign('RSA-SHA256');
  signer.update(body);
  signer.end();
  return `${body}.${signer.sign(privateKey).toString('base64url')}`;
};

console.log('\nFirebase ID-token verifier\n');

process.env.FIREBASE_PROJECT_ID = PROJECT;

/* The one that must be accepted — everything else is meaningless without it. */
await check('a genuine, current, matching token', sign(), true);

/* Structure */
await check('empty token', '', false);
await check('not a JWT', 'just-some-string', false);
await check('two segments only', 'aaa.bbb', false);
await check('unreadable segments', '%%%.%%%.%%%', false);

/* Signature */
await check('alg "none" (signature stripping)', `${b64({ alg: 'none', kid: KID })}.${b64({})}.`, false);
await check('HS256 instead of RS256 (algorithm confusion)', sign({}, KID, 'HS256'), false);
await check('missing kid', sign({}, ''), false);
await check('unknown signing key', sign({}, 'a-key-google-never-published'), false);
await check(
  'tampered payload after signing',
  (() => {
    const parts = sign().split('.');
    return `${parts[0]}.${b64({ aud: PROJECT, phone_number: '+97400000000' })}.${parts[2]}`;
  })(),
  false,
);

/* Claims — these only run because the signature above now validates. */
await check('expired token', sign({ exp: Math.floor(Date.now() / 1000) - 60 }), false);
await check('issued in the future', sign({ iat: Math.floor(Date.now() / 1000) + 600 }), false);
await check('wrong audience (another Firebase project)', sign({ aud: 'someone-elses-project' }), false);
await check('wrong issuer', sign({ iss: 'https://evil.example.com' }), false);
await check('missing subject', sign({ sub: undefined }), false);
await check('token carries no phone number', sign({ phone_number: undefined }), false);
await check('signed in anonymously, not by phone', sign({ firebase: { sign_in_provider: 'anonymous' } }), false);

/* The critical one: a perfectly valid token for a DIFFERENT number. */
await check(
  "another person's valid token",
  sign({ phone_number: '+97499999999' }),
  false,
  PHONE,
);

/* Project isolation */
process.env.FIREBASE_PROJECT_ID = '';
await check('no project configured', sign(), false);

console.log(
  failures === 0
    ? '\nVerifier accepts genuine tokens and refuses every forgery.\n'
    : `\n${failures} case(s) behaved incorrectly.\n`,
);
process.exit(failures === 0 ? 0 : 1);
