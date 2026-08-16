/**
 * Reports what Amazon SNS will and will not do for SMS on this account, and
 * optionally sends one real message.
 *
 *   node scripts/check-sns.mjs                 # report only
 *   node scripts/check-sns.mjs +974XXXXXXXX    # also send one real SMS
 *
 * The point is to settle a question that costs days when guessed at: whether
 * destination numbers need to be "verified" (they only do inside the SMS
 * sandbox) and whether Qatari carriers accept the traffic at all.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  GetSMSAttributesCommand,
  GetSMSSandboxAccountStatusCommand,
  ListOriginationNumbersCommand,
  ListPhoneNumbersOptedOutCommand,
  ListSMSSandboxPhoneNumbersCommand,
  PublishCommand,
  SNSClient,
} from '@aws-sdk/client-sns';

const here = dirname(fileURLToPath(import.meta.url));
const outputs = JSON.parse(readFileSync(join(here, '..', 'amplify_outputs.json'), 'utf8'));
const region = outputs.auth.aws_region;
const sns = new SNSClient({ region });

const phone = process.argv[2];

console.log(`\nAmazon SNS — SMS readiness (${region})\n`);

/* 1. Sandbox status decides whether "verified numbers" are a thing at all. */
const sandbox = await sns.send(new GetSMSSandboxAccountStatusCommand({}));
const inSandbox = sandbox.IsInSandbox;

console.log(`  SMS sandbox            ${inSandbox ? 'YES — restricted' : 'NO — production access'}`);

if (inSandbox) {
  console.log('    In the sandbox you may only text numbers you have verified.');
  const verified = await sns.send(new ListSMSSandboxPhoneNumbersCommand({}));
  const numbers = verified.PhoneNumbers ?? [];
  console.log(`    Verified destinations (${numbers.length}):`);
  for (const n of numbers) console.log(`      ${n.PhoneNumber}  ${n.Status}`);
} else {
  console.log('    Destination numbers do NOT need verifying. You can text anyone.');
  console.log('    The CreateSMSSandboxPhoneNumber / VerifySMSSandboxPhoneNumber APIs');
  console.log('    are sandbox-only and are not applicable to this account.');
}

/* 2. Spend limit — the quiet killer once real traffic starts. */
const attributes = await sns.send(new GetSMSAttributesCommand({}));
const limit = attributes.attributes?.MonthlySpendLimit;
console.log(`\n  Monthly spend limit    USD ${limit ?? '(default)'}`);

/* 3. Origination identity — what Qatari carriers actually check. */
const origination = await sns.send(new ListOriginationNumbersCommand({}));
const ids = origination.PhoneNumbers ?? [];
console.log(`  Origination numbers    ${ids.length === 0 ? 'none registered' : ids.length}`);
for (const id of ids) {
  console.log(`      ${id.PhoneNumber} (${id.IsoCountryCode}, ${id.NumberType})`);
}
if (ids.length === 0) {
  console.log('    Qatar generally requires a registered Sender ID for A2P SMS.');
  console.log('    Without one, Publish still succeeds and the carrier may drop it.');
  console.log('    The send test below is the only way to know for your traffic.');
}

/* 4. Opt-outs silently swallow messages to a specific number. */
if (phone) {
  const optedOut = await sns.send(new ListPhoneNumbersOptedOutCommand({}));
  const isOptedOut = (optedOut.phoneNumbers ?? []).includes(phone);
  console.log(`\n  ${phone} opted out?   ${isOptedOut ? 'YES — it will never receive SMS' : 'no'}`);
}

/* 5. The decisive test. */
if (!phone) {
  console.log('\n  Pass a number to send one real test message:');
  console.log('    node scripts/check-sns.mjs +974XXXXXXXX\n');
  process.exit(0);
}

console.log(`\n  Sending one real SMS to ${phone} …`);
try {
  const result = await sns.send(
    new PublishCommand({
      PhoneNumber: phone,
      Message: 'Stars: 123456 is your verification code. It expires in 5 minutes. Do not share this code with anyone.',
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
      },
    }),
  );
  console.log(`  SNS accepted it. MessageId ${result.MessageId}`);
  console.log('');
  console.log('  Now check the handset:');
  console.log('    ARRIVED      → SNS works for Qatar. No Sender ID needed yet.');
  console.log('    DID NOT      → the carrier dropped it. Register a Sender ID');
  console.log('                   (docs/SMS-QATAR.md) or stay on Twilio.');
} catch (err) {
  console.log(`  SNS REFUSED it: ${err.name} — ${err.message}`);
  if (err.name === 'InvalidParameterException' && inSandbox) {
    console.log('  In the sandbox the destination must be verified first.');
  }
}
console.log('');
