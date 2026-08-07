import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { PhoneField, type PhoneFieldValue } from '../../src/ui/PhoneField';
import { Notice } from '../../src/ui/Feedback';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { AuthError, useAuth } from '../../src/auth/AuthProvider';
import { DEFAULT_COUNTRY, isLocalComplete, toE164 } from '../../src/lib/phone';
import { radius, spacing } from '../../src/theme/tokens';
import { authErrorMessage } from '../../src/auth/messages';

/** Step 1 of sign-in: collect the number and ask the backend to text a code. */
export default function PhoneScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d } = useI18n();
  const { startSignIn } = useAuth();
  const params = useLocalSearchParams<{ next?: string }>();

  const [value, setValue] = useState<PhoneFieldValue>({ country: DEFAULT_COUNTRY, local: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const complete = isLocalComplete(value.local, value.country);

  const submit = async () => {
    if (busy) return;
    const e164 = toE164(value.local, value.country);
    if (!e164) {
      setError(d.auth.errors.invalidPhone);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await startSignIn(e164);
      router.push({
        pathname: '/auth/verify',
        params: { phone: e164, next: params.next ?? '' },
      });
    } catch (err) {
      setError(authErrorMessage(err instanceof AuthError ? err.code : 'GENERIC', d));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Header title={d.auth.phoneTitle} showBack />

      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
          <Ionicons name="chatbubble-ellipses" size={26} color={palette.primary} />
        </View>

        <Text variant="body" tone="muted">
          {d.auth.phoneSubtitle}
        </Text>

        <PhoneField
          value={value}
          onChange={(next) => {
            setValue(next);
            if (error) setError(null);
          }}
          label={d.auth.phoneLabel}
          autoFocus
          onSubmitEditing={() => complete && void submit()}
        />

        {error ? <Notice tone="danger" icon="alert-circle-outline" title={error} /> : null}

        <Button
          label={busy ? d.auth.sending : d.auth.sendCode}
          onPress={submit}
          loading={busy}
          disabled={!complete}
          size="lg"
          full
          icon="arrow-forward"
          iconPosition="end"
        />

        <Text variant="micro" tone="faint" align="center">
          {d.team.phoneHint}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingTop: spacing.md },
  badge: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
