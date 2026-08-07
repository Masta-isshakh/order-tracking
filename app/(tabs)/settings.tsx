import React from 'react';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { SettingsSection, SettingsRow } from '../../src/components/SettingsRows';
import { SettingsBody } from '../../src/components/SettingsShared';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useAuth } from '../../src/auth/AuthProvider';

export default function StorefrontSettings() {
  const router = useRouter();
  const { d } = useI18n();
  const { user } = useAuth();

  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  return (
    <Screen scroll>
      <Header title={d.settings.title} />
      <SettingsBody>
        {isStaff ? (
          <SettingsSection title={d.settings.workspace}>
            <SettingsRow
              icon="briefcase-outline"
              label={d.settings.openWorkspace}
              onPress={() => router.replace('/(staff)/orders')}
            />
          </SettingsSection>
        ) : null}
      </SettingsBody>
    </Screen>
  );
}
