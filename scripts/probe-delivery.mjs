/**
 * Sends one real verification SMS and reports whether the provider accepted it.
 *
 *   node scripts/probe-delivery.mjs +97455708226
 *
 * Unlike check:otp this never asks you to type the code — it only answers
 * "did the provider take the message?", which is the question that matters when
 * you are chasing a delivery problem. Whether the handset actually buzzes is
 * then a carrier matter, and you will know within seconds.
 *
 * The temporary account is deleted afterwards.
 */
import { InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { CLIENT_ID, REGION, deleteUser, idp, provisionUser } from './lib/backend-test-kit.mjs';
import {
  authUser,
  readSandboxSecret,
  readTwilioConfig,
  twilioGet,
} from './lib/twilio-client.mjs';

const phone = process.argv[2];
if (!phone || !/^\+[1-9]\d{6,14}$/.test(phone)) {
  console.error('Usage: node scripts/probe-delivery.mjs +97455708226');
  process.exit(1);
}

const logs = new CloudWatchLogsClient({ region: REGION });

console.log(`\nDelivery probe → ${phone}\n`);

let username = null;
const startedAt = Date.now() - 5000;

try {
  const user = await provisionUser(phone, 'Delivery Probe', 'CUSTOMER');
  // Only clean up an account this probe created. The number being tested is
  // usually a real admin's, and deleting it would revoke their access.
  username = user.created ? user.username : null;
  if (!user.created) console.log('  (existing account — it will be left alone)');

  const start = await idp.send(
    new InitiateAuthCommand({
      AuthFlow: 'CUSTOM_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: phone },
    }),
  );

  const params = start.ChallengeParameters ?? {};
  console.log(`  provider        ${params.provider ?? '?'}`);
  console.log(`  destination     ${params.destination ?? '?'}`);

  if (params.deliveryFailed === 'true' || params.throttled === 'true') {
    console.log(`  accepted        NO\n`);
  } else {
    console.log(`  accepted        YES — the message is on its way\n`);
  }

  // Give CloudWatch a moment, then surface the handler's own log line.
  await new Promise((resolve) => setTimeout(resolve, 9000));

  const groups = await logs.send(
    new DescribeLogGroupsCommand({ logGroupNamePrefix: '/aws/lambda/' }),
  );
  const group = (groups.logGroups ?? [])
    .map((g) => g.logGroupName)
    .find((n) => n.toLowerCase().includes('createauthchallenge'));

  if (group) {
    const events = await logs.send(
      new FilterLogEventsCommand({ logGroupName: group, startTime: startedAt, limit: 50 }),
    );
    const lines = (events.events ?? [])
      .map((e) => e.message.trim())
      .filter((m) => m.includes('"trigger":"createAuthChallenge"'));

    console.log('  what the backend logged:');
    if (lines.length === 0) console.log('    (nothing yet — re-run scripts/logs.mjs in a moment)');
    for (const line of lines.slice(-3)) {
      const json = /\{.*\}/s.exec(line)?.[0];
      try {
        const parsed = JSON.parse(json);
        console.log(`    ${parsed.message}${parsed.reason ? ` — ${parsed.reason}` : ''}`);
      } catch {
        console.log(`    ${line.slice(0, 200)}`);
      }
    }
  }
  /* The decisive part: ask Twilio what the CARRIER did with the message.
     "accepted" only means Twilio took it; `delivered` vs `undelivered` is the
     answer to "does Qatar accept our traffic?". */
  const config = readTwilioConfig();
  if (config.provider === 'TWILIO' && config.accountSid) {
    const secret = readSandboxSecret('TWILIO_AUTH_TOKEN', process.env.SANDBOX_ID ?? 'stars');
    if (secret.value) {
      const user = authUser(config);
      console.log('\n  carrier status (polling Twilio for up to 30s):');

      // Verify traffic does NOT appear in the ordinary Messages log — Twilio
      // records it as verification "attempts" instead.
      const since = new Date(startedAt - 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
      let attempt = null;

      for (let poll = 0; poll < 10; poll += 1) {
        const { payload } = await twilioGet(
          `https://verify.twilio.com/v2/Attempts?PageSize=10&DateCreatedAfter=${since}`,
          user,
          secret.value,
        );
        attempt = (payload.attempts ?? []).find((a) => a.channel_data?.to === phone) ?? null;
        const status = attempt?.channel_data?.message_status;
        if (status && status !== 'QUEUED' && status !== 'SENT') break;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      if (!attempt) {
        console.log('    no attempt recorded yet — re-run in a few seconds');
      } else {
        const data = attempt.channel_data;
        console.log(`    message     ${data.message_status}`);
        console.log(`    country     ${data.country} (mcc ${data.mcc}, mnc ${data.mnc})`);
        if (data.error_code) console.log(`    error       ${data.error_code}`);
        console.log('');
        if (data.message_status === 'DELIVERED') {
          console.log('    DELIVERED — the carrier accepted it. This provider works for Qatar.');
        } else if (['UNDELIVERED', 'FAILED'].includes(data.message_status)) {
          console.log('    THE CARRIER REJECTED IT. This is the Sender ID case:');
          console.log('    register one (Twilio or AWS) — see docs/SMS-QATAR.md.');
        } else {
          console.log(`    still "${data.message_status}" — check the handset, then re-run.`);
        }
      }
    }
  }
} catch (err) {
  console.log(`  ERROR ${err?.message ?? err}`);
} finally {
  if (username) await deleteUser(username);
  console.log('\n  probe account removed\n');
}
