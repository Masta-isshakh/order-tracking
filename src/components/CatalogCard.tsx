import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n, useLocalizedName } from '../i18n/I18nProvider';
import { radius, shadow, spacing } from '../theme/tokens';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { StorageImage } from '../ui/StorageImage';
import { parseJsonArray, type StepTemplate } from '../../shared/domain';

export type CatalogCardItem = {
  id: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  price?: number | null;
  currency?: string | null;
  imageKey?: string | null;
  durationMinutes?: number | null;
  isActive?: boolean | null;
  steps?: unknown;
};

/**
 * One service or package. Used on the public Home and Book tabs and in the staff
 * catalog, so it takes selection state and an optional edit affordance.
 */
export const CatalogCard = ({
  item,
  selected = false,
  onPress,
  onEdit,
  showStepCount = true,
  compact = false,
}: {
  item: CatalogCardItem;
  selected?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  showStepCount?: boolean;
  compact?: boolean;
}) => {
  const palette = usePalette();
  const { d, formatMoney } = useI18n();
  const localized = useLocalizedName();

  const stepCount = parseJsonArray<StepTemplate>(item.steps).length;
  const hidden = item.isActive === false;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: selected ? palette.primary : palette.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.94 : hidden ? 0.6 : 1,
        },
        shadow(1, palette),
      ]}
    >
      <StorageImage
        storageKey={item.imageKey}
        style={compact ? styles.imageCompact : styles.image}
        placeholderIcon="car-sport-outline"
        rounded={radius.md}
      />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="subheading" numberOfLines={2} style={styles.grow}>
            {localized(item.name, item.nameAr)}
          </Text>
          {selected ? (
            <Ionicons name="checkmark-circle" size={22} color={palette.primary} />
          ) : null}
        </View>

        {!compact && (item.description || item.descriptionAr) ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {localized(item.description, item.descriptionAr)}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          {item.price !== null && item.price !== undefined ? (
            <Text variant="bodyStrong" tone="primary">
              {formatMoney(item.price, item.currency ?? undefined)}
            </Text>
          ) : null}

          {showStepCount && stepCount > 0 ? (
            <Badge label={`${stepCount} ${d.catalog.steps}`} tone="neutral" icon="git-commit-outline" />
          ) : null}

          {item.durationMinutes ? (
            <Badge label={`${item.durationMinutes}m`} tone="neutral" icon="time-outline" />
          ) : null}

          {hidden ? <Badge label={d.common.inactive} tone="warning" icon="eye-off-outline" /> : null}
        </View>
      </View>

      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={d.common.edit}
          style={[styles.editButton, { backgroundColor: palette.surfaceAlt }]}
        >
          <Ionicons name="create-outline" size={17} color={palette.text} />
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  image: { width: 88, height: 88 },
  imageCompact: { width: 60, height: 60 },
  body: { flex: 1, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
