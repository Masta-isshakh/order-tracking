/**
 * How a phone number gets proven.
 *
 * The Cognito custom-auth flow, the groups, and every authorization rule stay
 * identical across providers — only the "who delivers and checks the code" step
 * swaps. That is why this is an env-var switch rather than a rewrite.
 */
export const OTP_PROVIDERS = ['SNS', 'TWILIO', 'FIREBASE'] as const;
export type OtpProvider = (typeof OTP_PROVIDERS)[number];

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
