import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  confirmSignIn,
  fetchAuthSession,
  getCurrentUser,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import type { Role } from '../../shared/domain';

/** Ordered strongest-first: a user in several groups gets the highest role. */
const ROLE_PRECEDENCE: Role[] = ['ADMIN', 'SUPERVISOR', 'CUSTOMER'];

export type SignedInUser = {
  sub: string;
  phone: string;
  name: string;
  groups: string[];
  role: Role;
};

/** Machine-readable failures the screens turn into localised messages. */
export type AuthErrorCode =
  | 'INVALID_PHONE'
  | 'NOT_REGISTERED'
  | 'INVALID_CODE'
  | 'EXPIRED_CODE'
  | 'TOO_MANY_ATTEMPTS'
  | 'TOO_MANY_REQUESTS'
  | 'SMS_FAILED'
  | 'SESSION_EXPIRED'
  | 'GENERIC';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AuthError';
  }
}

type ChallengeState = {
  phone: string;
  /** Masked number returned by the backend, safe to display. */
  destination: string;
  requestedAt: number;
};

type AuthContextValue = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: SignedInUser | null;
  challenge: ChallengeState | null;
  /** Sends the SMS and moves the flow to the code screen. */
  startSignIn: (e164Phone: string) => Promise<ChallengeState>;
  /** Verifies the 6-digit code. Resolves with the signed-in user. */
  submitCode: (code: string) => Promise<SignedInUser>;
  cancelSignIn: () => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const pickRole = (groups: string[]): Role =>
  ROLE_PRECEDENCE.find((role) => groups.includes(role)) ?? 'CUSTOMER';

const readSession = async (): Promise<SignedInUser | null> => {
  try {
    const session = await fetchAuthSession();
    const payload = session.tokens?.idToken?.payload;
    if (!payload) return null;

    const raw = payload['cognito:groups'];
    const groups = Array.isArray(raw) ? raw.map(String) : [];
    const sub = String(payload.sub ?? '');
    if (!sub) return null;

    let name = typeof payload.name === 'string' ? payload.name : '';
    if (!name) {
      try {
        name = (await getCurrentUser()).username ?? '';
      } catch {
        name = '';
      }
    }

    return {
      sub,
      phone: typeof payload.phone_number === 'string' ? payload.phone_number : '',
      name,
      groups,
      role: pickRole(groups),
    };
  } catch {
    return null;
  }
};

/** Cognito error names are the only signal we get; map them to something usable. */
const mapSignInError = (err: unknown, stage: 'start' | 'confirm'): AuthError => {
  const name = (err as { name?: string })?.name ?? '';
  const message = (err as { message?: string })?.message ?? '';

  if (name === 'UserNotFoundException') return new AuthError('NOT_REGISTERED', message);
  if (name === 'NotAuthorizedException') {
    // With PreventUserExistenceErrors on, an unknown number and a burnt-out
    // challenge both surface here — the stage tells them apart.
    return stage === 'start'
      ? new AuthError('NOT_REGISTERED', message)
      : new AuthError('TOO_MANY_ATTEMPTS', message);
  }
  if (name === 'UserNotConfirmedException') return new AuthError('NOT_REGISTERED', message);
  if (name === 'CodeMismatchException') return new AuthError('INVALID_CODE', message);
  if (name === 'ExpiredCodeException') return new AuthError('EXPIRED_CODE', message);
  if (name === 'TooManyRequestsException' || name === 'LimitExceededException') {
    return new AuthError('TOO_MANY_REQUESTS', message);
  }
  if (name === 'TooManyFailedAttemptsException') return new AuthError('TOO_MANY_ATTEMPTS', message);
  if (name === 'InvalidParameterException') return new AuthError('INVALID_PHONE', message);
  return new AuthError('GENERIC', message || String(err));
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<'loading' | 'signedOut' | 'signedIn'>('loading');
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await readSession();
    if (!mounted.current) return;
    setUser(next);
    setStatus(next ? 'signedIn' : 'signedOut');
  }, []);

  useEffect(() => {
    void refresh();
    const stop = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedOut' || payload.event === 'tokenRefresh_failure') {
        setUser(null);
        setStatus('signedOut');
      }
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') {
        void refresh();
      }
    });
    return stop;
  }, [refresh]);

  const startSignIn = useCallback(async (e164Phone: string): Promise<ChallengeState> => {
    if (!/^\+[1-9]\d{6,14}$/.test(e164Phone)) throw new AuthError('INVALID_PHONE');

    // A stale session blocks a fresh challenge with UserAlreadyAuthenticatedException.
    try {
      await amplifySignOut();
    } catch {
      // Nothing to sign out of.
    }

    try {
      const { nextStep } = await amplifySignIn({
        username: e164Phone,
        options: { authFlowType: 'CUSTOM_WITHOUT_SRP' },
      });

      if (nextStep.signInStep !== 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE') {
        throw new AuthError('GENERIC', `Unexpected sign-in step: ${nextStep.signInStep}`);
      }

      // createAuthChallenge reports delivery problems here rather than throwing,
      // so the user is told the truth instead of waiting for an SMS that failed.
      const info = (nextStep.additionalInfo ?? {}) as Record<string, string>;
      if (info.deliveryFailed === 'true') throw new AuthError('SMS_FAILED');
      if (info.throttled === 'true') throw new AuthError('TOO_MANY_REQUESTS');

      const next: ChallengeState = {
        phone: e164Phone,
        destination: info.destination || e164Phone,
        requestedAt: Date.now(),
      };
      if (mounted.current) setChallenge(next);
      return next;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw mapSignInError(err, 'start');
    }
  }, []);

  const submitCode = useCallback(
    async (code: string): Promise<SignedInUser> => {
      const digits = code.replace(/\D/g, '');
      if (digits.length !== 6) throw new AuthError('INVALID_CODE');

      try {
        const { isSignedIn, nextStep } = await confirmSignIn({ challengeResponse: digits });

        if (!isSignedIn) {
          // Cognito re-issued the challenge: the code was wrong but retries remain.
          if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE') {
            throw new AuthError('INVALID_CODE');
          }
          throw new AuthError('GENERIC', `Unexpected sign-in step: ${nextStep.signInStep}`);
        }

        const signedIn = await readSession();
        if (!signedIn) throw new AuthError('SESSION_EXPIRED');

        if (mounted.current) {
          setUser(signedIn);
          setStatus('signedIn');
          setChallenge(null);
        }
        return signedIn;
      } catch (err) {
        if (err instanceof AuthError) throw err;
        throw mapSignInError(err, 'confirm');
      }
    },
    [],
  );

  const cancelSignIn = useCallback(() => {
    setChallenge(null);
    void amplifySignOut().catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    try {
      await amplifySignOut();
    } finally {
      if (mounted.current) {
        setUser(null);
        setChallenge(null);
        setStatus('signedOut');
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, challenge, startSignIn, submitCode, cancelSignIn, signOut, refresh }),
    [status, user, challenge, startSignIn, submitCode, cancelSignIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export const useRole = (): Role | null => useAuth().user?.role ?? null;

export const useIsStaff = (): boolean => {
  const role = useRole();
  return role === 'ADMIN' || role === 'SUPERVISOR';
};
