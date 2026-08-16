import { useCallback } from 'react';
import { client, must } from '../lib/amplify';
import { useAsync } from './useAsync';

/**
 * The list of numbers Amazon SNS is allowed to text.
 *
 * This is AWS account state, not app data — while the account is in the SMS
 * sandbox, SNS silently refuses to deliver to anything not on it. The admin
 * screens drive it so nobody has to open the AWS console.
 */
export type SmsNumberStatus = 'Verified' | 'Pending' | string;

export type SmsNumber = {
  phone: string;
  status: SmsNumberStatus;
};

export type SmsRegistry = {
  /** False once AWS grants production access — then the whole screen is moot. */
  inSandbox: boolean;
  numbers: SmsNumber[];
};

const EMPTY: SmsRegistry = { inSandbox: true, numbers: [] };

const parse = (raw?: string | null): SmsRegistry => {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<SmsRegistry>;
    return {
      inSandbox: parsed.inSandbox !== false,
      numbers: Array.isArray(parsed.numbers) ? parsed.numbers : [],
    };
  } catch {
    return EMPTY;
  }
};

export type RegistryOutcome = {
  ok: boolean;
  code: string;
  message: string;
  registry: SmsRegistry;
};

const toOutcome = (result: {
  ok: boolean;
  code?: string | null;
  message?: string | null;
  data?: string | null;
}): RegistryOutcome => ({
  ok: result.ok,
  code: result.code ?? (result.ok ? 'OK' : 'ERROR'),
  message: result.message ?? '',
  registry: parse(result.data),
});

export const useSmsRegistry = (enabled = true) => {
  const load = useCallback(async () => {
    const result = must(await client.queries.listSmsNumbers(), 'list SMS numbers');
    return parse(result?.data);
  }, []);

  return useAsync<SmsRegistry>(load, [], { enabled });
};

/** Adds a number and asks AWS to text it a verification code. */
export const registerSmsNumber = async (phone: string): Promise<RegistryOutcome> =>
  toOutcome(must(await client.mutations.registerSmsNumber({ phone }), 'register SMS number')!);

/** Confirms the code the number received. */
export const confirmSmsNumber = async (phone: string, code: string): Promise<RegistryOutcome> =>
  toOutcome(must(await client.mutations.confirmSmsNumber({ phone, code }), 'confirm SMS number')!);

export const removeSmsNumber = async (phone: string): Promise<RegistryOutcome> =>
  toOutcome(must(await client.mutations.removeSmsNumber({ phone }), 'remove SMS number')!);
