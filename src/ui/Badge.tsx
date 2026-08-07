import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import type { OrderStatus, StepStatus } from '../../shared/domain';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export const Badge = ({
  label,
  tone = 'neutral',
  icon,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}) => {
  const palette = usePalette();

  const tones: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: palette.surfaceAlt, fg: palette.textMuted },
    primary: { bg: palette.primarySoft, fg: palette.primary },
    success: { bg: palette.successSoft, fg: palette.success },
    warning: { bg: palette.warningSoft, fg: palette.warning },
    danger: { bg: palette.dangerSoft, fg: palette.danger },
    info: { bg: palette.infoSoft, fg: palette.info },
  };
  const colors = tones[tone];

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={colors.fg} /> : null}
      <Text variant="micro" color={colors.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const ORDER_TONE: Record<OrderStatus, BadgeTone> = {
  NEW: 'info',
  SCHEDULED: 'primary',
  IN_PROGRESS: 'primary',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const ORDER_ICON: Record<OrderStatus, keyof typeof Ionicons.glyphMap> = {
  NEW: 'sparkles',
  SCHEDULED: 'calendar-outline',
  IN_PROGRESS: 'time-outline',
  ON_HOLD: 'pause-circle-outline',
  COMPLETED: 'checkmark-circle',
  CANCELLED: 'close-circle-outline',
};

/** Status pill that reads the same across every workspace. */
export const OrderStatusBadge = ({ status, style }: { status: string; style?: ViewStyle }) => {
  const { d } = useI18n();
  const key = (status in ORDER_TONE ? status : 'NEW') as OrderStatus;
  return (
    <Badge label={d.status[key]} tone={ORDER_TONE[key]} icon={ORDER_ICON[key]} style={style} />
  );
};

const STEP_TONE: Record<StepStatus, BadgeTone> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  SKIPPED: 'neutral',
};

export const StepStatusBadge = ({ status, style }: { status: string; style?: ViewStyle }) => {
  const { d } = useI18n();
  const key = (status in STEP_TONE ? status : 'PENDING') as StepStatus;
  return <Badge label={d.stepStatus[key]} tone={STEP_TONE[key]} style={style} />;
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
