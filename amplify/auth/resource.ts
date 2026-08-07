import { defineAuth } from '@aws-amplify/backend';
import { defineAuthChallenge } from './define-auth-challenge/resource';
import { createAuthChallenge } from './create-auth-challenge/resource';
import { verifyAuthChallenge } from './verify-auth-challenge/resource';
import { userManager } from '../functions/user-manager/resource';
import { submitBooking } from '../functions/submit-booking/resource';

/**
 * Phone-number-only authentication.
 *
 * There is no password anywhere in this app. Users are created by staff
 * (admin -> supervisor, supervisor -> customer) and sign in with an SMS code
 * delivered by SNS through the three custom-auth triggers below.
 *
 * Self sign-up is disabled at the user-pool level in backend.ts, so the only way
 * into the system is to be created by someone who is already in it.
 */
export const auth = defineAuth({
  loginWith: {
    phone: true,
  },
  userAttributes: {
    // Optional profile fields staff can fill in when creating an account.
    email: { required: false, mutable: true },
    fullname: { required: false, mutable: true },
    preferredUsername: { required: false, mutable: true },
  },
  // Precedence follows list order: ADMIN outranks SUPERVISOR outranks CUSTOMER.
  groups: ['ADMIN', 'SUPERVISOR', 'CUSTOMER'],
  triggers: {
    defineAuthChallenge,
    createAuthChallenge,
    verifyAuthChallengeResponse: verifyAuthChallenge,
  },
  access: (allow) => [
    // Staff account management: create/delete users and move them between groups.
    allow.resource(userManager).to([
      'createUser',
      'deleteUser',
      'getUser',
      'listUsers',
      'listGroupsForUser',
      'addUserToGroup',
      'removeUserFromGroup',
      'setUserPassword',
      'updateUserAttributes',
      'enableUser',
      'disableUser',
    ]),
    // Public booking auto-provisions the customer so they can track immediately.
    // `updateUserAttributes`/`enableUser` are needed for the repeat-customer path,
    // where the account already exists and only its name/status is refreshed.
    allow.resource(submitBooking).to([
      'createUser',
      'getUser',
      'addUserToGroup',
      'setUserPassword',
      'updateUserAttributes',
      'enableUser',
    ]),
  ],
});
