/**
 * Shared Twilio access for the diagnostic scripts.
 *
 * Reads the same config the backend uses and the same secret the Lambdas read,
 * so a check here reflects what production would actually do. The auth token is
 * never printed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const projectRoot = join(here, '..', '..');

const AMPX = join(projectRoot, 'node_modules', '@aws-amplify', 'backend-cli', 'lib', 'ampx.js');

/** Pulls values out of otp-config.ts without needing a TypeScript loader. */
export const readTwilioConfig = () => {
  const source = readFileSync(join(projectRoot, 'amplify', 'auth', 'otp-config.ts'), 'utf8');
  const pick = (name) =>
    (new RegExp(`export const ${name}\\s*=\\s*'([^']*)'`).exec(source) ?? [])[1] ?? '';
  return {
    provider: pick('OTP_PROVIDER'),
    accountSid: pick('TWILIO_ACCOUNT_SID'),
    apiKeySid: pick('TWILIO_API_KEY_SID'),
    serviceSid: pick('TWILIO_VERIFY_SERVICE_SID'),
  };
};

/**
 * Reads a sandbox secret. Invokes the CLI's JS entry with the current Node
 * binary — `npx` is a .cmd shim on Windows, which Node refuses to spawn without
 * a shell, and ampx additionally requires the npm user-agent variable.
 */
export const readSandboxSecret = (name, identifier) => {
  try {
    const out = execFileSync(
      process.execPath,
      [AMPX, 'sandbox', 'secret', 'get', name, '--identifier', identifier],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          npm_config_user_agent:
            process.env.npm_config_user_agent ?? `npm/10 node/${process.version} ${process.platform}`,
        },
      },
    );
    return {
      value: /([0-9a-zA-Z]{32})(?![0-9a-zA-Z])/.exec(out)?.[1] ?? null,
      version: /version:\s*(\d+)/.exec(out)?.[1] ?? '?',
      raw: out,
    };
  } catch (err) {
    return { value: null, version: '?', raw: String(err.stdout ?? err.message ?? err) };
  }
};

/** Basic-auth username: API key SID when configured, otherwise the account SID. */
export const authUser = (config) => config.apiKeySid || config.accountSid;

export const twilioGet = async (url, user, secret) => {
  const auth = Buffer.from(`${user}:${secret}`).toString('base64');
  const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  return { response, payload: await response.json().catch(() => ({})) };
};
