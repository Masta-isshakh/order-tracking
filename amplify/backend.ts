import { defineBackend } from '@aws-amplify/backend';
import { AttributeType, BillingMode, Table, TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';

import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { defineAuthChallenge } from './auth/define-auth-challenge/resource';
import { createAuthChallenge } from './auth/create-auth-challenge/resource';
import { verifyAuthChallenge } from './auth/verify-auth-challenge/resource';
import { userManager } from './functions/user-manager/resource';
import { submitBooking } from './functions/submit-booking/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  defineAuthChallenge,
  createAuthChallenge,
  verifyAuthChallenge,
  userManager,
  submitBooking,
});

/* -------------------------------------------------------------------------- *
 * One-time-password store
 *
 * The issued code lives here rather than in Cognito's challenge metadata so that
 * a retry (wrong digit) and a resend (tapped too early) both re-serve the SAME
 * code instead of sending another SMS. It doubles as the rate limiter that keeps
 * the public sign-in screen from being used to pump SMS charges.
 * -------------------------------------------------------------------------- */
const supportStack = backend.createStack('StarsAuthSupport');

const otpTable = new Table(supportStack, 'OtpChallengeTable', {
  partitionKey: { name: 'phone', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',
  encryption: TableEncryption.AWS_MANAGED,
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
  removalPolicy: RemovalPolicy.DESTROY,
});

const createChallengeFn = backend.createAuthChallenge.resources.lambda;
const verifyChallengeFn = backend.verifyAuthChallenge.resources.lambda;

otpTable.grantReadWriteData(createChallengeFn);
otpTable.grantReadWriteData(verifyChallengeFn);

backend.createAuthChallenge.addEnvironment('OTP_TABLE_NAME', otpTable.tableName);
backend.verifyAuthChallenge.addEnvironment('OTP_TABLE_NAME', otpTable.tableName);

/* -------------------------------------------------------------------------- *
 * SMS delivery
 *
 * SMS Publish targets a bare phone number, which has no ARN, so the resource
 * must be "*". The action list is deliberately minimal — publishing only.
 * -------------------------------------------------------------------------- */
createChallengeFn.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['sns:Publish'],
    resources: ['*'],
    conditions: {
      // Belt and braces: this role can text people, but can never publish to a
      // topic in the account.
      Null: { 'sns:TopicArn': 'true' },
    },
  }),
);

/* -------------------------------------------------------------------------- *
 * User pool hardening
 * -------------------------------------------------------------------------- */
const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources;

// Nobody signs themselves up. Accounts exist because an admin created a
// supervisor, or a supervisor/booking created a customer.
cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

// Cognito never sends its own SMS even though phone_number stays in
// AutoVerifiedAttributes: accounts are only ever created by AdminCreateUser with
// MessageAction=SUPPRESS and phone_number_verified already true, self sign-up is
// off, MFA is NONE, and no flow updates phone_number after creation. Clearing
// AutoVerifiedAttributes here is rejected by Cognito, because it must remain a
// superset of AttributesRequireVerificationBeforeUpdate.

// CUSTOM_AUTH is the only interactive flow the app uses. USER_SRP is dropped so a
// stolen client id cannot be used to probe for passwords.
cfnUserPoolClient.explicitAuthFlows = ['ALLOW_CUSTOM_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'];
cfnUserPoolClient.preventUserExistenceErrors = 'ENABLED';
// Codes are short-lived; sessions should not be. Staff use the app all day.
cfnUserPoolClient.accessTokenValidity = 60; // minutes
cfnUserPoolClient.idTokenValidity = 60;
cfnUserPoolClient.refreshTokenValidity = 30; // days
cfnUserPoolClient.tokenValidityUnits = {
  accessToken: 'minutes',
  idToken: 'minutes',
  refreshToken: 'days',
};

/* -------------------------------------------------------------------------- *
 * Outputs consumed by scripts/ and by support runbooks.
 * -------------------------------------------------------------------------- */
backend.addOutput({
  custom: {
    otpTableName: otpTable.tableName,
    region: supportStack.region,
  },
});
