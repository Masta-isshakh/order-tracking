import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { OtpField } from '../../src/ui/OtpField';
import { Notice } from '../../src/ui/Feedback';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { AuthError, useAuth, type AuthErrorCode } from '../../src/auth/AuthProvider';
import { authErrorMessage, requiresRestart } from '../../src/auth/messages';
import { radius, spacing } from '../../src/theme/tokens';

/** Matches RESEND_COOLDOWN_SECONDS on the createAuthChallenge Lambda. */
const RESEND_SECONDS = 45;

/** Step 2 of sign-in: verify the SMS code, then route by role. */
export default function VerifyScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d, t } = useI18n();
  const { challenge, submitCode, startSignIn, cancelSignIn } = useAuth();
  const params = useLocalSearchParams<{ phone?: string; next?: string }>();

  const phone = challenge?.phone ?? params.phone ?? '';
  const destination = challenge?.destination ?? phone;

  const [code, setCode] = useState('');
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const verifying = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const dead = errorCode !== null && requiresRestart(errorCode);

  const verify = useCallback(
    async (value: string) => {
      // OtpField auto-submits on the sixth digit; this guard stops a manual tap
      // from firing a second RespondToAuthChallenge against the same session.
      if (verifying.current) return;
      verifying.current = true;
      setBusy(true);
      setErrorCode(null);

      try {
        const user = await submitCode(value);

        // Role decides the destination. Staff land in their workspace; customers
        // return to the storefront, where the Track tab is now unlocked.
        if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') {
          router.replace('/(staff)/orders');
        } else if (params.next) {
          router.replace(params.next as never);
        } else {
          router.replace('/(tabs)/track');
        }
      } catch (err) {
        const code = err instanceof AuthError ? err.code : 'GENERIC';
        setErrorCode(code);
        setCode('');
        // A dead challenge cannot be retried, so free the resend button at once.
        if (requiresRestart(code)) setCooldown(0);
      } finally {
        verifying.current = false;
        setBusy(false);
      }
    },
    [submitCode, router, params.next],
  );

  const resend = async () => {
    if (cooldown > 0 || busy || !phone) return;
    setBusy(true);
    setErrorCode(null);
    setCode('');
    try {
      await startSignIn(phone);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setErrorCode(err instanceof AuthError ? err.code : 'GENERIC');
    } finally {
      setBusy(false);
    }
  };

  const changeNumber = () => {
    cancelSignIn();
    router.back();
  };

  return (
    <Screen scroll>
      <Header title={d.auth.verifyTitle} showBack onBack={changeNumber} />

      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: palette.successSoft }]}>
          <Ionicons name="shield-checkmark" size={26} color={palette.success} />
        </View>

        <Text variant="body" tone="muted">
          {t(d.auth.verifySubtitle, { phone: destination })}
        </Text>

        {/* DEV mode only: the backend sent no SMS and handed the code back.
            Deliberately loud — this build has no real sign-in security. */}
        {challenge?.devCode ? (
          <Notice
            tone="danger"
            icon="warning-outline"
            title={`DEV MODE — no SMS sent. Code: ${challenge.devCode}`}
            body="Sign-in is unauthenticated in this build: anyone who knows a registered number can sign in as them. Never ship it."
          />
        ) : null}

        <OtpField
          value={code}
          onChange={(next) => {
            setCode(next);
            if (errorCode) setErrorCode(null);
          }}
          onComplete={verify}
          error={errorCode && !dead ? authErrorMessage(errorCode, d) : null}
          disabled={busy}
        />

        {dead && errorCode ? (
          <Notice
            tone="warning"
            icon="refresh-outline"
            title={authErrorMessage(errorCode, d)}
            body={d.auth.resendCode}
          />
        ) : null}

        <Button
          label={busy ? d.auth.verifying : d.auth.verify}
          onPress={() => verify(code)}
          loading={busy}
          disabled={code.length !== 6 || dead}
          size="lg"
          full
        />

        <View style={styles.footer}>
          <Pressable onPress={resend} disabled={cooldown > 0 || busy} hitSlop={8}>
            <Text variant="caption" tone={cooldown > 0 ? 'faint' : 'primary'}>
              {cooldown > 0 ? t(d.auth.resendIn, { seconds: cooldown }) : d.auth.resendCode}
            </Text>
          </Pressable>

          <Pressable onPress={changeNumber} hitSlop={8}>
            <Text variant="caption" tone="muted">
              {d.auth.changeNumber}
            </Text>
          </Pressable>
        </View>
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
});
