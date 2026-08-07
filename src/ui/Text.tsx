import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { typography, type TypographyVariant } from '../theme/tokens';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  /** Semantic colour; defaults to the palette's primary text colour. */
  tone?: 'default' | 'muted' | 'faint' | 'primary' | 'success' | 'warning' | 'danger' | 'inverse';
  color?: string;
  align?: 'start' | 'center' | 'end';
  weight?: TextStyle['fontWeight'];
};

/**
 * Every string in the app goes through here so that colour, size and — critically —
 * writing direction stay consistent when the user switches to Arabic.
 */
export const Text = ({
  variant = 'body',
  tone = 'default',
  color,
  align = 'start',
  weight,
  style,
  ...rest
}: TextProps) => {
  const palette = usePalette();
  const { isRTL } = useI18n();

  const toneColor = {
    default: palette.text,
    muted: palette.textMuted,
    faint: palette.textFaint,
    primary: palette.primary,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    inverse: palette.onPrimary,
  }[tone];

  const startAlign = isRTL ? 'right' : 'left';
  const endAlign = isRTL ? 'left' : 'right';
  const textAlign = align === 'center' ? 'center' : align === 'end' ? endAlign : startAlign;

  return (
    <RNText
      {...rest}
      style={[
        typography[variant] as TextStyle,
        { color: color ?? toneColor, textAlign, writingDirection: isRTL ? 'rtl' : 'ltr' },
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
};
