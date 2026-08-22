import { StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../theme/tokens';

/**
 * Room for an icon and its label. The system's bottom inset is added on top of
 * this, never taken out of it.
 */
const CONTENT_HEIGHT = 56;

/**
 * The tab bar's geometry, derived from the real safe-area inset.
 *
 * It has to be computed rather than hard-coded, because React Navigation treats
 * a numeric `height` in `tabBarStyle` as the *total* bar height and stops adding
 * the inset itself (see `getTabBarHeight`), and a `paddingBottom` in the same
 * style overrides the inset padding it would otherwise apply. Hard-coding both —
 * as this app used to — therefore lays the icons out inside the strip the system
 * reserves for its own gesture bar.
 *
 * That is invisible on an Android phone with three-button navigation, where the
 * inset is 0, and badly wrong on any gesture-navigation device, where it is
 * 24–48dp. Android 16 (targetSdk 36) draws every app edge-to-edge with no
 * opt-out, so this is now the default case rather than the exception.
 *
 * The same formula covers iOS: 34pt on a device with a home indicator, 0 on the
 * SE, instead of assuming every iPhone is notched.
 */
export const useTabBarStyle = (palette: Palette): ViewStyle => {
  const insets = useSafeAreaInsets();

  return {
    backgroundColor: palette.surface,
    borderTopColor: palette.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: CONTENT_HEIGHT + insets.bottom,
    paddingTop: 6,
    paddingBottom: insets.bottom,
  };
};
