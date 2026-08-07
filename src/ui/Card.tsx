import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { usePalette } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme/tokens';

export type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  elevation?: 0 | 1 | 2 | 3;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export const Card = ({
  children,
  onPress,
  padded = true,
  elevation = 1,
  style,
  accessibilityLabel,
}: CardProps) => {
  const palette = usePalette();

  const base: ViewStyle = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: padded ? spacing.lg : 0,
    overflow: 'hidden',
  };

  if (!onPress) {
    return <View style={[base, shadow(elevation, palette), style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        base,
        shadow(elevation, palette),
        pressed ? { opacity: 0.9, transform: [{ scale: 0.995 }] } : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

/** Thin divider that matches the card border in every theme. */
export const Divider = ({ style }: { style?: ViewStyle }) => {
  const palette = usePalette();
  return (
    <View
      style={[{ height: StyleSheet.hairlineWidth, backgroundColor: palette.border }, style]}
    />
  );
};
