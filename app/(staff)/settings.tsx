import React from 'react';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { SettingsSection, SettingsRow } from '../../src/components/SettingsRows';
import { SettingsBody } from '../../src/components/SettingsShared';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useAuth } from '../../src/auth/AuthProvider';

export default function StaffSettings() {
  const router = useRouter();
  const { d } = useI18n();
  const { user } = useAuth();

  return (
    <Screen scroll>
      <Header title={d.settings.title} />
      <SettingsBody>
        <SettingsSection title={d.settings.workspace}>
          {user?.role === 'ADMIN' ? (
            <SettingsRow
              icon="business-outline"
              label={d.settings.company}
              value={d.settings.companyHint}
              onPress={() => router.push('/staff/company')}
            />
          ) : null}
          <SettingsRow
            icon="storefront-outline"
            label={d.settings.storefront}
            onPress={() => router.replace('/(tabs)/home')}
          />
        </SettingsSection>
      </SettingsBody>
    </Screen>
  );
}
