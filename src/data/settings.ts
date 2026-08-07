import { useCallback } from 'react';
import { client, guestClient, must, type AppSettings } from '../lib/amplify';
import { useAsync } from './useAsync';
import { useAuth } from '../auth/AuthProvider';
import { parseJsonArray, toJsonField } from '../../shared/domain';

/** The company profile is a single row so both clients can read it by a fixed id. */
export const SETTINGS_ID = 'GLOBAL';

export type CompanyProfile = {
  companyName: string;
  companyNameAr: string;
  tagline: string;
  taglineAr: string;
  about: string;
  aboutAr: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  addressAr: string;
  mapUrl: string;
  heroImageKeys: string[];
  workingHours: { day: string; hours: string }[];
};

/** Shown until an admin fills in the real details. */
export const FALLBACK_PROFILE: CompanyProfile = {
  companyName: 'Stars',
  companyNameAr: 'ستارز',
  tagline: 'Detailing · Polishing · Paint protection',
  taglineAr: 'تفصيل · تلميع · حماية طلاء',
  about:
    'Stars is a specialist vehicle care studio. Every job is tracked step by step, so you always know exactly where your car is in the process.',
  aboutAr:
    'ستارز استوديو متخصص بالعناية بالمركبات. نتابع كل خطوة من العمل حتى تعرف دائماً أين وصلت سيارتك بالضبط.',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  addressAr: '',
  mapUrl: '',
  heroImageKeys: [],
  workingHours: [],
};

const toProfile = (row: AppSettings | null): CompanyProfile => {
  if (!row) return FALLBACK_PROFILE;
  const hours = parseJsonArray<{ day: string; hours: string }>(row.workingHours);
  return {
    companyName: row.companyName || FALLBACK_PROFILE.companyName,
    companyNameAr: row.companyNameAr || FALLBACK_PROFILE.companyNameAr,
    tagline: row.tagline || FALLBACK_PROFILE.tagline,
    taglineAr: row.taglineAr || FALLBACK_PROFILE.taglineAr,
    about: row.about || FALLBACK_PROFILE.about,
    aboutAr: row.aboutAr || FALLBACK_PROFILE.aboutAr,
    phone: row.phone ?? '',
    whatsapp: row.whatsapp ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    addressAr: row.addressAr ?? '',
    mapUrl: row.mapUrl ?? '',
    heroImageKeys: (row.heroImageKeys ?? []).filter((key): key is string => !!key),
    workingHours: hours,
  };
};

export const useCompanyProfile = () => {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';

  const load = useCallback(async () => {
    const api = signedIn ? client : guestClient;
    const result = await api.models.AppSettings.get({ id: SETTINGS_ID });
    // A missing row is the expected state before an admin fills the form in.
    if (result.errors?.length) return FALLBACK_PROFILE;
    return toProfile(result.data ?? null);
  }, [signedIn]);

  return useAsync<CompanyProfile>(load, [signedIn, status], { enabled: status !== 'loading' });
};

export const saveCompanyProfile = async (profile: CompanyProfile) => {
  const payload = {
    id: SETTINGS_ID,
    companyName: profile.companyName.trim() || null,
    companyNameAr: profile.companyNameAr.trim() || null,
    tagline: profile.tagline.trim() || null,
    taglineAr: profile.taglineAr.trim() || null,
    about: profile.about.trim() || null,
    aboutAr: profile.aboutAr.trim() || null,
    phone: profile.phone.trim() || null,
    whatsapp: profile.whatsapp.trim() || null,
    email: profile.email.trim() || null,
    address: profile.address.trim() || null,
    addressAr: profile.addressAr.trim() || null,
    mapUrl: profile.mapUrl.trim() || null,
    heroImageKeys: profile.heroImageKeys,
    workingHours: toJsonField(profile.workingHours),
  };

  const existing = await client.models.AppSettings.get({ id: SETTINGS_ID });
  if (existing.data) {
    return must(await client.models.AppSettings.update(payload), 'update company profile');
  }
  return must(await client.models.AppSettings.create(payload), 'create company profile');
};
