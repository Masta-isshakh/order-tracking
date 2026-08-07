/**
 * Phone helpers shared by every Lambda in the backend.
 *
 * Every phone number that enters the system is normalised to E.164 exactly once,
 * here, so that Cognito usernames, DynamoDB keys and Data records can never drift
 * apart because of formatting ("+974 5551 2345" vs "97455512345" vs "055512345").
 */

/** Qatar. Used when a caller supplies a bare local number with no country code. */
export const DEFAULT_DIAL_CODE = '974';

/** Local subscriber length per supported country, used to detect bare local numbers. */
const LOCAL_LENGTHS: Record<string, number> = {
  '974': 8, // Qatar
};

/**
 * Convert any user-entered phone string into strict E.164, or return null when the
 * input cannot possibly be a phone number. Never throws.
 */
export const normalizePhone = (
  raw: string | null | undefined,
  defaultDialCode: string = DEFAULT_DIAL_CODE,
): string | null => {
  if (!raw) return null;

  let value = String(raw).trim();
  // "00974..." is the international prefix used across the Gulf.
  if (value.startsWith('00')) value = `+${value.slice(2)}`;

  const hadPlus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;

  let e164: string;
  if (hadPlus) {
    e164 = `+${digits}`;
  } else if (digits.length === LOCAL_LENGTHS[defaultDialCode]) {
    // Bare local number, e.g. "55512345" in Qatar.
    e164 = `+${defaultDialCode}${digits}`;
  } else if (digits.startsWith(defaultDialCode)) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('0') && LOCAL_LENGTHS[defaultDialCode]) {
    // Trunk-prefixed local number, e.g. "055512345".
    const local = digits.replace(/^0+/, '');
    e164 = `+${defaultDialCode}${local}`;
  } else {
    e164 = `+${digits}`;
  }

  // E.164: '+', a non-zero country digit, then 7..14 more digits.
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
};

/** "+97455512345" -> "+974 •••• 2345". Safe to show in UI and logs. */
export const maskPhone = (e164: string): string => {
  if (!e164 || e164.length < 8) return '••••';
  const tail = e164.slice(-4);
  const head = e164.slice(0, e164.length - 8);
  return `${head} •••• ${tail}`.trim();
};

/**
 * Constant-time string comparison. Used for OTP checks so that a wrong code never
 * leaks how many leading digits were correct through response timing.
 */
export const safeCompare = (a: string, b: string): boolean => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};
