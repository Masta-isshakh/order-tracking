import type { VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { env } from '$amplify/env/verify-auth-challenge';
import { maskPhone, normalizePhone, safeCompare } from '../../shared/phone';
import { log, resolveProvider } from '../../shared/otp/types';
import { checkVerification, twilioCredentials } from '../../shared/otp/twilio';
import { verifyFirebaseIdToken } from '../../shared/otp/firebase';

// Secrets only resolve through this generated module — see twilioCredentials().
const twilio = twilioCredentials(env);

const REGION = process.env.AWS_REGION ?? 'ap-south-1';
const TABLE = process.env.OTP_TABLE_NAME ?? '';
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const TRIGGER = 'verifyAuthChallenge';

/** Burns the throttle record so a code can never be replayed on a new session. */
const clearRecord = async (phone: string, masked: string) => {
  if (!TABLE) return;
  try {
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { phone } }));
  } catch (err) {
    log('WARN', TRIGGER, 'otp_burn_failed', { destination: masked, error: String(err) });
  }
};

export const handler: VerifyAuthChallengeResponseTriggerHandler = async (event) => {
  const provider = resolveProvider();
  const params = event.request.privateChallengeParameters ?? {};
  const issuedFor = params.provider ?? provider;

  const phone = normalizePhone(event.request.userAttributes?.phone_number);
  const masked = phone ? maskPhone(phone) : 'unknown';
  const answer = String(event.request.challengeAnswer ?? '').trim();

  // createAuthChallenge writes expiresAt "0" whenever it could not issue a
  // challenge (delivery failure, throttle, unknown user). Those sessions must
  // never be satisfiable, whatever the user types.
  if (params.expiresAt === '0' || issuedFor === 'NONE') {
    event.response.answerCorrect = false;
    log('WARN', TRIGGER, 'otp_rejected_dead_challenge', { destination: masked, provider: issuedFor });
    return event;
  }

  let correct = false;
  let reason: string | undefined;

  if (issuedFor === 'FIREBASE') {
    // The answer is a Firebase ID token, not a 6-digit code.
    if (!phone) {
      reason = 'no phone on the account';
    } else {
      const outcome = await verifyFirebaseIdToken(answer, phone);
      correct = outcome.correct;
      reason = outcome.reason;
    }
  } else if (issuedFor === 'TWILIO') {
    const digits = answer.replace(/\D/g, '');
    if (digits.length !== 6 || !phone) {
      reason = 'malformed code';
    } else {
      const outcome = await checkVerification(twilio, phone, digits);
      correct = outcome.correct;
      reason = outcome.reason;
    }
  } else {
    // SNS and DEV both issue the code themselves, so we compare it here.
    const digits = answer.replace(/\D/g, '');
    const expected = params.answer ?? '';
    const expiresAt = Number(params.expiresAt ?? 0);
    const live = expiresAt > 0 && Date.now() < expiresAt;
    correct = live && digits.length === 6 && safeCompare(digits, expected);
    if (!live) reason = 'expired';
  }

  event.response.answerCorrect = correct;

  if (correct && phone) {
    await clearRecord(phone, masked);
  }

  log(correct ? 'INFO' : 'WARN', TRIGGER, correct ? 'otp_accepted' : 'otp_rejected', {
    destination: masked,
    provider: issuedFor,
    ...(reason ? { reason } : {}),
  });

  return event;
};
