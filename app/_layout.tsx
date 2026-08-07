// Configures Amplify before any screen imports the data client.
import '../src/lib/amplify';

import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { I18nProvider, useI18n } from '../src/i18n/I18nProvider';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Holds the splash screen until the stored theme, language and Cognito session
 * are all resolved, so the first frame is never the wrong colour or language.
 */
const SplashGate = ({ children }: { children: React.ReactNode }) => {
  const { ready: themeReady } = useTheme();
  const { ready: localeReady } = useI18n();
  const { status } = useAuth();

  const ready = themeReady && localeReady && status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  return <>{children}</>;
};

const Navigator = () => {
  const { palette } = useTheme();

  return (
    <Stack
      screenOptions={{
        // Headers are rendered inside each screen so they can follow the palette
        // and flip for Arabic.
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(staff)" />
      <Stack.Screen name="auth/phone" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="auth/verify" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <SplashGate>
                <Navigator />
              </SplashGate>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
