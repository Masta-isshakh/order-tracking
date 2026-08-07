import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { PALETTES, type Palette, type ThemeName } from './tokens';
import { readPref, writePref } from '../lib/prefs';

export type ThemePreference = ThemeName | 'system';

type ThemeContextValue = {
  palette: Palette;
  /** What the user picked, which may be "system". */
  preference: ThemePreference;
  /** What that resolves to right now. */
  resolved: ThemeName;
  setPreference: (next: ThemePreference) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark' || value === 'ocean' || value === 'sand';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readPref('theme').then((stored) => {
      if (cancelled) return;
      if (isThemePreference(stored)) setPreferenceState(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved: ThemeName =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const palette = PALETTES[resolved];

  // Paints the window behind React so rotation and keyboard gaps never flash white.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.bg).catch(() => {});
  }, [palette.bg]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void writePref('theme', next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ palette, preference, resolved, setPreference, ready }),
    [palette, preference, resolved, setPreference, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};

/** Shorthand for the common case of only needing colours. */
export const usePalette = (): Palette => useTheme().palette;
