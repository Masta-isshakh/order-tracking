import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getLocales } from 'expo-localization';
import { en, type Dictionary } from './en';
import { ar } from './ar';
import { readPref, writePref } from '../lib/prefs';
import { DEFAULT_CURRENCY } from '../../shared/domain';

export type Locale = 'en' | 'ar';

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

/**
 * Latin digits are forced in Arabic (`-u-nu-latn`). Order numbers, plate numbers
 * and phone numbers are read back to staff over the phone, and mixing
 * Arabic-Indic digits into those is a reliable source of mistakes.
 */
const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-QA',
  ar: 'ar-QA-u-nu-latn',
};

type I18nContextValue = {
  locale: Locale;
  /** The active dictionary — read strings as `d.common.save`. */
  d: Dictionary;
  setLocale: (next: Locale) => void;
  isRTL: boolean;
  /** 'rtl' | 'ltr' — apply to the root view's `direction` style. */
  dir: 'rtl' | 'ltr';
  /** Fills `{placeholders}` in a dictionary string. */
  t: (template: string, params?: Record<string, string | number>) => string;
  formatMoney: (amount?: number | null, currency?: string) => string;
  formatDate: (value?: string | Date | null, withTime?: boolean) => string;
  formatRelative: (value?: string | Date | null) => string;
  ready: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const deviceLocale = (): Locale => {
  try {
    const tag = getLocales()[0]?.languageCode;
    return tag === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readPref('locale').then((stored) => {
      if (cancelled) return;
      setLocaleState(stored === 'ar' || stored === 'en' ? stored : deviceLocale());
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void writePref('locale', next);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const isRTL = locale === 'ar';
    const intlLocale = INTL_LOCALE[locale];
    const dictionary = DICTIONARIES[locale];

    const t = (template: string, params?: Record<string, string | number>) => {
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in params ? String(params[key]) : match,
      );
    };

    const formatMoney = (amount?: number | null, currency = DEFAULT_CURRENCY) => {
      if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
      try {
        return new Intl.NumberFormat(intlLocale, {
          style: 'currency',
          currency,
          maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        }).format(amount);
      } catch {
        // Hermes without full ICU still needs to render a price.
        return `${currency} ${amount.toFixed(Number.isInteger(amount) ? 0 : 2)}`;
      }
    };

    const toDate = (input?: string | Date | null): Date | null => {
      if (!input) return null;
      const date = input instanceof Date ? input : new Date(input);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const formatDate = (input?: string | Date | null, withTime = false) => {
      const date = toDate(input);
      if (!date) return '—';
      try {
        return new Intl.DateTimeFormat(intlLocale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
        }).format(date);
      } catch {
        return date.toISOString().slice(0, withTime ? 16 : 10).replace('T', ' ');
      }
    };

    const formatRelative = (input?: string | Date | null) => {
      const date = toDate(input);
      if (!date) return '—';
      const diffMs = Date.now() - date.getTime();
      const minutes = Math.floor(diffMs / 60000);
      if (minutes < 1) return dictionary.common.justNow;
      if (minutes < 60) return t(dictionary.common.minutesAgo, { count: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t(dictionary.common.hoursAgo, { count: hours });
      const days = Math.floor(hours / 24);
      if (days <= 7) return t(dictionary.common.daysAgo, { count: days });
      return formatDate(date);
    };

    return {
      locale,
      d: dictionary,
      setLocale,
      isRTL,
      dir: isRTL ? 'rtl' : 'ltr',
      t,
      formatMoney,
      formatDate,
      formatRelative,
      ready,
    };
  }, [locale, setLocale, ready]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
};

/**
 * Picks the Arabic variant of a record when the UI is Arabic and a translation
 * exists, otherwise falls back to the base field. Catalog content is entered by
 * staff, so a missing Arabic name is normal and must degrade gracefully.
 */
export const useLocalizedName = () => {
  const { locale } = useI18n();
  return useCallback(
    (base?: string | null, arabic?: string | null) => {
      if (locale === 'ar' && arabic && arabic.trim()) return arabic;
      return base ?? '';
    },
    [locale],
  );
};
