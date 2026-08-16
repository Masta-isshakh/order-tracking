import { defineFunction } from '@aws-amplify/backend';

/**
 * Manages the numbers Amazon SNS is allowed to text.
 *
 * While the account is in the SMS sandbox, SNS will only deliver to
 * destinations that have been registered and confirmed with a code. That is an
 * AWS account-level list, not something the app can store — so the admin
 * workspace drives it through this function.
 *
 * Once AWS grants production SMS access the list stops mattering and these
 * screens can be retired; nothing else in the app depends on them.
 */
export const smsRegistry = defineFunction({
  name: 'sms-registry',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30,
  environment: {
    DEFAULT_DIAL_CODE: '974',
  },
});
