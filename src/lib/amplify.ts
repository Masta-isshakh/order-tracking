// Must be the first import in the app: aws-amplify needs a crypto polyfill
// before any of its modules are evaluated.
import 'react-native-get-random-values';

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../../amplify_outputs.json';
import type { Schema } from '../../amplify/data/resource';

Amplify.configure(outputs);

/**
 * Signed-in client. Cognito group rules decide what each role can reach, so the
 * same client instance serves admins, supervisors and customers.
 */
export const client = generateClient<Schema>();

/**
 * Guest client. The Home and Book tabs render before anyone signs in, and those
 * requests must be signed with the identity pool's unauthenticated role.
 */
export const guestClient = generateClient<Schema>({ authMode: 'identityPool' });

export type { Schema };

export type Order = Schema['Order']['type'];
export type OrderStep = Schema['OrderStep']['type'];
export type ChatMessage = Schema['ChatMessage']['type'];
export type Service = Schema['Service']['type'];
export type Package = Schema['Package']['type'];
export type CustomerProfile = Schema['CustomerProfile']['type'];
export type SupervisorProfile = Schema['SupervisorProfile']['type'];
export type AppSettings = Schema['AppSettings']['type'];

/**
 * Unwraps the `{ data, errors }` envelope. Amplify resolves rather than rejects
 * on GraphQL errors, so without this every call site would need to check twice.
 */
export const must = <T>(
  result: { data?: T | null; errors?: readonly { message: string }[] | null },
  context: string,
): T => {
  if (result.errors?.length) {
    throw new Error(`${context}: ${result.errors.map((e) => e.message).join('; ')}`);
  }
  if (result.data === null || result.data === undefined) {
    throw new Error(`${context}: no data returned`);
  }
  return result.data;
};
