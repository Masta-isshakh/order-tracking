import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { PhoneField, type PhoneFieldValue } from '../../src/ui/PhoneField';
import { EmptyState, Notice } from '../../src/ui/Feedback';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { AuthError, useAuth } from '../../src/auth/AuthProvider';
import { DEFAULT_COUNTRY, isLocalComplete, toE164 } from '../../src/lib/phone';
import { radius, spacing } from '../../src/theme/tokens';
import { authErrorMessage } from '../../src/auth/messages';

/**
 * Step 1 of sign-in: collect the number.
 *
 * What happens next depends on the backend. With a real provider it texts a
 * code and moves to the verify screen; in no-verification mode the number alone
 * signs the user in and this screen sends them straight to their workspace.
 * The screen does not need to know which — `startSignIn` reports the outcome.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d } = useI18n();
  const { startSignIn } = useAuth();
  const params = useLocalSearchParams<{ next?: string }>();

  const [value, setValue] = useState<PhoneFieldValue>({ country: DEFAULT_COUNTRY, local: '' });
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const complete = isLocalComplete(value.local, value.country);

  const goToWorkspace = (role: string) => {
    if (role === 'ADMIN' || role === 'SUPERVISOR') {
      router.replace('/(staff)/orders');
    } else if (params.next) {
      router.replace(params.next as never);
    } else {
      router.replace('/(tabs)/track');
    }
  };

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
      const result = await startSignIn(e164);

      if (result.kind === 'SIGNED_IN') {
        goToWorkspace(result.user.role);
        return;
      }

      router.push({
        pathname: '/auth/verify',
        params: { phone: e164, next: params.next ?? '' },
      });
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'GENERIC';
      // An unregistered number is the normal case for someone who has never
      // used the workshop, not an error worth a red banner.
      if (code === 'NOT_REGISTERED') setNotFound(true);
      else setError(authErrorMessage(code, d));
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <Screen scroll>
        <Header title={d.tabs.track} showBack />
        <EmptyState
          icon="search-outline"
          title={d.auth.notFoundTitle}
          body={d.auth.notFoundBody}
          actionLabel={d.auth.notFoundRetry}
          onAction={() => {
            setNotFound(false);
            setValue({ country: value.country, local: '' });
          }}
        />
        <Button
          label={d.track.emptyAction}
          variant="ghost"
          full
          onPress={() => router.replace('/(tabs)/book')}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title={d.auth.continueTitle} showBack />

      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: palette.primarySoft }]}>
          <Ionicons name="phone-portrait-outline" size={26} color={palette.primary} />
        </View>

        <Text variant="body" tone="muted">
          {d.auth.continueSubtitle}
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
          label={busy ? d.common.loading : d.auth.continueAction}
          onPress={submit}
          loading={busy}
          disabled={!complete}
          size="lg"
          full
          icon="arrow-forward"
          iconPosition="end"
        />
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
