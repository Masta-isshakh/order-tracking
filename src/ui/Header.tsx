import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { radius, spacing } from '../theme/tokens';
import { Text } from './Text';

export type HeaderAction = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  tone?: 'default' | 'primary' | 'danger';
};

/**
 * In-screen header. Expo Router's native header is disabled app-wide so that
 * titles, back arrows and actions follow the palette and flip for Arabic.
 */
export const Header = ({
  title,
  subtitle,
  onBack,
  showBack = false,
  actions = [],
  style,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  actions?: HeaderAction[];
  style?: ViewStyle;
}) => {
  const palette = usePalette();
  const { isRTL } = useI18n();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={[styles.root, style]}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={handleBack}
          hitSlop={10}
          style={[styles.iconButton, { backgroundColor: palette.surfaceAlt }]}
        >
          <Ionicons
            name={isRTL ? 'chevron-forward' : 'chevron-back'}
            size={20}
            color={palette.text}
          />
        </Pressable>
      ) : null}

      <View style={styles.titles}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={8}
          style={[
            styles.iconButton,
            {
              backgroundColor:
                action.tone === 'primary'
                  ? palette.primary
                  : action.tone === 'danger'
                    ? palette.dangerSoft
                    : palette.surfaceAlt,
            },
          ]}
        >
          <Ionicons
            name={action.icon}
            size={19}
            color={
              action.tone === 'primary'
                ? palette.onPrimary
                : action.tone === 'danger'
                  ? palette.danger
                  : palette.text
            }
          />
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  titles: { flex: 1, gap: 1 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
