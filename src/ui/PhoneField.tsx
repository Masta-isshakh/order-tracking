import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { radius, shadow, spacing, typography } from '../theme/tokens';
import { Text } from './Text';
import { COUNTRIES, type Country, formatLocalDigits, isLocalComplete } from '../lib/phone';

export type PhoneFieldValue = { country: Country; local: string };

/**
 * Country selector plus a local-number field.
 *
 * The two parts are kept separate rather than parsing one free-text field: it
 * removes every "did they type the country code or not?" ambiguity, which is the
 * usual reason an OTP is sent to the wrong number.
 */
export const PhoneField = ({
  value,
  onChange,
  label,
  error,
  autoFocus,
  editable = true,
  onSubmitEditing,
}: {
  value: PhoneFieldValue;
  onChange: (next: PhoneFieldValue) => void;
  label?: string;
  error?: string | null;
  autoFocus?: boolean;
  editable?: boolean;
  onSubmitEditing?: () => void;
}) => {
  const palette = usePalette();
  const { isRTL, d } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const complete = useMemo(() => isLocalComplete(value.local, value.country), [value]);
  const borderColor = error ? palette.danger : focused ? palette.primary : palette.border;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.row,
          {
            backgroundColor: palette.surface,
            borderColor,
            borderWidth: focused || error ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`+${value.country.dial}`}
          onPress={() => editable && setPickerOpen(true)}
          style={[styles.country, { borderColor: palette.border }]}
        >
          <Text variant="body">{value.country.flag}</Text>
          <Text variant="bodyStrong">+{value.country.dial}</Text>
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color={palette.textFaint}
          />
        </Pressable>

        <TextInput
          value={formatLocalDigits(value.local, value.country)}
          onChangeText={(text) =>
            onChange({
              ...value,
              local: text.replace(/\D/g, '').slice(0, value.country.digits),
            })
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          autoFocus={autoFocus}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          returnKeyType="done"
          placeholder={value.country.sample}
          placeholderTextColor={palette.textFaint}
          selectionColor={palette.primary}
          keyboardAppearance={palette.mode === 'dark' ? 'dark' : 'light'}
          maxLength={value.country.digits + 3}
          style={[
            styles.input,
            typography.subheading,
            {
              color: palette.text,
              // Phone numbers are always read left-to-right, even in Arabic.
              textAlign: 'left',
              writingDirection: 'ltr',
            },
          ]}
        />

        {complete ? (
          <Ionicons name="checkmark-circle" size={20} color={palette.success} />
        ) : null}
      </View>

      {error ? (
        <Text variant="micro" tone="danger">
          {error}
        </Text>
      ) : null}

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={[styles.backdrop, { backgroundColor: palette.overlay }]} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: palette.surface, direction: isRTL ? 'rtl' : 'ltr' },
              shadow(3, palette),
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.grabber, { backgroundColor: palette.borderStrong }]} />
            <ScrollView>
              {COUNTRIES.map((country) => {
                const selected = country.code === value.country.code;
                return (
                  <Pressable
                    key={country.code}
                    onPress={() => {
                      onChange({ country, local: '' });
                      setPickerOpen(false);
                    }}
                    style={[
                      styles.countryRow,
                      { backgroundColor: selected ? palette.primarySoft : 'transparent' },
                    ]}
                  >
                    <Text variant="heading">{country.flag}</Text>
                    <Text variant="body" style={styles.grow}>
                      {country.code}
                    </Text>
                    <Text variant="bodyStrong" tone={selected ? 'primary' : 'muted'}>
                      +{country.dial}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setPickerOpen(false)} style={styles.close}>
              <Text variant="bodyStrong" tone="primary" align="center">
                {d.common.close}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingEnd: spacing.md,
    minHeight: 54,
  },
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderEndWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 0 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '62%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginVertical: spacing.md,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  grow: { flex: 1 },
  close: { padding: spacing.lg },
});
