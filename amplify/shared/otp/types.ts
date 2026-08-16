/**
 * How a phone number gets proven.
 *
 * The Cognito custom-auth flow, the groups, and every authorization rule stay
 * identical across providers — only the "who delivers and checks the code" step
 * swaps. That is why this is an env-var switch rather than a rewrite.
 */
export const OTP_PROVIDERS = ['SNS', 'TWILIO', 'FIREBASE', 'DEV', 'NONE'] as const;
export type OtpProvider = (typeof OTP_PROVIDERS)[number];

/**
 * Two modes exist for working while SMS delivery is blocked by a provider's
 * compliance review:
 *
 *   DEV   issues a real code, sends nothing, and shows it on screen.
 *   NONE  skips verification entirely — entering a registered number signs you
 *         straight in.
 *
 * Neither is a weaker login. Both are NO login: anyone who knows a registered
 * phone number can sign in as that person. They exist so the product can be
 * built and demonstrated, and `check-backend` fails hard while either is active
 * so they cannot quietly reach real customers.
 */
export const isInsecureProvider = (provider: OtpProvider): boolean =>
  provider === 'DEV' || provider === 'NONE';

export const resolveProvider = (): OtpProvider => {
  const raw = (process.env.OTP_PROVIDER ?? 'SNS').toUpperCase();
  return (OTP_PROVIDERS as readonly string[]).includes(raw) ? (raw as OtpProvider) : 'SNS';
};

export type SendOutcome =
  | { status: 'SENT'; reference?: string | null }
  | { status: 'SUPPRESSED'; reason: 'COOLDOWN' | 'RATE_LIMIT' }
  | { status: 'FAILED'; reason: string };

export type CheckOutcome = { correct: boolean; reason?: string };

export const log = (
  level: 'INFO' | 'WARN' | 'ERROR',
  trigger: string,
  message: string,
  extra: Record<string, unknown> = {},
) => {
  const line = JSON.stringify({ level, trigger, message, ...extra });
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
};
