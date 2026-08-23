import {
  CreateSMSSandboxPhoneNumberCommand,
  DeleteSMSSandboxPhoneNumberCommand,
  GetSMSSandboxAccountStatusCommand,
  ListSMSSandboxPhoneNumbersCommand,
  SNSClient,
  VerifySMSSandboxPhoneNumberCommand,
} from '@aws-sdk/client-sns';
import { normalizePhone } from '../../shared/phone';
import { maskPhone } from '../../shared/phone';
import { resolverFieldName, type AmplifyResolverEvent } from '../../shared/appsync';

const REGION = process.env.AWS_REGION ?? 'ap-south-1';
const DEFAULT_DIAL_CODE = process.env.DEFAULT_DIAL_CODE || '974';
const sns = new SNSClient({ region: REGION });

type Result = {
  ok: boolean;
  code?: string | null;
  message?: string | null;
  /** JSON string: the registry snapshot, so one round trip refreshes the page. */
  data?: string | null;
};

const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, extra: Record<string, unknown> = {}) => {
  const line = JSON.stringify({ level, trigger: 'smsRegistry', message, ...extra });
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
};

const fail = (code: string, message: string): Result => ({ ok: false, code, message });

/**
 * Turns an AWS SDK error into something an admin can act on. The raw messages
 * ("InvalidParameter") tell a non-engineer nothing.
 */
const explain = (err: unknown): Result => {
  const name = (err as { name?: string })?.name ?? '';
  const raw = (err as { message?: string })?.message ?? String(err);

  if (name === 'OptedOutException') {
    return fail(
      'OPTED_OUT',
      'This number replied STOP to a previous message, so AWS will not text it. The owner must reply START, then try again.',
    );
  }
  if (name === 'UserErrorException' && /already exists|already pending/i.test(raw)) {
    return fail('ALREADY_ADDED', 'This number is already in the list.');
  }
  if (name === 'VerificationException') {
    return fail('WRONG_CODE', 'That code does not match. Check the SMS and try again, or resend it.');
  }
  if (name === 'ResourceNotFoundException') {
    return fail('NOT_FOUND', 'That number is not in the list. Add it first.');
  }
  // PinpointSmsVoiceV2 returns this as plain 'Throttling'; the older SNS
  // surface used the two longer names. Its read APIs allow only about one
  // call a second, so this is reachable just by reopening the screen.
  if (
    name === 'Throttling' ||
    name === 'ThrottlingException' ||
    name === 'ThrottledException' ||
    name === 'TooManyRequestsException'
  ) {
    return fail('THROTTLED', 'Too many attempts. Wait a minute and try again.');
  }
  if (name === 'AuthorizationErrorException') {
    return fail('NOT_PERMITTED', 'The backend is missing SNS permissions. Redeploy the backend.');
  }
  return fail('ERROR', raw);
};

/** The full picture the admin screen renders in one shot. */
const snapshot = async (): Promise<string> => {
  const status = await sns.send(new GetSMSSandboxAccountStatusCommand({}));

  const numbers: { phone: string; status: string }[] = [];
  let nextToken: string | undefined;
  do {
    const page = await sns.send(new ListSMSSandboxPhoneNumbersCommand({ NextToken: nextToken }));
    for (const entry of page.PhoneNumbers ?? []) {
      numbers.push({ phone: entry.PhoneNumber ?? '', status: entry.Status ?? 'Unknown' });
    }
    nextToken = page.NextToken;
  } while (nextToken);

  return JSON.stringify({
    // false once AWS grants production access, at which point this whole screen
    // becomes unnecessary and every number can be texted.
    inSandbox: status.IsInSandbox ?? true,
    numbers: numbers.sort((a, b) => a.phone.localeCompare(b.phone)),
  });
};

const ok = async (extra: Partial<Result> = {}): Promise<Result> => ({
  ok: true,
  code: 'OK',
  data: await snapshot(),
  ...extra,
});

export const handler = async (event: AmplifyResolverEvent): Promise<Result> => {
  const field = resolverFieldName(event);
  const rawPhone = String(event.arguments?.phone ?? '');
  const phone = rawPhone ? normalizePhone(rawPhone, DEFAULT_DIAL_CODE) : null;

  try {
    switch (field) {
      case 'listSmsNumbers':
        return await ok();

      case 'registerSmsNumber': {
        if (!phone) return fail('INVALID_PHONE', 'Enter a valid phone number.');
        // Sends AWS's own verification SMS to the destination.
        await sns.send(
          new CreateSMSSandboxPhoneNumberCommand({ PhoneNumber: phone, LanguageCode: 'en-US' }),
        );
        log('INFO', 'number_registered', { destination: maskPhone(phone) });
        return await ok({ message: 'Verification code sent.' });
      }

      case 'confirmSmsNumber': {
        if (!phone) return fail('INVALID_PHONE', 'Enter a valid phone number.');
        const code = String(event.arguments?.code ?? '').replace(/\D/g, '');
        if (code.length < 4) return fail('INVALID_CODE', 'Enter the code from the SMS.');
        await sns.send(
          new VerifySMSSandboxPhoneNumberCommand({ PhoneNumber: phone, OneTimePassword: code }),
        );
        log('INFO', 'number_verified', { destination: maskPhone(phone) });
        return await ok({ message: 'Number verified. It can now receive sign-in codes.' });
      }

      case 'removeSmsNumber': {
        if (!phone) return fail('INVALID_PHONE', 'Enter a valid phone number.');
        await sns.send(new DeleteSMSSandboxPhoneNumberCommand({ PhoneNumber: phone }));
        log('INFO', 'number_removed', { destination: maskPhone(phone) });
        return await ok({ message: 'Number removed.' });
      }

      default:
        return fail('UNKNOWN_FIELD', `sms-registry cannot handle "${field}"`);
    }
  } catch (err) {
    log('ERROR', 'sms_registry_failed', { field, error: String(err) });
    const explained = explain(err);
    // Still return the snapshot so the screen stays accurate after a failure.
    try {
      return { ...explained, data: await snapshot() };
    } catch {
      return explained;
    }
  }
};
