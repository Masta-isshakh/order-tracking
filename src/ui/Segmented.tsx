import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePalette } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Badge } from './Badge';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Optional count pill, e.g. the number of new orders. */
  count?: number;
};

/**
 * Horizontal tab strip used for the order buckets and the catalog switcher.
 * Scrolls when the labels do not fit, which matters a lot in Arabic.
 */
export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  scrollable = true,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  scrollable?: boolean;
}) => {
  const palette = usePalette();

  const items = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        onPress={() => {
          if (selected) return;
          Haptics.selectionAsync().catch(() => {});
          onChange(option.value);
        }}
        style={[
          styles.item,
          {
            backgroundColor: selected ? palette.surface : 'transparent',
            borderColor: selected ? palette.border : 'transparent',
          },
          scrollable ? null : styles.flexItem,
        ]}
      >
        <Text variant="caption" tone={selected ? 'default' : 'muted'} numberOfLines={1}>
          {option.label}
        </Text>
        {option.count !== undefined && option.count > 0 ? (
          <Badge label={String(option.count)} tone={selected ? 'primary' : 'neutral'} />
        ) : null}
      </Pressable>
    );
  });

  const container = (
    <View
      style={[
        styles.track,
        { backgroundColor: palette.surfaceAlt },
        scrollable ? null : styles.trackFixed,
      ]}
    >
      {items}
    </View>
  );

  if (!scrollable) return container;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {container}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  trackFixed: { alignSelf: 'stretch' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flexItem: { flex: 1, justifyContent: 'center' },
});
