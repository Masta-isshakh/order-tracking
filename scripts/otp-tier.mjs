/**
 * Reads or temporarily changes which groups must pass an SMS code.
 *
 *   node scripts/otp-tier.mjs                    # show the live setting
 *   node scripts/otp-tier.mjs ""                 # nobody verifies
 *   node scripts/otp-tier.mjs ADMIN,SUPERVISOR   # restore the default
 *
 * An operational escape hatch, not something the tests need: SNS accepts a
 * publish even for numbers it will not deliver to, so the code still reaches
 * DynamoDB and the integration suites complete staff sign-in with the tier on.
 *
 * Use it when a staff member is locked out because their number cannot receive
 * SMS — turn the requirement off, let them in, register the number on the Phone
 * numbers screen, then turn it straight back on.
 *
 * This edits the deployed Lambda's environment directly, so it takes seconds
 * rather than a full redeploy — and the next `ampx sandbox` deploy resets it to
 * whatever `amplify/auth/otp-config.ts` says.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  GetFunctionConfigurationCommand,
  LambdaClient,
  ListFunctionsCommand,
  UpdateFunctionConfigurationCommand,
} from '@aws-sdk/client-lambda';

const here = dirname(fileURLToPath(import.meta.url));
const outputs = JSON.parse(readFileSync(join(here, '..', 'amplify_outputs.json'), 'utf8'));
const lambda = new LambdaClient({ region: outputs.auth.aws_region });

const findFunction = async (fragment) => {
  let marker;
  do {
    const page = await lambda.send(new ListFunctionsCommand({ Marker: marker, MaxItems: 50 }));
    const hit = (page.Functions ?? []).find((f) => f.FunctionName.toLowerCase().includes(fragment));
    if (hit) return hit.FunctionName;
    marker = page.NextMarker;
  } while (marker);
  return null;
};

const name = await findFunction('createauthchallenge');
if (!name) {
  console.error('create-auth-challenge Lambda not found. Is the backend deployed?');
  process.exit(1);
}

const config = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: name }));
const variables = { ...(config.Environment?.Variables ?? {}) };
const current = variables.OTP_REQUIRED_GROUPS ?? '(unset)';

if (process.argv.length < 3) {
  console.log(`\nGroups that must pass an SMS code: ${current || '(nobody)'}\n`);
  process.exit(0);
}

const next = process.argv[2];
variables.OTP_REQUIRED_GROUPS = next;

await lambda.send(
  new UpdateFunctionConfigurationCommand({
    FunctionName: name,
    Environment: { Variables: variables },
  }),
);

console.log(`\nOTP_REQUIRED_GROUPS: ${current || '(nobody)'} → ${next || '(nobody)'}`);
if (!next) {
  console.log('WARNING: staff can now sign in without a code. Restore with:');
  console.log('  node scripts/otp-tier.mjs ADMIN,SUPERVISOR\n');
} else {
  console.log('');
}
