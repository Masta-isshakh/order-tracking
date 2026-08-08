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

const config = () => ({
  accountSid: (process.env.TWILIO_ACCOUNT_SID ?? '').trim(),
  authToken: (process.env.TWILIO_AUTH_TOKEN ?? '').trim(),
  serviceSid: (process.env.TWILIO_VERIFY_SERVICE_SID ?? '').trim(),
});

/** True once real credentials are in place (placeholders do not count). */
export const isTwilioConfigured = (): boolean => {
  const { accountSid, authToken, serviceSid } = config();
  return (
    accountSid.startsWith('AC') &&
    serviceSid.startsWith('VA') &&
    authToken.length > 10 &&
    !authToken.startsWith('placeholder')
  );
};

const post = async (path: string, form: Record<string, string>) => {
  const { accountSid, authToken, serviceSid } = config();
  const body = new URLSearchParams(form).toString();

  const response = await fetch(`${BASE}/${serviceSid}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, payload };
};

/** Asks Twilio to generate and text a code. */
export const startVerification = async (phone: string): Promise<SendOutcome> => {
  if (!isTwilioConfigured()) {
    return { status: 'FAILED', reason: 'Twilio credentials are not configured' };
  }

  const { ok, status, payload } = await post('Verifications', { To: phone, Channel: 'sms' });

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
export const checkVerification = async (phone: string, code: string): Promise<CheckOutcome> => {
  if (!isTwilioConfigured()) {
    return { correct: false, reason: 'Twilio credentials are not configured' };
  }

  const { ok, payload } = await post('VerificationCheck', { To: phone, Code: code });

  if (!ok) {
    // 20404 means the verification already expired or was consumed.
    return { correct: false, reason: String(payload.message ?? 'verification not found') };
  }

  return {
    correct: payload.status === 'approved' && payload.valid === true,
    reason: typeof payload.status === 'string' ? payload.status : undefined,
  };
};
