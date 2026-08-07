import React from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Text } from '../ui/Text';
import { SettingsSection, SettingsRow, ChoiceRow } from './SettingsRows';
import { usePalette, useTheme, type ThemePreference } from '../theme/ThemeProvider';
import { useI18n, type Locale } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { PALETTES, THEME_ORDER } from '../theme/tokens';
import { prettyPhone } from '../lib/phone';
import { spacing } from '../theme/tokens';

/**
 * Appearance, language, account and about — identical in every workspace, so
 * both the storefront and the staff Settings tabs render this.
 */
export const SettingsBody = ({ children }: { children?: React.ReactNode }) => {
  const router = useRouter();
  const palette = usePalette();
  const { d, locale, setLocale } = useI18n();
  const { preference, setPreference } = useTheme();
  const { user, status, signOut } = useAuth();

  const themeLabels: Record<ThemePreference, string> = {
    system: d.common.all,
    light: d.settings.themeLight,
    dark: d.settings.themeDark,
    ocean: d.settings.themeOcean,
    sand: d.settings.themeSand,
  };

  const roleLabel = user
    ? {
        ADMIN: d.settings.roleAdmin,
        SUPERVISOR: d.settings.roleSupervisor,
        CUSTOMER: d.settings.roleCustomer,
      }[user.role]
    : undefined;

  const confirmSignOut = () => {
    Alert.alert(d.auth.signOutTitle, d.auth.signOutMessage, [
      { text: d.common.cancel, style: 'cancel' },
      {
        text: d.auth.signOut,
        style: 'destructive',
        onPress: () => {
          void signOut().then(() => router.replace('/(tabs)/home'));
        },
      },
    ]);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={styles.body}>
      <SettingsSection title={d.settings.appearance}>
        <ChoiceRow<ThemePreference>
          options={[
            { value: 'system', label: themeLabels.system },
            ...THEME_ORDER.map((name) => ({
              value: name as ThemePreference,
              label: themeLabels[name],
              swatch: [PALETTES[name].bg, PALETTES[name].primary, PALETTES[name].accent],
            })),
          ]}
          value={preference}
          onChange={setPreference}
        />
      </SettingsSection>

      <SettingsSection title={d.settings.language}>
        <ChoiceRow<Locale>
          options={[
            { value: 'en', label: d.settings.english },
            { value: 'ar', label: d.settings.arabic },
          ]}
          value={locale}
          onChange={setLocale}
        />
      </SettingsSection>

      {children}

      <SettingsSection title={d.settings.account}>
        {status === 'signedIn' && user ? (
          <>
            <SettingsRow icon="person-circle-outline" label={user.name || d.settings.account} />
            <SettingsRow icon="call-outline" label={d.auth.phoneLabel} value={prettyPhone(user.phone)} />
            {roleLabel ? (
              <SettingsRow icon="ribbon-outline" label={d.settings.role} value={roleLabel} />
            ) : null}
            <SettingsRow
              icon="log-out-outline"
              label={d.auth.signOut}
              onPress={confirmSignOut}
              destructive
            />
          </>
        ) : (
          <SettingsRow
            icon="log-in-outline"
            label={d.auth.gateAction}
            onPress={() => router.push('/auth/phone')}
          />
        )}
      </SettingsSection>

      <SettingsSection title={d.settings.about}>
        <SettingsRow icon="information-circle-outline" label={d.settings.version} value={version} />
        <SettingsRow
          icon="shield-checkmark-outline"
          label={d.settings.privacy}
          onPress={() => Linking.openURL('https://stars.qa/privacy').catch(() => {})}
        />
        <SettingsRow
          icon="document-text-outline"
          label={d.settings.terms}
          onPress={() => Linking.openURL('https://stars.qa/terms').catch(() => {})}
        />
      </SettingsSection>

      <Text variant="micro" tone="faint" align="center" style={styles.footer}>
        {d.common.appName} · {version}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  body: { gap: spacing.xl, paddingBottom: spacing.xl },
  footer: { paddingTop: spacing.sm },
});
