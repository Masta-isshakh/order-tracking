import {
  CreateSMSSandboxPhoneNumberCommand,
  GetSMSSandboxAccountStatusCommand,
  ListSMSSandboxPhoneNumbersCommand,
  SNSClient,
} from '@aws-sdk/client-sns';
import { maskPhone } from './phone';

const sns = new SNSClient({ region: process.env.AWS_REGION ?? 'ap-south-1' });

export type SmsRegistration =
  | { state: 'NOT_NEEDED' }
  | { state: 'ALREADY_VERIFIED' }
  | { state: 'CODE_SENT' }
  | { state: 'PENDING' }
  | { state: 'FAILED'; reason: string };

/**
 * Makes a number eligible to receive SMS from this AWS account.
 *
 * While the account is in the SMS sandbox, SNS refuses to deliver to anything
 * that has not been registered and confirmed. Creating a staff member therefore
 * has to register their number too, or their very first sign-in code would
 * silently never arrive.
 *
 * Never throws: failing to register must not roll back an otherwise successful
 * account creation. The caller reports the outcome so the admin can retry from
 * the Phone Numbers screen.
 */
export const registerForSms = async (phone: string): Promise<SmsRegistration> => {
  const masked = maskPhone(phone);
  const log = (message: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ level: 'INFO', trigger: 'registerForSms', message, ...extra }));

  try {
    const status = await sns.send(new GetSMSSandboxAccountStatusCommand({}));
    if (status.IsInSandbox === false) {
      // Production access: any number can be texted, nothing to register.
      return { state: 'NOT_NEEDED' };
    }

    // Re-adding an existing number throws, so check first.
    let nextToken: string | undefined;
    do {
      const page = await sns.send(new ListSMSSandboxPhoneNumbersCommand({ NextToken: nextToken }));
      const found = (page.PhoneNumbers ?? []).find((entry) => entry.PhoneNumber === phone);
      if (found) {
        log('already_present', { destination: masked, status: found.Status });
        return found.Status === 'Verified' ? { state: 'ALREADY_VERIFIED' } : { state: 'PENDING' };
      }
      nextToken = page.NextToken;
    } while (nextToken);

    await sns.send(
      new CreateSMSSandboxPhoneNumberCommand({ PhoneNumber: phone, LanguageCode: 'en-US' }),
    );
    log('code_sent', { destination: masked });
    return { state: 'CODE_SENT' };
  } catch (err) {
    const reason = (err as { name?: string })?.name ?? String(err);
    console.warn(
      JSON.stringify({
        level: 'WARN',
        trigger: 'registerForSms',
        message: 'registration_failed',
        destination: masked,
        reason,
      }),
    );
    return { state: 'FAILED', reason };
  }
};
