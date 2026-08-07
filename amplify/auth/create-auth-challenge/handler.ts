import { randomInt } from 'node:crypto';
import type { CreateAuthChallengeTriggerHandler } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { maskPhone, normalizePhone } from '../../shared/phone';

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

type OtpRecord = {
  phone: string;
  code: string;
  expiresAt: number;
  lastSentAt: number;
  sendCount: number;
  windowStart: number;
  ttl: number;
};

/** Cryptographically strong 6-digit code, zero-padded so "004821" stays 6 chars. */
const generateCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, extra: Record<string, unknown> = {}) => {
  // Phone numbers are always masked before they reach CloudWatch.
  console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](
    JSON.stringify({ level, trigger: 'createAuthChallenge', message, ...extra }),
  );
};

const readRecord = async (phone: string): Promise<OtpRecord | null> => {
  if (!TABLE) return null;
  try {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { phone }, ConsistentRead: true }));
    return (res.Item as OtpRecord | undefined) ?? null;
  } catch (err) {
    log('ERROR', 'otp_table_read_failed', { error: String(err) });
    return null;
  }
};

const writeRecord = async (record: OtpRecord): Promise<void> => {
  if (!TABLE) return;
  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: record }));
  } catch (err) {
    log('ERROR', 'otp_table_write_failed', { error: String(err) });
  }
};

const sendSms = async (phone: string, code: string): Promise<string | null> => {
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

export const handler: CreateAuthChallengeTriggerHandler = async (event) => {
  const now = Date.now();

  // defineAuthChallenge already fails unknown users, but Cognito can still invoke
  // this trigger. Answer with an unguessable value so verification can never pass.
  const rawPhone = event.request.userAttributes?.phone_number;
  const phone = normalizePhone(rawPhone);
  if (event.request.userNotFound || !phone) {
    log('WARN', 'challenge_for_unknown_user');
    event.response.publicChallengeParameters = { destination: '', resent: 'false' };
    event.response.privateChallengeParameters = { answer: `unavailable-${randomInt(1e12)}`, expiresAt: '0' };
    event.response.challengeMetadata = 'SMS_OTP_UNAVAILABLE';
    return event;
  }

  const masked = maskPhone(phone);
  const existing = await readRecord(phone);
  const hasLiveCode = !!existing && existing.expiresAt > now;

  // Re-serving an existing code covers two cases at once:
  //  - the user typed a wrong code and defineAuthChallenge asked for another round
  //  - the user tapped "resend" inside the cooldown window
  // Neither should burn another SMS, and both must keep the code they already hold.
  const withinCooldown = !!existing && now - existing.lastSentAt < COOLDOWN_MS;

  const windowStart = existing && now - existing.windowStart < HOUR_MS ? existing.windowStart : now;
  const sendCount = existing && now - existing.windowStart < HOUR_MS ? existing.sendCount : 0;
  const rateLimited = sendCount >= MAX_SMS_PER_HOUR;

  let code: string;
  let expiresAt: number;
  let lastSentAt: number;
  let nextSendCount: number;
  let resent = false;

  if (hasLiveCode && (withinCooldown || rateLimited)) {
    code = existing!.code;
    expiresAt = existing!.expiresAt;
    lastSentAt = existing!.lastSentAt;
    nextSendCount = sendCount;
    log('INFO', rateLimited ? 'sms_suppressed_rate_limited' : 'sms_suppressed_cooldown', {
      destination: masked,
      sendCount,
    });
  } else if (rateLimited) {
    // No live code and the hourly budget is gone: block without sending. The user
    // sees a generic failure; the code path is logged for support.
    log('WARN', 'sms_blocked_rate_limited', { destination: masked, sendCount });
    event.response.publicChallengeParameters = { destination: masked, resent: 'false', throttled: 'true' };
    event.response.privateChallengeParameters = { answer: `blocked-${randomInt(1e12)}`, expiresAt: '0' };
    event.response.challengeMetadata = 'SMS_OTP_THROTTLED';
    return event;
  } else {
    code = generateCode();
    expiresAt = now + OTP_TTL_MS;
    lastSentAt = now;
    nextSendCount = sendCount + 1;
    resent = true;
    try {
      const messageId = await sendSms(phone, code);
      log('INFO', 'sms_sent', { destination: masked, messageId, sendCount: nextSendCount });
    } catch (err) {
      // Surface the real reason in CloudWatch (unregistered Sender ID, spend limit,
      // opt-out list...) but never fail the trigger: a thrown error here turns into
      // an opaque "unexpected error" on the device.
      log('ERROR', 'sms_send_failed', { destination: masked, error: String(err) });
      event.response.publicChallengeParameters = { destination: masked, resent: 'false', deliveryFailed: 'true' };
      event.response.privateChallengeParameters = { answer: `undelivered-${randomInt(1e12)}`, expiresAt: '0' };
      event.response.challengeMetadata = 'SMS_OTP_SEND_FAILED';
      return event;
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

  // publicChallengeParameters reach the device — only ever put non-secret data here.
  event.response.publicChallengeParameters = {
    destination: masked,
    resent: String(resent),
    expiresAt: String(expiresAt),
  };
  event.response.privateChallengeParameters = { answer: code, expiresAt: String(expiresAt) };
  event.response.challengeMetadata = 'SMS_OTP';
  return event;
};
