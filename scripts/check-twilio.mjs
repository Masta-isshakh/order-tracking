/**
 * Checks the Twilio wiring without sending an SMS and without ever printing a
 * secret.
 *
 *   node scripts/check-twilio.mjs
 *
 * Reads the stored auth token through the Amplify CLI, then asks Twilio to
 * describe the Verify service. That single call proves the Account SID, the
 * auth token and the Service SID are all correct — everything except whether
 * the carrier will deliver, which only a real handset can answer.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const IDENTIFIER = process.argv[2] ?? 'stars';

/** Pulls the values out of otp-config.ts without importing TypeScript. */
const readConfig = () => {
  const source = readFileSync(join(root, 'amplify', 'auth', 'otp-config.ts'), 'utf8');
  // Literal first, then the environment — the SIDs are kept out of git, so in
  // a clean checkout they arrive as TWILIO_ACCOUNT_SID=... not as a literal.
  const pick = (name) =>
    (new RegExp(`export const ${name}\\s*=\\s*'([^']*)'`).exec(source) ?? [])[1] ||
    process.env[name] ||
    '';
  return {
    provider: pick('OTP_PROVIDER'),
    accountSid: pick('TWILIO_ACCOUNT_SID'),
    apiKeySid: pick('TWILIO_API_KEY_SID'),
    serviceSid: pick('TWILIO_VERIFY_SERVICE_SID'),
  };
};

/**
 * Runs the Amplify CLI's JS entry point with the current Node binary.
 *
 * Not `npx`: on Windows that resolves to a .cmd shim, which Node refuses to
 * spawn without `shell: true` (EINVAL), and shell:true then emits a
 * deprecation warning and can abort libuv on exit.
 */
const AMPX = join(root, 'node_modules', '@aws-amplify', 'backend-cli', 'lib', 'ampx.js');

const readSecret = (name) => {
  try {
    const out = execFileSync(
      process.execPath,
      [AMPX, 'sandbox', 'secret', 'get', name, '--identifier', IDENTIFIER],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // ampx refuses to start unless it can tell which package manager
        // launched it, and running it directly skips the variable npm sets.
        env: {
          ...process.env,
          npm_config_user_agent:
            process.env.npm_config_user_agent ?? `npm/10 node/${process.version} ${process.platform}`,
        },
      },
    );
    const match = /([0-9a-fA-F]{32})/.exec(out);
    const version = /version:\s*(\d+)/.exec(out)?.[1] ?? '?';
    return { value: match ? match[1] : null, raw: out, version };
  } catch (err) {
    return { value: null, raw: String(err.stdout ?? err.message ?? err), version: '?' };
  }
};

let failures = 0;
const pass = (label, extra = '') => console.log(`  PASS  ${label}${extra ? ` — ${extra}` : ''}`);
const fail = (label, extra = '') => {
  failures += 1;
  console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ''}`);
};

const config = readConfig();

console.log(`\nTwilio wiring check (sandbox "${IDENTIFIER}")\n`);
console.log(`  OTP_PROVIDER   ${config.provider}`);
console.log(`  Account SID    ${config.accountSid || '(empty)'}`);
console.log(`  API key SID    ${config.apiKeySid || '(not used — authenticating as the account)'}`);
console.log(`  Service SID    ${config.serviceSid || '(empty)'}\n`);

if (config.provider !== 'TWILIO') {
  console.log(`  OTP_PROVIDER is '${config.provider}', not 'TWILIO'.`);
  console.log('  Nothing to check. Set it in amplify/auth/otp-config.ts first.\n');
  process.exit(0);
}

config.accountSid.startsWith('AC')
  ? pass('Account SID looks valid')
  : fail('Account SID missing or malformed', 'must start with AC');

config.serviceSid.startsWith('VA')
  ? pass('Verify Service SID looks valid')
  : fail('Verify Service SID missing or malformed', 'must start with VA');

const secret = readSecret('TWILIO_AUTH_TOKEN');

if (/placeholder/i.test(secret.raw)) {
  fail(
    'auth token is still the placeholder',
    `run: echo <token> | npx ampx sandbox secret set TWILIO_AUTH_TOKEN --identifier ${IDENTIFIER}`,
  );
} else if (!secret.value) {
  fail('auth token not found or not 32 hex characters', 'check the value you stored');
} else {
  pass('auth token stored and correctly shaped', `32 hex characters, version ${secret.version}`);
}

if (secret.value && config.accountSid) {
  const call = async (url, user) => {
    const auth = Buffer.from(`${user}:${secret.value}`).toString('base64');
    const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    return { response, payload: await response.json().catch(() => ({})) };
  };

  const configuredUser = config.apiKeySid || config.accountSid;
  const accountUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`;

  // Step 1: does this identity + secret pair authenticate at all? Checking the
  // account separately from the Verify service tells a dead credential apart
  // from a service that lives in another account.
  const account = await call(accountUrl, configuredUser);

  if (account.response.status === 401) {
    fail('Twilio rejected the credentials', `as ${configuredUser}`);

    // The classic mix-up: an API key Secret stored against the Account SID.
    // Detect it so the fix is one line rather than an afternoon.
    const looksLikeApiKeySecret =
      !config.apiKeySid && /^[0-9a-zA-Z]{32}$/.test(secret.value) && !/^[0-9a-f]{32}$/.test(secret.value);

    console.log('');
    if (looksLikeApiKeySecret) {
      console.log('  The stored secret contains non-hex characters, so it is almost');
      console.log('  certainly an API key SECRET, not the account auth token.');
      console.log('  Set TWILIO_API_KEY_SID in amplify/auth/otp-config.ts to the matching');
      console.log('  SK… value from the Twilio console, then redeploy.');
    } else {
      console.log('  Two things produce this:');
      console.log('');
      console.log('  1. The stored value is an API key SECRET rather than the account');
      console.log('     auth token. Fix: put the matching SK… value into');
      console.log('     TWILIO_API_KEY_SID in amplify/auth/otp-config.ts, then redeploy.');
      console.log('');
      console.log('  2. The auth token was rotated after you stored it, so the stored');
      console.log('     one is dead. Fix: copy the token currently marked PRIMARY at');
      console.log('     console.twilio.com → Account → API keys & tokens, then run:');
      console.log('');
      console.log(`       npx ampx sandbox secret set TWILIO_AUTH_TOKEN --identifier ${IDENTIFIER}`);
    }
    console.log('');
  } else if (!account.response.ok) {
    fail('could not read the account', `http=${account.response.status} ${account.payload.message ?? ''}`);
  } else {
    pass('Twilio accepted the credentials', `as ${configuredUser}`);
    account.payload.status === 'active'
      ? pass('account is active', `"${account.payload.friendly_name}" (${account.payload.type ?? '-'})`)
      : fail('account is not active', account.payload.status);

    /* Trial accounts can only text numbers that have been verified in the
       console (error 21608). That restriction is invisible on the dashboard,
       which happily shows a balance, so check it explicitly. */
    const isTrial = account.payload.type === 'Trial';
    if (isTrial) {
      fail(
        'account is still on TRIAL',
        'it can only text numbers verified in the Twilio console (error 21608)',
      );
    } else {
      pass('account is upgraded', 'can text any number');
    }

    const callerIds = await call(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/OutgoingCallerIds.json?PageSize=50`,
      configuredUser,
    );
    if (callerIds.response.ok) {
      const numbers = (callerIds.payload.outgoing_caller_ids ?? []).map((c) => c.phone_number);
      console.log(
        `\n  Verified numbers on this account (${numbers.length}):` +
          (numbers.length ? `\n    ${numbers.join('\n    ')}` : ' none'),
      );
      if (isTrial) {
        console.log('  While on trial, only these can receive an SMS.');
        console.log('  Add one at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified\n');
      } else {
        console.log('');
      }
    }

    // Step 2: the Verify service itself.
    if (config.serviceSid) {
      const service = await call(
        `https://verify.twilio.com/v2/Services/${config.serviceSid}`,
        configuredUser,
      );
      if (service.response.ok) {
        pass('Verify service reachable', `"${service.payload.friendly_name}"`);
        service.payload.code_length === 6
          ? pass('code length is 6', 'matches the app input boxes')
          : fail(
              'code length is not 6',
              `it is ${service.payload.code_length} — change it in the Twilio console`,
            );
      } else if (service.response.status === 404) {
        fail('Verify service not found', 'wrong Service SID, or it belongs to another account');
      } else {
        fail('Verify service unreachable', `http=${service.response.status}`);
      }
    }
  }
}

console.log(
  failures === 0
    ? '\nTwilio is wired correctly. Next: npm run check:otp -- +974XXXXXXXX\n'
    : `\n${failures} problem(s) to fix.\n`,
);
// Set the code rather than calling process.exit(): an explicit exit while the
// child process handles are still closing aborts libuv on Windows.
process.exitCode = failures === 0 ? 0 : 1;
