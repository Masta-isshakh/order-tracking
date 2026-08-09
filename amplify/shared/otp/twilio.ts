import type { CheckOutcome, SendOutcome } from './types';

/**
 * Twilio Verify.
 *
 * Twilio owns the whole code lifecycle — generation, delivery, expiry and
 * attempt limits — and operates its own registered senders, so there is nothing
 * for us to register per country. We never see the code, which is why
 * verification is a second API call rather than a string compare.
 *
 * @see https://www.twilio.com/docs/verify/api
 */

const BASE = 'https://verify.twilio.com/v2/Services';

/**
 * Credentials are passed in rather than read from `process.env`.
 *
 * Amplify does NOT put `secret()` values into the process environment — it sets
 * the literal string "<value will be resolved during runtime>" there and
 * resolves the real value only through the generated `$amplify/env/<function>`
 * module. Reading process.env here would send that marker to Twilio as the
 * password and fail with code=20003.
 */
export type TwilioCredentials = {
  accountSid: string;
  /** Optional API key SID. When present it replaces the account SID as the username. */
  apiKeySid: string;
  authToken: string;
  serviceSid: string;
};

export const twilioCredentials = (env: {
  TWILIO_ACCOUNT_SID: string;
  TWILIO_API_KEY_SID?: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_VERIFY_SERVICE_SID: string;
}): TwilioCredentials => ({
  accountSid: (env.TWILIO_ACCOUNT_SID ?? '').trim(),
  apiKeySid: (env.TWILIO_API_KEY_SID ?? '').trim(),
  authToken: (env.TWILIO_AUTH_TOKEN ?? '').trim(),
  serviceSid: (env.TWILIO_VERIFY_SERVICE_SID ?? '').trim(),
});

/**
 * Basic-auth username: the API key SID when one is configured, otherwise the
 * account SID. Twilio validates the secret against whichever identity is used,
 * so mixing them (API key secret + account SID) is what produces a 20003.
 */
const authUser = (credentials: TwilioCredentials): string =>
  credentials.apiKeySid || credentials.accountSid;

/**
 * True only for credentials that could actually work. Rejects the placeholder
 * secret and Amplify's unresolved-secret marker, so a misconfiguration surfaces
 * as a clear log line instead of an opaque Twilio rejection.
 */
export const isTwilioConfigured = (credentials: TwilioCredentials): boolean => {
  const user = authUser(credentials);
  return (
    (user.startsWith('AC') || user.startsWith('SK')) &&
    credentials.accountSid.startsWith('AC') &&
    credentials.serviceSid.startsWith('VA') &&
    /^[0-9a-zA-Z]{32}$/.test(credentials.authToken)
  );
};

const post = async (
  credentials: TwilioCredentials,
  path: string,
  form: Record<string, string>,
) => {
  const { authToken, serviceSid } = credentials;
  const body = new URLSearchParams(form).toString();

  const response = await fetch(`${BASE}/${serviceSid}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${authUser(credentials)}:${authToken}`).toString('base64')}`,
    },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, payload };
};

/** Asks Twilio to generate and text a code. */
export const startVerification = async (
  credentials: TwilioCredentials,
  phone: string,
): Promise<SendOutcome> => {
  if (!isTwilioConfigured(credentials)) {
    return { status: 'FAILED', reason: 'Twilio credentials are not configured' };
  }

  const { ok, status, payload } = await post(credentials, 'Verifications', {
    To: phone,
    Channel: 'sms',
  });

  if (!ok) {
    // 60203 = max send attempts reached for this number; treat as a throttle so
    // the user is told to wait rather than shown a hard failure.
    const code = String(payload.code ?? '');
    if (code === '60203' || status === 429) {
      return { status: 'SUPPRESSED', reason: 'RATE_LIMIT' };
    }
    // The numeric Twilio code is the fastest way to diagnose a misconfiguration
    // (21408 = country not enabled, 20003 = bad credentials, 20404 = wrong
    // service SID), so keep it in the log line — see docs/TWILIO-SETUP.md.
    return {
      status: 'FAILED',
      reason: [
        `http=${status}`,
        code ? `code=${code}` : null,
        String(payload.message ?? 'Twilio rejected the request'),
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  return { status: 'SENT', reference: typeof payload.sid === 'string' ? payload.sid : null };
};

/** Asks Twilio whether the code the user typed is the one it sent. */
export const checkVerification = async (
  credentials: TwilioCredentials,
  phone: string,
  code: string,
): Promise<CheckOutcome> => {
  if (!isTwilioConfigured(credentials)) {
    return { correct: false, reason: 'Twilio credentials are not configured' };
  }

  const { ok, payload } = await post(credentials, 'VerificationCheck', { To: phone, Code: code });

  if (!ok) {
    // 20404 means the verification already expired or was consumed.
    return { correct: false, reason: String(payload.message ?? 'verification not found') };
  }

  return {
    correct: payload.status === 'approved' && payload.valid === true,
    reason: typeof payload.status === 'string' ? payload.status : undefined,
  };
};
