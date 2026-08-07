import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { radius, spacing } from '../theme/tokens';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { OrderStatusBadge } from '../ui/Badge';
import { ProgressBar } from '../ui/Roadmap';
import { prettyPhone } from '../lib/phone';
import type { Order } from '../lib/amplify';

const vehicleLine = (order: Order): string =>
  [order.vehicleMake, order.vehicleModel, order.vehicleYear].filter(Boolean).join(' ');

/**
 * One row in any order list. Shows who, what vehicle, and how far along —
 * the three things staff and customers both scan for.
 */
export const OrderCard = ({
  order,
  onPress,
  showCustomer = true,
}: {
  order: Order;
  onPress: () => void;
  showCustomer?: boolean;
}) => {
  const palette = usePalette();
  const { d, t, formatMoney, formatRelative } = useI18n();

  const total = order.totalStepCount ?? 0;
  const done = order.completedStepCount ?? 0;
  const vehicle = vehicleLine(order);
  const onHold = order.status === 'ON_HOLD';
  const complete = order.status === 'COMPLETED';

  return (
    <Card onPress={onPress} accessibilityLabel={`${d.track.orderNumber} ${order.orderNumber}`}>
      <View style={styles.headerRow}>
        <View style={styles.grow}>
          <Text variant="micro" tone="faint">
            {order.orderNumber}
          </Text>
          <Text variant="subheading" numberOfLines={1}>
            {showCustomer ? order.customerName : vehicle || d.track.vehicle}
          </Text>
          {showCustomer && vehicle ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {vehicle}
              {order.vehiclePlate ? ` · ${order.vehiclePlate}` : ''}
            </Text>
          ) : null}
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      {showCustomer ? (
        <View style={styles.metaRow}>
          <Ionicons name="call-outline" size={13} color={palette.textFaint} />
          <Text variant="micro" tone="faint">
            {prettyPhone(order.customerPhone)}
          </Text>
        </View>
      ) : null}

      {total > 0 ? (
        <View style={styles.progress}>
          <ProgressBar
            done={done}
            total={total}
            tone={complete ? palette.success : onHold ? palette.warning : palette.primary}
          />
          <Text variant="micro" tone="muted">
            {t(d.track.progress, { done, total })}
          </Text>
        </View>
      ) : null}

      {onHold && order.holdReason ? (
        <View style={[styles.hold, { backgroundColor: palette.warningSoft }]}>
          <Ionicons name="pause-circle" size={14} color={palette.warning} />
          <Text variant="micro" color={palette.warning} style={styles.grow} numberOfLines={2}>
            {order.holdReason}
          </Text>
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text variant="micro" tone="faint">
          {formatRelative(order.createdAtIso)}
        </Text>
        {order.totalAmount ? (
          <Text variant="caption" tone="muted">
            {formatMoney(order.totalAmount, order.currency ?? undefined)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1, gap: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  progress: { gap: spacing.xs, marginTop: spacing.md },
  hold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
});
