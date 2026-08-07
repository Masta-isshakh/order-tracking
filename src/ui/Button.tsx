import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'start' | 'end';
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: ViewStyle;
  /** Fires a light haptic tap. On by default for primary actions. */
  haptic?: boolean;
};

const HEIGHTS: Record<Size, number> = { sm: 38, md: 48, lg: 54 };

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  loading = false,
  disabled = false,
  full = false,
  style,
  haptic = variant === 'primary',
}: ButtonProps) => {
  const palette = usePalette();
  const isDisabled = disabled || loading;

  const colors: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: palette.primary, fg: palette.onPrimary, border: palette.primary },
    secondary: { bg: palette.surfaceAlt, fg: palette.text, border: palette.border },
    ghost: { bg: 'transparent', fg: palette.primary, border: 'transparent' },
    danger: { bg: palette.danger, fg: '#FFFFFF', border: palette.danger },
    success: { bg: palette.success, fg: '#FFFFFF', border: palette.success },
  };
  const tone = colors[variant];

  const handlePress = () => {
    if (isDisabled || !onPress) return;
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const content = (
    <>
      {icon && iconPosition === 'start' && !loading ? (
        <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={tone.fg} />
      ) : null}
      {loading ? <ActivityIndicator size="small" color={tone.fg} /> : null}
      <Text
        variant={size === 'sm' ? 'caption' : 'bodyStrong'}
        color={tone.fg}
        align="center"
        numberOfLines={1}
      >
        {label}
      </Text>
      {icon && iconPosition === 'end' && !loading ? (
        <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={tone.fg} />
      ) : null}
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          backgroundColor: tone.bg,
          borderColor: tone.border,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
        variant === 'primary' || variant === 'danger' || variant === 'success'
          ? shadow(1, palette)
          : null,
        full ? styles.full : null,
        style,
      ]}
    >
      <View style={styles.row}>{content}</View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
