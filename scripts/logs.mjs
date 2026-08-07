/**
 * Tails a backend Lambda's logs.
 *
 *   node scripts/logs.mjs submit-booking [minutes]
 *   node scripts/logs.mjs create-auth-challenge 30
 *
 * Handy when an OTP does not arrive or a mutation returns INTERNAL_ERROR: the
 * handlers log structured JSON with the reason.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

const [, , nameFragment = 'submit-booking', minutesArg = '20'] = process.argv;
const minutes = Number(minutesArg) || 20;

const here = dirname(fileURLToPath(import.meta.url));
const outputs = JSON.parse(readFileSync(join(here, '..', 'amplify_outputs.json'), 'utf8'));
const client = new CloudWatchLogsClient({ region: outputs.auth.aws_region });

const groups = [];
let token;
do {
  const page = await client.send(
    new DescribeLogGroupsCommand({ logGroupNamePrefix: '/aws/lambda/', nextToken: token }),
  );
  groups.push(...(page.logGroups ?? []));
  token = page.nextToken;
} while (token);

const matches = groups
  .map((group) => group.logGroupName)
  .filter((name) => name.toLowerCase().includes(nameFragment.toLowerCase()));

if (matches.length === 0) {
  console.error(`No log group matched "${nameFragment}".`);
  console.error('Available:', groups.map((g) => g.logGroupName).filter((n) => n.includes('stars')).join('\n  '));
  process.exit(1);
}

const startTime = Date.now() - minutes * 60 * 1000;

for (const logGroupName of matches) {
  console.log(`\n=== ${logGroupName} (last ${minutes}m) ===`);
  const events = await client.send(
    new FilterLogEventsCommand({ logGroupName, startTime, limit: 200 }),
  );
  const lines = (events.events ?? []).filter(
    (event) => !/^(START|END|REPORT|INIT_START)/.test(event.message ?? ''),
  );
  if (lines.length === 0) {
    console.log('  (no application logs in this window)');
    continue;
  }
  for (const event of lines) {
    console.log(`  ${new Date(event.timestamp).toISOString()}  ${event.message.trim()}`);
  }
}
console.log('');
