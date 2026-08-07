import { randomBytes, randomInt } from 'node:crypto';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
  UsernameExistsException,
  type AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';

export const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? 'ap-south-1',
});

export type StarsGroup = 'ADMIN' | 'SUPERVISOR' | 'CUSTOMER';

const attr = (list: AttributeType[] | undefined, name: string): string | undefined =>
  list?.find((a) => a.Name === name)?.Value;

/**
 * Password that satisfies the pool policy (upper/lower/digit/symbol, >= 8) and
 * that nobody will ever see. Sign-in is SMS-only; the password exists purely to
 * move the account out of FORCE_CHANGE_PASSWORD, which custom auth cannot use.
 */
const throwawayPassword = (): string => {
  const symbols = '!@#$%^&*()-_=+';
  return [
    'Aa1',
    symbols[randomInt(symbols.length)],
    randomBytes(18).toString('base64url').replace(/[^A-Za-z0-9]/g, ''),
  ].join('');
};

export type EnsureUserInput = {
  userPoolId: string;
  /** Already normalised to E.164 by the caller. */
  phone: string;
  name?: string | null;
  email?: string | null;
  group: StarsGroup;
};

export type EnsureUserResult = {
  /** Cognito `sub` — the value stored in `customerOwner` / `ownerSub`. */
  sub: string;
  /** The pool's internal username (a UUID when phone is the username attribute). */
  username: string;
  created: boolean;
};

/** Reads a user by phone number. Returns null when the account does not exist. */
export const findUserByPhone = async (
  userPoolId: string,
  phone: string,
): Promise<{ sub: string; username: string; enabled: boolean } | null> => {
  try {
    const res = await cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: phone }));
    const sub = attr(res.UserAttributes, 'sub');
    if (!sub || !res.Username) return null;
    return { sub, username: res.Username, enabled: res.Enabled !== false };
  } catch (err) {
    if (err instanceof UserNotFoundException) return null;
    throw err;
  }
};

/**
 * Creates the account if it is missing, then guarantees it is in `group` and is
 * usable for SMS sign-in. Safe to call repeatedly for the same phone number —
 * staff re-entering an existing customer must not produce a duplicate or an error.
 */
export const ensureUserInGroup = async (input: EnsureUserInput): Promise<EnsureUserResult> => {
  const { userPoolId, phone, name, email, group } = input;

  const existing = await findUserByPhone(userPoolId, phone);
  if (existing) {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: existing.username,
        GroupName: group,
      }),
    );
    // Refresh the display name so an order always shows the latest spelling.
    const updates: AttributeType[] = [];
    if (name) updates.push({ Name: 'name', Value: name });
    if (email) updates.push({ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'false' });
    if (updates.length) {
      await cognito.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: existing.username,
          UserAttributes: updates,
        }),
      );
    }
    if (!existing.enabled) {
      await cognito.send(
        new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: existing.username }),
      );
    }
    return { sub: existing.sub, username: existing.username, created: false };
  }

  const userAttributes: AttributeType[] = [
    { Name: 'phone_number', Value: phone },
    // Pre-verified: the number is proven at sign-in by the SMS challenge itself,
    // so Cognito must never try to send its own verification message.
    { Name: 'phone_number_verified', Value: 'true' },
  ];
  if (name) userAttributes.push({ Name: 'name', Value: name });
  if (email) userAttributes.push({ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'false' });

  try {
    const created = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: phone,
        UserAttributes: userAttributes,
        MessageAction: 'SUPPRESS', // no Cognito-generated SMS or email, ever
        DesiredDeliveryMediums: [],
      }),
    );

    const username = created.User?.Username;
    const sub = attr(created.User?.Attributes, 'sub');
    if (!username || !sub) {
      throw new Error('Cognito did not return a username/sub for the new account');
    }

    // Moves the account from FORCE_CHANGE_PASSWORD to CONFIRMED. Without this the
    // custom auth flow rejects the user before the first SMS is ever sent.
    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: username,
        Password: throwawayPassword(),
        Permanent: true,
      }),
    );

    await cognito.send(
      new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: group }),
    );

    return { sub, username, created: true };
  } catch (err) {
    // Lost a race with a concurrent create — re-read and continue.
    if (err instanceof UsernameExistsException) {
      const again = await findUserByPhone(userPoolId, phone);
      if (again) {
        await cognito.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: again.username,
            GroupName: group,
          }),
        );
        return { sub: again.sub, username: again.username, created: false };
      }
    }
    throw err;
  }
};

export const setUserEnabled = async (userPoolId: string, username: string, enabled: boolean) => {
  await cognito.send(
    enabled
      ? new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: username })
      : new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: username }),
  );
};

export const deleteUser = async (userPoolId: string, username: string) => {
  try {
    await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }));
  } catch (err) {
    if (!(err instanceof UserNotFoundException)) throw err;
  }
};
