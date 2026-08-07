import type { Dictionary } from '../i18n/en';
import type { AuthErrorCode } from './AuthProvider';

/** Maps a backend failure code onto the user's language. */
export const authErrorMessage = (code: AuthErrorCode, d: Dictionary): string => {
  const errors = d.auth.errors;
  switch (code) {
    case 'INVALID_PHONE':
      return errors.invalidPhone;
    case 'NOT_REGISTERED':
      return errors.notRegistered;
    case 'INVALID_CODE':
      return errors.invalidCode;
    case 'EXPIRED_CODE':
      return errors.expiredCode;
    case 'TOO_MANY_ATTEMPTS':
      return errors.tooManyAttempts;
    case 'TOO_MANY_REQUESTS':
      return errors.tooManyRequests;
    case 'SMS_FAILED':
      return errors.smsFailed;
    case 'SESSION_EXPIRED':
      return errors.sessionExpired;
    default:
      return errors.generic;
  }
};

/** Codes that mean the current challenge is dead and the user must start over. */
export const requiresRestart = (code: AuthErrorCode): boolean =>
  code === 'TOO_MANY_ATTEMPTS' || code === 'EXPIRED_CODE' || code === 'SESSION_EXPIRED';
