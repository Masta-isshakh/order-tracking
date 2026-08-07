/**
 * Creates the first ADMIN account. Run once per environment.
 *
 *   node scripts/seed-admin.mjs +97455512345 "Owner Name"
 *
 * There is deliberately no way to create an admin from inside the app: the first
 * one has to come from someone with AWS credentials, and every later account is
 * created by an admin (supervisors) or a supervisor (customers).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes, randomInt } from 'node:crypto';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';

const [, , rawPhone, ...nameParts] = process.argv;
const name = nameParts.join(' ').trim() || 'Administrator';

if (!rawPhone) {
  console.error('Usage: node scripts/seed-admin.mjs +97455512345 "Owner Name"');
  process.exit(1);
}

const phone = normalize(rawPhone);
if (!phone) {
  console.error(`"${rawPhone}" is not a valid phone number. Use full international form, e.g. +97455512345`);
  process.exit(1);
}

function normalize(value) {
  let v = String(value).trim();
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  const digits = v.replace(/\D/g, '');
  const e164 = v.startsWith('+') ? `+${digits}` : digits.length === 8 ? `+974${digits}` : `+${digits}`;
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

const here = dirname(fileURLToPath(import.meta.url));
const outputs = JSON.parse(readFileSync(join(here, '..', 'amplify_outputs.json'), 'utf8'));
const UserPoolId = outputs.auth.user_pool_id;
const client = new CognitoIdentityProviderClient({ region: outputs.auth.aws_region });

const throwawayPassword = () => {
  const symbols = '!@#$%^&*()-_=+';
  return `Aa1${symbols[randomInt(symbols.length)]}${randomBytes(18).toString('base64url').replace(/[^A-Za-z0-9]/g, '')}`;
};

let username;
try {
  const existing = await client.send(new AdminGetUserCommand({ UserPoolId, Username: phone }));
  username = existing.Username;
  console.log(`Account already exists for ${phone}; making sure it is in ADMIN.`);
} catch (err) {
  if (!(err instanceof UserNotFoundException)) throw err;

  const created = await client.send(
    new AdminCreateUserCommand({
      UserPoolId,
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
  username = created.User.Username;

  // Moves the account out of FORCE_CHANGE_PASSWORD; custom auth cannot sign in
  // a user that is still waiting to set a password.
  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId,
      Username: username,
      Password: throwawayPassword(),
      Permanent: true,
    }),
  );
  console.log(`Created ${phone}.`);
}

await client.send(
  new AdminAddUserToGroupCommand({ UserPoolId, Username: username, GroupName: 'ADMIN' }),
);

console.log(`\n${name} (${phone}) is now an ADMIN.`);
console.log('Open Stars, go to the Track tab, enter this number and sign in with the SMS code.\n');
