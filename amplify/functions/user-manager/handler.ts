import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/user-manager';
import type { Schema } from '../../data/resource';
import { normalizePhone } from '../../shared/phone';
import { deleteUser, ensureUserInGroup, findUserByPhone, setUserEnabled } from '../../shared/cognito';
import { registerForSms } from '../../shared/sms-registry';
import {
  callerName,
  callerSub,
  resolverFieldName,
  type AmplifyResolverEvent,
} from '../../shared/appsync';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>({ authMode: 'iam' });

const USER_POOL_ID = env.AMPLIFY_AUTH_USERPOOL_ID;
const DEFAULT_DIAL_CODE = process.env.DEFAULT_DIAL_CODE || '974';

type Result = {
  ok: boolean;
  code?: string | null;
  message?: string | null;
  userId?: string | null;
  phone?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
};

const fail = (code: string, message: string): Result => ({ ok: false, code, message });
const ok = (extra: Partial<Result> = {}): Result => ({ ok: true, code: 'OK', ...extra });

/** Flattens the {data, errors} envelope the Data client returns. */
const unwrap = <T>(res: { data?: T | null; errors?: { message: string }[] | null }, what: string): T => {
  if (res.errors?.length) {
    throw new Error(`${what}: ${res.errors.map((e) => e.message).join('; ')}`);
  }
  if (res.data === null || res.data === undefined) {
    throw new Error(`${what}: no data returned`);
  }
  return res.data;
};

export const handler = async (event: AmplifyResolverEvent): Promise<Result> => {
  const actorSub = callerSub(event);
  const actorName = callerName(event, 'Staff');
  const field = resolverFieldName(event);

  try {
    switch (field) {
      case 'createSupervisor':
        return await createStaff(event.arguments, actorSub, actorName, 'SUPERVISOR');
      case 'createAdministrator':
        return await createStaff(event.arguments, actorSub, actorName, 'ADMIN');
      case 'ensureCustomerAccount':
        return await ensureCustomerAccount(event.arguments, actorSub, actorName);
      case 'updateSupervisorAccess':
        return await updateSupervisorAccess(event.arguments);
      case 'deleteSupervisor':
        return await removeSupervisor(event.arguments);
      default:
        return fail('UNKNOWN_FIELD', `user-manager cannot handle "${field}"`);
    }
  } catch (err) {
    console.error(JSON.stringify({ level: 'ERROR', field, error: String(err) }));
    return fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Unexpected error');
  }
};

/* ------------------------------------------------------------------------- */

/**
 * Creates a staff member in the given Cognito group and records them in the
 * staff directory. Supervisors and administrators differ only by group, so one
 * function serves both.
 */
const createStaff = async (
  args: Record<string, unknown>,
  actorSub: string | null,
  actorName: string,
  role: 'ADMIN' | 'SUPERVISOR',
): Promise<Result> => {
  const name = String(args.name ?? '').trim();
  const phone = normalizePhone(String(args.phone ?? ''), DEFAULT_DIAL_CODE);
  const email = String(args.email ?? '').trim() || null;
  const description = String(args.description ?? '').trim() || null;

  if (!name) return fail('NAME_REQUIRED', 'Name is required');
  if (!phone) return fail('INVALID_PHONE', 'Enter a valid phone number');

  const duplicates = unwrap(
    await client.models.SupervisorProfile.listSupervisorProfileByPhone({ phone }),
    'lookup staff member',
  );
  if (duplicates.length > 0) {
    return fail('ALREADY_EXISTS', 'Someone with this phone number already exists');
  }

  const user = await ensureUserInGroup({ userPoolId: USER_POOL_ID, phone, name, email, group: role });

  // Staff sign in with an SMS code, so the number must also be allowed to
  // receive SMS from this AWS account. Doing it here means the new member gets
  // their verification message immediately rather than discovering at first
  // sign-in that codes never arrive.
  const registration = await registerForSms(phone);

  const profile = unwrap(
    await client.models.SupervisorProfile.create({
      phone,
      name,
      email,
      description,
      role,
      isActive: true,
      ownerSub: user.sub,
      cognitoUsername: user.username,
      createdBySub: actorSub,
      createdByName: actorName,
    }),
    'create staff profile',
  );

  // `code` carries the SMS-registration outcome so the app can tell the admin
  // what the new staff member should expect next.
  return ok({ userId: profile?.id, phone, code: `SMS_${registration.state}` });
};

const ensureCustomerAccount = async (
  args: Record<string, unknown>,
  actorSub: string | null,
  actorName: string,
): Promise<Result> => {
  const name = String(args.name ?? '').trim();
  const phone = normalizePhone(String(args.phone ?? ''), DEFAULT_DIAL_CODE);
  const email = String(args.email ?? '').trim() || null;

  if (!name) return fail('NAME_REQUIRED', 'Customer name is required');
  if (!phone) return fail('INVALID_PHONE', 'Enter a valid phone number');

  const user = await ensureUserInGroup({
    userPoolId: USER_POOL_ID,
    phone,
    name,
    email,
    group: 'CUSTOMER',
  });

  const existing = unwrap(
    await client.models.CustomerProfile.listCustomerProfileByPhone({ phone }),
    'lookup customer',
  );

  if (existing.length > 0) {
    const current = existing[0];
    unwrap(
      await client.models.CustomerProfile.update({
        id: current.id,
        name,
        email: email ?? current.email,
        ownerSub: user.sub,
        cognitoUsername: user.username,
        isActive: true,
      }),
      'update customer profile',
    );
    // `userId` always carries the Cognito sub for customers — the caller stores it
    // on the order as `customerOwner`.
    return ok({ userId: user.sub, phone, orderId: current.id });
  }

  const profile = unwrap(
    await client.models.CustomerProfile.create({
      phone,
      name,
      email,
      isActive: true,
      ownerSub: user.sub,
      cognitoUsername: user.username,
      orderCount: 0,
      createdBySub: actorSub,
      createdByName: actorName,
    }),
    'create customer profile',
  );

  return ok({ userId: user.sub, phone, orderId: profile?.id });
};

const updateSupervisorAccess = async (args: Record<string, unknown>): Promise<Result> => {
  const supervisorId = String(args.supervisorId ?? '');
  const isActive = Boolean(args.isActive);

  const profile = unwrap(
    await client.models.SupervisorProfile.get({ id: supervisorId }),
    'read supervisor',
  );
  if (!profile) return fail('NOT_FOUND', 'Supervisor not found');

  const username =
    profile.cognitoUsername ??
    (profile.phone ? (await findUserByPhone(USER_POOL_ID, profile.phone))?.username : undefined);
  if (username) {
    await setUserEnabled(USER_POOL_ID, username, isActive);
  }

  unwrap(
    await client.models.SupervisorProfile.update({ id: supervisorId, isActive }),
    'update supervisor',
  );
  return ok({ userId: supervisorId });
};

const removeSupervisor = async (args: Record<string, unknown>): Promise<Result> => {
  const supervisorId = String(args.supervisorId ?? '');

  const profile = unwrap(
    await client.models.SupervisorProfile.get({ id: supervisorId }),
    'read supervisor',
  );
  if (!profile) return fail('NOT_FOUND', 'Supervisor not found');

  const username =
    profile.cognitoUsername ??
    (profile.phone ? (await findUserByPhone(USER_POOL_ID, profile.phone))?.username : undefined);
  if (username) {
    await deleteUser(USER_POOL_ID, username);
  }

  unwrap(await client.models.SupervisorProfile.delete({ id: supervisorId }), 'delete supervisor');
  return ok({ userId: supervisorId });
};
