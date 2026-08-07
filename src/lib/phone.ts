import { DEFAULT_DIAL_CODE, maskPhone, normalizePhone } from '../../amplify/shared/phone';

export { normalizePhone, maskPhone, DEFAULT_DIAL_CODE };

/** Country the app is built for. Adding another is a one-line change here. */
export const COUNTRIES = [
  { code: 'QA', dial: '974', flag: '🇶🇦', digits: 8, sample: '5555 1234' },
  { code: 'SA', dial: '966', flag: '🇸🇦', digits: 9, sample: '55 123 4567' },
  { code: 'AE', dial: '971', flag: '🇦🇪', digits: 9, sample: '50 123 4567' },
  { code: 'BH', dial: '973', flag: '🇧🇭', digits: 8, sample: '3600 1234' },
  { code: 'KW', dial: '965', flag: '🇰🇼', digits: 8, sample: '5000 1234' },
  { code: 'OM', dial: '968', flag: '🇴🇲', digits: 8, sample: '9200 1234' },
  { code: 'IN', dial: '91', flag: '🇮🇳', digits: 10, sample: '98765 43210' },
] as const;

export type Country = (typeof COUNTRIES)[number];

export const DEFAULT_COUNTRY: Country = COUNTRIES[0];

export const countryForDial = (dial: string): Country =>
  COUNTRIES.find((c) => c.dial === dial) ?? DEFAULT_COUNTRY;

/** Groups local digits for readability while typing: "55551234" -> "5555 1234". */
export const formatLocalDigits = (digits: string, country: Country): string => {
  const clean = digits.replace(/\D/g, '').slice(0, country.digits);
  if (country.dial === '974' || country.dial === '973' || country.dial === '965' || country.dial === '968') {
    return clean.replace(/^(\d{4})(\d{0,4})$/, (_, a, b) => (b ? `${a} ${b}` : a));
  }
  if (country.dial === '91') {
    return clean.replace(/^(\d{5})(\d{0,5})$/, (_, a, b) => (b ? `${a} ${b}` : a));
  }
  return clean.replace(/^(\d{2})(\d{0,3})(\d{0,4})$/, (_, a, b, c) =>
    [a, b, c].filter(Boolean).join(' '),
  );
};

/** True when the local part looks complete for the chosen country. */
export const isLocalComplete = (digits: string, country: Country): boolean =>
  digits.replace(/\D/g, '').length === country.digits;

export const toE164 = (localDigits: string, country: Country): string | null =>
  normalizePhone(`+${country.dial}${localDigits.replace(/\D/g, '')}`);

/** Splits a stored E.164 number back into a country + local part for editing. */
export const fromE164 = (e164?: string | null): { country: Country; local: string } => {
  const value = (e164 ?? '').replace(/[^\d]/g, '');
  const match = COUNTRIES.find((c) => value.startsWith(c.dial));
  if (!match) return { country: DEFAULT_COUNTRY, local: '' };
  return { country: match, local: value.slice(match.dial.length) };
};

/** Human-readable form for lists and headers: "+974 5555 1234". */
export const prettyPhone = (e164?: string | null): string => {
  if (!e164) return '—';
  const { country, local } = fromE164(e164);
  if (!local) return e164;
  return `+${country.dial} ${formatLocalDigits(local, country)}`;
};
