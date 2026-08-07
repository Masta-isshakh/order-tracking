import { defineStorage } from '@aws-amplify/backend';

/**
 * Image storage.
 *
 * `catalog/` is world-readable because the Home and Book-a-Service tabs render
 * before anyone signs in. Everything else requires a signed-in user; order and
 * chat images are keyed by UUID and only ever surfaced through a record the
 * caller is already authorised to read.
 */
export const storage = defineStorage({
  name: 'starsMedia',
  access: (allow) => ({
    'catalog/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
      allow.groups(['ADMIN', 'SUPERVISOR']).to(['read', 'write', 'delete']),
    ],
    'branding/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
      allow.groups(['ADMIN']).to(['read', 'write', 'delete']),
    ],
    'orders/*': [
      allow.authenticated.to(['read']),
      allow.groups(['ADMIN', 'SUPERVISOR']).to(['read', 'write', 'delete']),
    ],
    'chat/*': [allow.authenticated.to(['read', 'write'])],
  }),
});
