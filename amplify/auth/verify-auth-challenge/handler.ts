import type { VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { maskPhone, normalizePhone, safeCompare } from '../../shared/phone';

const REGION = process.env.AWS_REGION ?? 'ap-south-1';
const TABLE = process.env.OTP_TABLE_NAME ?? '';
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const log = (level: 'INFO' | 'WARN', message: string, extra: Record<string, unknown> = {}) => {
  console[level === 'WARN' ? 'warn' : 'log'](
    JSON.stringify({ level, trigger: 'verifyAuthChallenge', message, ...extra }),
  );
};

export const handler: VerifyAuthChallengeResponseTriggerHandler = async (event) => {
  const expected = event.request.privateChallengeParameters?.answer ?? '';
  const expiresAt = Number(event.request.privateChallengeParameters?.expiresAt ?? 0);
  const provided = String(event.request.challengeAnswer ?? '')
    .replace(/\D/g, '')
    .trim();

  const phone = normalizePhone(event.request.userAttributes?.phone_number);
  const masked = phone ? maskPhone(phone) : 'unknown';

  // expiresAt === 0 marks the sentinel answers createAuthChallenge writes when it
  // could not deliver an SMS, so those sessions can never be satisfied.
  const isLive = expiresAt > 0 && Date.now() < expiresAt;
  const correct = isLive && provided.length === 6 && safeCompare(provided, expected);

  event.response.answerCorrect = correct;

  if (correct && TABLE && phone) {
    // Burn the code so it cannot be replayed on a second sign-in session.
    try {
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { phone } }));
    } catch (err) {
      log('WARN', 'otp_burn_failed', { destination: masked, error: String(err) });
    }
  }

  log(correct ? 'INFO' : 'WARN', correct ? 'otp_accepted' : 'otp_rejected', {
    destination: masked,
    expired: expiresAt > 0 && !isLive,
  });

  return event;
};
