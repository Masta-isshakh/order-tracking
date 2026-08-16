import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { usePalette } from '../theme/ThemeProvider';
import { radius, spacing, typography } from '../theme/tokens';
import { Text } from './Text';

const LENGTH = 6;

/**
 * Six-box code entry backed by a single hidden TextInput.
 *
 * Using one input (rather than six) is what makes iOS/Android SMS autofill work:
 * the OS pastes the whole code at once, and `oneTimeCode`/`sms-otp` only applies
 * to a single field.
 */
export const OtpField = ({
  value,
  onChange,
  onComplete,
  error,
  autoFocus = true,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  error?: string | null;
  autoFocus?: boolean;
  disabled?: boolean;
}) => {
  const palette = usePalette();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const shake = useSharedValue(0);
  const completedFor = useRef<string | null>(null);

  useEffect(() => {
    if (error) {
      shake.value = withSequence(
        withTiming(-8, { duration: 55 }),
        withTiming(8, { duration: 55 }),
        withTiming(-5, { duration: 55 }),
        withTiming(0, { duration: 55 }),
      );
    }
  }, [error, shake]);

  // Explicit `return`: the worklets Babel plugin cannot parse a concise arrow
  // body that returns an object literal.
  const shakeStyle = useAnimatedStyle(() => {
    return { transform: [{ translateX: shake.value }] };
  });

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, LENGTH);
    onChange(digits);
    // Auto-submit once, but allow a retry after the user edits the code again.
    if (digits.length === LENGTH && completedFor.current !== digits) {
      completedFor.current = digits;
      onComplete?.(digits);
    }
    if (digits.length < LENGTH) completedFor.current = null;
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="none"
        accessibilityLabel="Verification code"
        onPress={() => inputRef.current?.focus()}
        disabled={disabled}
      >
        <Animated.View style={[styles.boxes, shakeStyle]}>
          {Array.from({ length: LENGTH }).map((_, index) => {
            const char = value[index] ?? '';
            const isCursor = focused && index === Math.min(value.length, LENGTH - 1);
            const filled = !!char;
            return (
              <View
                key={index}
                style={[
                  styles.box,
                  {
                    backgroundColor: palette.surface,
                    borderColor: error
                      ? palette.danger
                      : isCursor
                        ? palette.primary
                        : filled
                          ? palette.borderStrong
                          : palette.border,
                    borderWidth: isCursor || error ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <Text style={[typography.title, { color: palette.text }]} align="center">
                  {char}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        editable={!disabled}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={LENGTH}
        caretHidden
        style={styles.hidden}
      />

      {error ? (
        <Text variant="caption" tone="danger" align="center">
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  boxes: {
    // Codes are numeric and always read left-to-right, so the row is not flipped.
    flexDirection: 'row',
    direction: 'ltr',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  box: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
