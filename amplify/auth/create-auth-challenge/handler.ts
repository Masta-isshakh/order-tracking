import { randomInt } from 'node:crypto';
import type { CreateAuthChallengeTriggerHandler } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { env } from '$amplify/env/create-auth-challenge';
import { maskPhone, normalizePhone } from '../../shared/phone';
import { log, resolveProvider } from '../../shared/otp/types';
import { isTwilioConfigured, startVerification, twilioCredentials } from '../../shared/otp/twilio';
import { isFirebaseConfigured } from '../../shared/otp/firebase';

// Secrets only resolve through this generated module — see twilioCredentials().
const twilio = twilioCredentials(env);

const REGION = process.env.AWS_REGION ?? 'ap-south-1';
const sns = new SNSClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const APP_NAME = process.env.APP_NAME || 'Stars';
const TABLE = process.env.OTP_TABLE_NAME ?? '';
const SENDER_ID = (process.env.SMS_SENDER_ID ?? '').trim();
const OTP_TTL_MS = Number(process.env.OTP_TTL_SECONDS ?? 300) * 1000;
const COOLDOWN_MS = Number(process.env.RESEND_COOLDOWN_SECONDS ?? 45) * 1000;
const MAX_SMS_PER_HOUR = Number(process.env.MAX_SMS_PER_HOUR ?? 5);
const HOUR_MS = 60 * 60 * 1000;

const TRIGGER = 'createAuthChallenge';

type OtpRecord = {
  phone: string;
  /** Empty for providers that own the code themselves (Twilio, Firebase). */
  code: string;
  expiresAt: number;
  lastSentAt: number;
  sendCount: number;
  windowStart: number;
  ttl: number;
};

/** Cryptographically strong 6-digit code, zero-padded so "004821" stays 6 chars. */
const generateCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

const readRecord = async (phone: string): Promise<OtpRecord | null> => {
  if (!TABLE) return null;
  try {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { phone }, ConsistentRead: true }));
    return (res.Item as OtpRecord | undefined) ?? null;
  } catch (err) {
    log('ERROR', TRIGGER, 'otp_table_read_failed', { error: String(err) });
    return null;
  }
};

const writeRecord = async (record: OtpRecord): Promise<void> => {
  if (!TABLE) return;
  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: record }));
  } catch (err) {
    log('ERROR', TRIGGER, 'otp_table_write_failed', { error: String(err) });
  }
};

const sendViaSns = async (phone: string, code: string): Promise<string | null> => {
  // GSM-7 only, single 160-char segment: no emoji, no Arabic, no curly quotes.
  const body = `${APP_NAME}: ${code} is your verification code. It expires in ${Math.round(
    OTP_TTL_MS / 60000,
  )} minutes. Do not share this code with anyone.`;

  const MessageAttributes: PublishCommand['input']['MessageAttributes'] = {
    'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
  };
  if (SENDER_ID) {
    MessageAttributes['AWS.SNS.SMS.SenderID'] = { DataType: 'String', StringValue: SENDER_ID };
  }

  const res = await sns.send(new PublishCommand({ PhoneNumber: phone, Message: body, MessageAttributes }));
  return res.MessageId ?? null;
};

/** Marks the challenge unanswerable so a failed delivery can never be guessed past. */
const deadChallenge = (
  event: Parameters<CreateAuthChallengeTriggerHandler>[0],
  destination: string,
  flag: 'deliveryFailed' | 'throttled' | 'unavailable',
  metadata: string,
) => {
  event.response.publicChallengeParameters = {
    destination,
    // Report the provider even on failure, so a diagnostic can tell "the
    // configured provider refused" apart from "the wrong provider ran".
    provider: resolveProvider(),
    resent: 'false',
    [flag]: 'true',
  };
  event.response.privateChallengeParameters = {
    answer: `${flag}-${randomInt(1e12)}`,
    expiresAt: '0',
    provider: 'NONE',
  };
  event.response.challengeMetadata = metadata;
  return event;
};

export const handler: CreateAuthChallengeTriggerHandler = async (event) => {
  const now = Date.now();
  const provider = resolveProvider();

  const phone = normalizePhone(event.request.userAttributes?.phone_number);
  if (event.request.userNotFound || !phone) {
    log('WARN', TRIGGER, 'challenge_for_unknown_user');
    return deadChallenge(event, '', 'unavailable', 'OTP_UNAVAILABLE');
  }

  const masked = maskPhone(phone);

  /* ------------------------------------------------------------------ *
   * Firebase: the device performs the whole SMS exchange itself and
   * answers with an ID token. Nothing to send, nothing to store.
   * ------------------------------------------------------------------ */
  if (provider === 'FIREBASE') {
    if (!isFirebaseConfigured()) {
      log('ERROR', TRIGGER, 'firebase_not_configured', { destination: masked });
      return deadChallenge(event, masked, 'deliveryFailed', 'OTP_FIREBASE_UNCONFIGURED');
    }
    log('INFO', TRIGGER, 'firebase_challenge_issued', { destination: masked });
    event.response.publicChallengeParameters = {
      destination: masked,
      provider: 'FIREBASE',
      resent: 'false',
    };
    event.response.privateChallengeParameters = { provider: 'FIREBASE', phone, expiresAt: '1' };
    event.response.challengeMetadata = 'OTP_FIREBASE';
    return event;
  }

  /* ------------------------------------------------------------------ *
   * DEV: issue a code but send nothing, and hand it back to the device so
   * it can be shown on screen. Lets the whole app be built and demonstrated
   * while a provider's compliance review is pending.
   *
   * Anyone who knows a registered number can sign in as them, so this must
   * never reach real customers — scripts/check-backend.mjs fails while it is
   * active, and the app shows an unmissable banner.
   * ------------------------------------------------------------------ */
  if (provider === 'DEV') {
    const code = generateCode();
    const expiresAt = now + OTP_TTL_MS;

    log('ERROR', TRIGGER, 'DEV_MODE_NO_SMS_SENT_CODE_IS_PUBLIC', {
      destination: masked,
      warning: 'sign-in is unauthenticated while OTP_PROVIDER=DEV',
    });

    event.response.publicChallengeParameters = {
      destination: masked,
      provider: 'DEV',
      resent: 'true',
      expiresAt: String(expiresAt),
      // Deliberately public — this is what the device displays.
      devCode: code,
    };
    event.response.privateChallengeParameters = {
      answer: code,
      expiresAt: String(expiresAt),
      provider: 'DEV',
    };
    event.response.challengeMetadata = 'OTP_DEV';
    return event;
  }

  /* ------------------------------------------------------------------ *
   * Throttling applies to every provider that sends on our behalf. It is
   * what stops an open sign-in screen being used to run up an SMS bill.
   * ------------------------------------------------------------------ */
  const existing = await readRecord(phone);
  const withinCooldown = !!existing && now - existing.lastSentAt < COOLDOWN_MS;
  const sameWindow = !!existing && now - existing.windowStart < HOUR_MS;
  const windowStart = sameWindow ? existing!.windowStart : now;
  const sendCount = sameWindow ? existing!.sendCount : 0;
  const rateLimited = sendCount >= MAX_SMS_PER_HOUR;
  const liveVerification = !!existing && existing.expiresAt > now;

  /* ------------------------------------------------------------------ *
   * Twilio Verify: Twilio generates, delivers and later checks the code.
   * We never hold it, so verification is an API call, not a compare.
   * ------------------------------------------------------------------ */
  if (provider === 'TWILIO') {
    if (!isTwilioConfigured(twilio)) {
      log('ERROR', TRIGGER, 'twilio_not_configured', { destination: masked });
      return deadChallenge(event, masked, 'deliveryFailed', 'OTP_TWILIO_UNCONFIGURED');
    }

    // A retry (wrong digit) or an early resend must not trigger a second SMS —
    // the code the user already holds is still live on Twilio's side.
    if (liveVerification && (withinCooldown || rateLimited)) {
      log('INFO', TRIGGER, rateLimited ? 'sms_suppressed_rate_limited' : 'sms_suppressed_cooldown', {
        destination: masked,
        sendCount,
        provider,
      });
      event.response.publicChallengeParameters = {
        destination: masked,
        provider: 'TWILIO',
        resent: 'false',
        expiresAt: String(existing!.expiresAt),
      };
      event.response.privateChallengeParameters = {
        provider: 'TWILIO',
        phone,
        expiresAt: String(existing!.expiresAt),
      };
      event.response.challengeMetadata = 'OTP_TWILIO';
      return event;
    }

    if (rateLimited) {
      log('WARN', TRIGGER, 'sms_blocked_rate_limited', { destination: masked, sendCount });
      return deadChallenge(event, masked, 'throttled', 'OTP_THROTTLED');
    }

    const outcome = await startVerification(twilio, phone);
    if (outcome.status === 'FAILED') {
      log('ERROR', TRIGGER, 'twilio_send_failed', { destination: masked, reason: outcome.reason });
      return deadChallenge(event, masked, 'deliveryFailed', 'OTP_TWILIO_SEND_FAILED');
    }
    if (outcome.status === 'SUPPRESSED') {
      log('WARN', TRIGGER, 'twilio_rate_limited', { destination: masked });
      return deadChallenge(event, masked, 'throttled', 'OTP_THROTTLED');
    }

    // Twilio's default verification lifetime is 10 minutes.
    const expiresAt = now + 10 * 60 * 1000;
    await writeRecord({
      phone,
      code: '',
      expiresAt,
      lastSentAt: now,
      sendCount: sendCount + 1,
      windowStart,
      ttl: Math.floor((expiresAt + HOUR_MS) / 1000),
    });

    log('INFO', TRIGGER, 'sms_sent', {
      destination: masked,
      provider,
      reference: outcome.reference,
      sendCount: sendCount + 1,
    });

    event.response.publicChallengeParameters = {
      destination: masked,
      provider: 'TWILIO',
      resent: 'true',
      expiresAt: String(expiresAt),
    };
    event.response.privateChallengeParameters = {
      provider: 'TWILIO',
      phone,
      expiresAt: String(expiresAt),
    };
    event.response.challengeMetadata = 'OTP_TWILIO';
    return event;
  }

  /* ------------------------------------------------------------------ *
   * SNS: we generate the code, store it, and publish it ourselves.
   * ------------------------------------------------------------------ */
  let code: string;
  let expiresAt: number;
  let lastSentAt: number;
  let nextSendCount: number;
  let resent = false;

  if (liveVerification && existing!.code && (withinCooldown || rateLimited)) {
    code = existing!.code;
    expiresAt = existing!.expiresAt;
    lastSentAt = existing!.lastSentAt;
    nextSendCount = sendCount;
    log('INFO', TRIGGER, rateLimited ? 'sms_suppressed_rate_limited' : 'sms_suppressed_cooldown', {
      destination: masked,
      sendCount,
      provider,
    });
  } else if (rateLimited) {
    log('WARN', TRIGGER, 'sms_blocked_rate_limited', { destination: masked, sendCount });
    return deadChallenge(event, masked, 'throttled', 'OTP_THROTTLED');
  } else {
    code = generateCode();
    expiresAt = now + OTP_TTL_MS;
    lastSentAt = now;
    nextSendCount = sendCount + 1;
    resent = true;
    try {
      const messageId = await sendViaSns(phone, code);
      log('INFO', TRIGGER, 'sms_sent', {
        destination: masked,
        provider,
        messageId,
        sendCount: nextSendCount,
      });
    } catch (err) {
      // Surface the real reason in CloudWatch (unregistered Sender ID, spend
      // limit, opt-out list...) but never throw: a thrown error here reaches the
      // device as an opaque "unexpected error".
      log('ERROR', TRIGGER, 'sms_send_failed', { destination: masked, error: String(err) });
      return deadChallenge(event, masked, 'deliveryFailed', 'OTP_SNS_SEND_FAILED');
    }
  }

  await writeRecord({
    phone,
    code,
    expiresAt,
    lastSentAt,
    sendCount: nextSendCount,
    windowStart,
    ttl: Math.floor((expiresAt + HOUR_MS) / 1000),
  });

  // publicChallengeParameters reach the device — only non-secret data here.
  event.response.publicChallengeParameters = {
    destination: masked,
    provider: 'SNS',
    resent: String(resent),
    expiresAt: String(expiresAt),
  };
  event.response.privateChallengeParameters = {
    answer: code,
    expiresAt: String(expiresAt),
    provider: 'SNS',
  };
  event.response.challengeMetadata = 'OTP_SNS';
  return event;
};
