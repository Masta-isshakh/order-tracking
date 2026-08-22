/**
 * Creates the first administrator — the one account that cannot be made from
 * inside the app, because there is nobody to make it yet.
 *
 *   node scripts/seed-admin.mjs +97455708226 "Owner Name"
 *   node scripts/seed-admin.mjs +97455708226 "Owner Name" --code 123456
 *
 * Does both things a staff sign-in needs:
 *   1. a Cognito account in the ADMIN group
 *   2. the number registered with SNS, so the sign-in code can actually arrive
 *
 * Safe to re-run: an existing account is reused and simply confirmed to be in
 * the right group.
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
import {
  CreateSMSSandboxPhoneNumberCommand,
  GetSMSSandboxAccountStatusCommand,
  ListSMSSandboxPhoneNumbersCommand,
  SNSClient,
  VerifySMSSandboxPhoneNumberCommand,
} from '@aws-sdk/client-sns';

const args = process.argv.slice(2);
const codeIndex = args.indexOf('--code');
const oneTimeCode = codeIndex >= 0 ? args[codeIndex + 1] : null;

// Guard the -1 case: with no `--code` present, `codeIndex + 1` is 0, and
// filtering on it would silently drop the first argument — the phone number.
const positional =
  codeIndex >= 0 ? args.filter((_, i) => i !== codeIndex && i !== codeIndex + 1) : args;

const [rawPhone, ...nameParts] = positional;
const name = nameParts.join(' ').trim() || 'Administrator';

if (!rawPhone) {
  console.error('Usage: node scripts/seed-admin.mjs +97455708226 "Owner Name" [--code 123456]');
  process.exit(1);
}

const normalize = (value) => {
  let v = String(value).trim();
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  const digits = v.replace(/\D/g, '');
  const e164 = v.startsWith('+') ? `+${digits}` : digits.length === 8 ? `+974${digits}` : `+${digits}`;
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
};

const phone = normalize(rawPhone);
if (!phone) {
  console.error(`"${rawPhone}" is not a valid phone number. Use full international form, e.g. +97455512345`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const outputs = JSON.parse(readFileSync(join(here, '..', 'amplify_outputs.json'), 'utf8'));
const UserPoolId = outputs.auth.user_pool_id;
const region = outputs.auth.aws_region;

const idp = new CognitoIdentityProviderClient({ region });
const sns = new SNSClient({ region });

const throwawayPassword = () => {
  const symbols = '!@#$%^&*()-_=+';
  return `Aa1${symbols[randomInt(symbols.length)]}${randomBytes(18).toString('base64url').replace(/[^A-Za-z0-9]/g, '')}`;
};

console.log(`\nFirst administrator — ${name} (${phone})\n`);

/* ---------------------------------------------------------------- *
 * 1. Cognito account in the ADMIN group
 * ---------------------------------------------------------------- */
let username;
try {
  const existing = await idp.send(new AdminGetUserCommand({ UserPoolId, Username: phone }));
  username = existing.Username;
  console.log('  Cognito   account already exists');
} catch (err) {
  if (!(err instanceof UserNotFoundException)) throw err;

  const created = await idp.send(
    new AdminCreateUserCommand({
      UserPoolId,
      Username: phone,
      UserAttributes: [
        { Name: 'phone_number', Value: phone },
        { Name: 'phone_number_verified', Value: 'true' },
        { Name: 'name', Value: name },
      ],
      // Cognito must never send its own message; the app owns the whole flow.
      MessageAction: 'SUPPRESS',
      DesiredDeliveryMediums: [],
    }),
  );
  username = created.User.Username;

  // Moves the account out of FORCE_CHANGE_PASSWORD, which custom auth cannot use.
  await idp.send(
    new AdminSetUserPasswordCommand({
      UserPoolId,
      Username: username,
      Password: throwawayPassword(),
      Permanent: true,
    }),
  );
  console.log('  Cognito   account created');
}

await idp.send(new AdminAddUserToGroupCommand({ UserPoolId, Username: username, GroupName: 'ADMIN' }));
console.log('  Cognito   in the ADMIN group');

/* ---------------------------------------------------------------- *
 * 2. SNS — allowed to receive the sign-in code
 * ---------------------------------------------------------------- */
const status = await sns.send(new GetSMSSandboxAccountStatusCommand({}));

if (status.IsInSandbox === false) {
  console.log('  SNS       production access — any number can be texted');
} else {
  const listed = await sns.send(new ListSMSSandboxPhoneNumbersCommand({}));
  const entry = (listed.PhoneNumbers ?? []).find((p) => p.PhoneNumber === phone);

  if (oneTimeCode) {
    await sns.send(
      new VerifySMSSandboxPhoneNumberCommand({ PhoneNumber: phone, OneTimePassword: oneTimeCode }),
    );
    console.log('  SNS       number verified — sign-in codes will arrive');
  } else if (entry?.Status === 'Verified') {
    console.log('  SNS       number already verified');
  } else if (entry) {
    console.log('  SNS       number added, still waiting for its code');
    console.log('');
    console.log(`  Re-run with the code from the handset:`);
    console.log(`    npm run seed:admin -- ${phone} "${name}" --code 123456`);
  } else {
    await sns.send(
      new CreateSMSSandboxPhoneNumberCommand({ PhoneNumber: phone, LanguageCode: 'en-US' }),
    );
    console.log('  SNS       verification code sent to the handset');
    console.log('');
    console.log(`  Enter it by re-running:`);
    console.log(`    npm run seed:admin -- ${phone} "${name}" --code 123456`);
    console.log('');
    console.log('  (Cognito is already done — this step only lets the SMS through.)');
    process.exit(0);
  }
}

console.log(`\n  Done. Open Stars, go to Track, enter ${phone}.\n`);
