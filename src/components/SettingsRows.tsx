import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { radius, spacing } from '../theme/tokens';
import { Text } from '../ui/Text';

export const SettingsSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const palette = usePalette();
  return (
    <View style={styles.section}>
      <Text variant="micro" tone="faint">
        {title.toUpperCase()}
      </Text>
      <View
        style={[styles.group, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        {children}
      </View>
    </View>
  );
};

export const SettingsRow = ({
  icon,
  label,
  value,
  onPress,
  destructive = false,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: React.ReactNode;
}) => {
  const palette = usePalette();
  const { isRTL } = useI18n();
  const tint = destructive ? palette.danger : palette.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: palette.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: destructive ? palette.dangerSoft : palette.surfaceAlt },
        ]}
      >
        <Ionicons name={icon} size={17} color={destructive ? palette.danger : palette.textMuted} />
      </View>

      <Text variant="body" color={tint} style={styles.grow} numberOfLines={1}>
        {label}
      </Text>

      {value ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {value}
        </Text>
      ) : null}

      {right}

      {onPress && !right ? (
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={palette.textFaint}
        />
      ) : null}
    </Pressable>
  );
};

export const SettingsToggle = ({
  icon,
  label,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) => {
  const palette = usePalette();
  return (
    <SettingsRow
      icon={icon}
      label={label}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: palette.borderStrong, true: palette.primary }}
          thumbColor="#FFFFFF"
        />
      }
    />
  );
};

/** Horizontal chip picker used for theme and language. */
export const ChoiceRow = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; swatch?: string[] }[];
  value: T;
  onChange: (next: T) => void;
}) => {
  const palette = usePalette();
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.choice,
              {
                backgroundColor: selected ? palette.primarySoft : palette.surfaceAlt,
                borderColor: selected ? palette.primary : 'transparent',
              },
            ]}
          >
            {option.swatch ? (
              <View style={styles.swatch}>
                {option.swatch.map((color, index) => (
                  <View
                    key={`${option.value}-${index}`}
                    style={[styles.swatchDot, { backgroundColor: color }]}
                  />
                ))}
              </View>
            ) : null}
            <Text variant="caption" tone={selected ? 'primary' : 'muted'} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  group: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
  choice: {
    flexGrow: 1,
    minWidth: 92,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  swatch: { flexDirection: 'row', gap: 3 },
  swatchDot: { width: 12, height: 12, borderRadius: radius.pill },
});
