import { createPublicKey, createVerify } from 'node:crypto';

import type { CheckOutcome } from './types';

/**
 * Firebase Phone Authentication.
 *
 * Firebase runs the whole SMS exchange on the device, so this backend never
 * sends anything. What arrives as the challenge answer is a Firebase **ID
 * token**; this module proves it is genuine, unexpired, issued for our project,
 * and belongs to the phone number the user is trying to sign in as.
 *
 * Verified locally against Google's published signing certificates — no Admin
 * SDK, no service-account key to store.
 *
 * @see https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */

const CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** Google rotates these roughly daily and sends a max-age we honour. */
let certCache: { keys: Record<string, string>; expiresAt: number } | null = null;

const fetchCertificates = async (): Promise<Record<string, string>> => {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.keys;

  const response = await fetch(CERT_URL);
  if (!response.ok) throw new Error(`could not fetch Google signing certs (${response.status})`);

  const keys = (await response.json()) as Record<string, string>;
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  certCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
};

const decodeSegment = (segment: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));

export const isFirebaseConfigured = (): boolean =>
  (process.env.FIREBASE_PROJECT_ID ?? '').trim().length > 0;

/**
 * Returns `correct: true` only when every check Google documents passes AND the
 * token's phone number matches the account being signed into — without that last
 * check, anyone with a valid Firebase token could sign in as anyone else.
 */
export const verifyFirebaseIdToken = async (
  token: string,
  expectedPhone: string,
): Promise<CheckOutcome> => {
  const projectId = (process.env.FIREBASE_PROJECT_ID ?? '').trim();
  if (!projectId) return { correct: false, reason: 'FIREBASE_PROJECT_ID is not set' };

  const parts = token.split('.');
  if (parts.length !== 3) return { correct: false, reason: 'malformed token' };

  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = decodeSegment(parts[0]);
    claims = decodeSegment(parts[1]);
  } catch {
    return { correct: false, reason: 'unreadable token' };
  }

  if (header.alg !== 'RS256') return { correct: false, reason: `unexpected alg ${header.alg}` };
  const kid = typeof header.kid === 'string' ? header.kid : '';
  if (!kid) return { correct: false, reason: 'missing kid' };

  let certificates: Record<string, string>;
  try {
    certificates = await fetchCertificates();
  } catch (err) {
    return { correct: false, reason: String(err) };
  }

  const certificate = certificates[kid];
  if (!certificate) return { correct: false, reason: 'unknown signing key' };

  // Signature
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const signatureValid = verifier.verify(
    createPublicKey(certificate),
    Buffer.from(parts[2], 'base64url'),
  );
  if (!signatureValid) return { correct: false, reason: 'bad signature' };

  // Claims
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) {
    return { correct: false, reason: 'expired token' };
  }
  if (typeof claims.iat !== 'number' || claims.iat > now + 60) {
    return { correct: false, reason: 'token issued in the future' };
  }
  if (claims.aud !== projectId) return { correct: false, reason: 'wrong audience' };
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) {
    return { correct: false, reason: 'wrong issuer' };
  }
  if (typeof claims.sub !== 'string' || !claims.sub) {
    return { correct: false, reason: 'missing subject' };
  }

  // The token must belong to the number being signed into.
  const tokenPhone = typeof claims.phone_number === 'string' ? claims.phone_number : '';
  if (!tokenPhone) return { correct: false, reason: 'token carries no phone number' };
  if (tokenPhone !== expectedPhone) return { correct: false, reason: 'phone number mismatch' };

  // Firebase records how the identity was proven; only accept a real SMS check.
  const signInProvider = (claims.firebase as { sign_in_provider?: string } | undefined)
    ?.sign_in_provider;
  if (signInProvider && signInProvider !== 'phone') {
    return { correct: false, reason: `unexpected sign-in provider ${signInProvider}` };
  }

  return { correct: true };
};
