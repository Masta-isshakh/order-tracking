/**
 * Verifies the deployed backend is wired the way the app expects.
 *
 * Run: node scripts/check-backend.mjs
 *
 * Uses the same credential chain as `ampx`, so it reports what the deployment
 * actually produced rather than what the local AWS CLI profile can see.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
  DescribeUserPoolCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const here = dirname(fileURLToPath(import.meta.url));
const outputs = JSON.parse(readFileSync(join(here, '..', 'amplify_outputs.json'), 'utf8'));

const region = outputs.auth.aws_region;
const client = new CognitoIdentityProviderClient({ region });

const pass = (label, value) => console.log(`  PASS  ${label}${value ? ` — ${value}` : ''}`);
const fail = (label, value) => {
  console.log(`  FAIL  ${label}${value ? ` — ${value}` : ''}`);
  process.exitCode = 1;
};
const check = (ok, label, value) => (ok ? pass(label, value) : fail(label, value));

console.log(`\nStars backend check (${region})`);
console.log(`  user pool: ${outputs.auth.user_pool_id}`);
console.log(`  app client: ${outputs.auth.user_pool_client_id}\n`);

const pool = await client.send(
  new DescribeUserPoolCommand({ UserPoolId: outputs.auth.user_pool_id }),
);
const app = await client.send(
  new DescribeUserPoolClientCommand({
    UserPoolId: outputs.auth.user_pool_id,
    ClientId: outputs.auth.user_pool_client_id,
  }),
);

const p = pool.UserPool;
const c = app.UserPoolClient;

check(
  JSON.stringify(p.UsernameAttributes) === JSON.stringify(['phone_number']),
  'sign-in is phone-number only',
  JSON.stringify(p.UsernameAttributes),
);
check(
  p.AdminCreateUserConfig?.AllowAdminCreateUserOnly === true,
  'public self sign-up is disabled',
);
check(p.MfaConfiguration === 'OFF' || p.MfaConfiguration === 'NONE', 'MFA off', p.MfaConfiguration);

const triggers = p.LambdaConfig ?? {};
check(!!triggers.DefineAuthChallenge, 'DefineAuthChallenge trigger attached');
check(!!triggers.CreateAuthChallenge, 'CreateAuthChallenge trigger attached');
check(!!triggers.VerifyAuthChallengeResponse, 'VerifyAuthChallengeResponse trigger attached');

const flows = c.ExplicitAuthFlows ?? [];
check(flows.includes('ALLOW_CUSTOM_AUTH'), 'ALLOW_CUSTOM_AUTH enabled', flows.join(', '));
check(
  !flows.some((f) => f.includes('PASSWORD') || f.includes('SRP')),
  'no password/SRP flows exposed',
  flows.join(', '),
);
check(
  c.PreventUserExistenceErrors === 'ENABLED',
  'user-existence errors prevented',
  c.PreventUserExistenceErrors,
);

const groups = (outputs.auth.groups ?? []).flatMap((g) => Object.keys(g));
check(
  ['ADMIN', 'SUPERVISOR', 'CUSTOMER'].every((g) => groups.includes(g)),
  'ADMIN / SUPERVISOR / CUSTOMER groups exist',
  groups.join(', '),
);

const users = await client.send(
  new ListUsersCommand({ UserPoolId: outputs.auth.user_pool_id, Limit: 5 }),
);
console.log(`\n  ${users.Users?.length ?? 0} user(s) currently in the pool.`);
if ((users.Users?.length ?? 0) === 0) {
  console.log('  Next: npm run seed:admin -- +974XXXXXXXX "Your Name"');
}
console.log('');
