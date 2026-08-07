import { defineFunction } from '@aws-amplify/backend';

/**
 * Every Cognito write the app needs: creating supervisors and customers,
 * placing them in the right group, and disabling/removing accounts.
 *
 * Keeping this in one Lambda means the mobile client never holds admin
 * credentials — it only calls GraphQL mutations guarded by group rules.
 */
export const userManager = defineFunction({
  name: 'user-manager',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30,
  environment: {
    DEFAULT_DIAL_CODE: '974',
  },
});
