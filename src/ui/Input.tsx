import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { radius, spacing, typography } from '../theme/tokens';
import { Text } from './Text';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: ViewStyle;
  /** Renders a taller multiline box. */
  multilineRows?: number;
};

export const Input = ({
  label,
  hint,
  error,
  required,
  icon,
  containerStyle,
  multilineRows,
  ...rest
}: InputProps) => {
  const palette = usePalette();
  const { isRTL, d } = useI18n();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? palette.danger : focused ? palette.primary : palette.border;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="caption" tone="muted">
            {label}
          </Text>
          {required ? (
            <Text variant="caption" tone="danger">
              *
            </Text>
          ) : (
            <Text variant="micro" tone="faint">
              {d.common.optional}
            </Text>
          )}
        </View>
      ) : null}

      <View
        style={[
          styles.field,
          {
            backgroundColor: palette.surface,
            borderColor,
            borderWidth: focused || error ? 2 : StyleSheet.hairlineWidth,
            // Keep the box height stable when the border thickens on focus.
            paddingHorizontal: focused || error ? spacing.md - 1 : spacing.md,
            minHeight: multilineRows ? 22 * multilineRows + spacing.lg : 50,
            alignItems: multilineRows ? 'flex-start' : 'center',
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? palette.primary : palette.textFaint}
            style={{ marginTop: multilineRows ? spacing.md : 0 }}
          />
        ) : null}
        <TextInput
          {...rest}
          multiline={!!multilineRows || rest.multiline}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={palette.textFaint}
          selectionColor={palette.primary}
          keyboardAppearance={palette.mode === 'dark' ? 'dark' : 'light'}
          style={[
            styles.input,
            typography.body,
            {
              color: palette.text,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
              paddingVertical: multilineRows ? spacing.md : 0,
              textAlignVertical: multilineRows ? 'top' : 'center',
            },
          ]}
        />
      </View>

      {error ? (
        <Text variant="micro" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="micro" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
  },
  input: { flex: 1, padding: 0 },
});
