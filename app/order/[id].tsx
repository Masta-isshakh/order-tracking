import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { Card, Divider } from '../../src/ui/Card';
import { OrderStatusBadge } from '../../src/ui/Badge';
import { Loader, ErrorState, Notice, EmptyState } from '../../src/ui/Feedback';
import { ProgressBar, Roadmap } from '../../src/ui/Roadmap';
import { StorageImage } from '../../src/ui/StorageImage';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useOrderDetail } from '../../src/data/orders';
import { parseJsonArray, type OrderItemSnapshot } from '../../shared/domain';
import { radius, spacing } from '../../src/theme/tokens';

/** Read-only tracking view the customer sees. */
export default function CustomerOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { d, t, formatMoney, formatDate } = useI18n();
  const detail = useOrderDetail(id);

  if (detail.loading) {
    return (
      <Screen>
        <Header title={d.track.title} showBack />
        <Loader label={d.common.loading} />
      </Screen>
    );
  }

  if (detail.error || !detail.data?.order) {
    return (
      <Screen>
        <Header title={d.track.title} showBack />
        <ErrorState
          message={d.common.somethingWentWrong}
          onRetry={detail.refresh}
          retryLabel={d.common.retry}
        />
      </Screen>
    );
  }

  const { order, steps } = detail.data;
  const items = parseJsonArray<OrderItemSnapshot>(order.items);
  const vehicle = [order.vehicleMake, order.vehicleModel, order.vehicleYear].filter(Boolean).join(' ');
  const vehicleImages = (order.vehicleImageKeys ?? []).filter((key): key is string => !!key);
  const done = order.completedStepCount ?? 0;
  const total = order.totalStepCount ?? steps.length;
  const complete = order.status === 'COMPLETED';

  return (
    <Screen scroll refreshing={detail.refreshing} onRefresh={detail.refresh}>
      <Header
        title={t(d.track.orderNumber, { number: order.orderNumber })}
        showBack
        actions={[
          {
            icon: 'chatbubble-ellipses-outline',
            label: d.chat.title,
            onPress: () => router.push(`/chat/${order.id}`),
            tone: 'primary',
          },
        ]}
      />

      <View style={styles.body}>
        {/* Status summary */}
        <Card>
          <View style={styles.statusRow}>
            <View style={styles.grow}>
              <Text variant="caption" tone="muted">
                {d.track.placedOn} {formatDate(order.createdAtIso)}
              </Text>
              <Text variant="title">{vehicle || order.customerName}</Text>
              {order.vehiclePlate ? (
                <Text variant="caption" tone="muted">
                  {order.vehiclePlate}
                </Text>
              ) : null}
            </View>
            <OrderStatusBadge status={order.status} />
          </View>

          {total > 0 ? (
            <View style={styles.progress}>
              <ProgressBar
                done={done}
                total={total}
                tone={complete ? palette.success : palette.primary}
              />
              <Text variant="caption" tone="muted">
                {t(d.track.progress, { done, total })}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Exception banners */}
        {order.status === 'ON_HOLD' ? (
          <Notice
            tone="warning"
            icon="pause-circle-outline"
            title={d.track.onHoldTitle}
            body={order.holdReason ?? undefined}
          />
        ) : null}

        {order.status === 'CANCELLED' ? (
          <Notice
            tone="danger"
            icon="close-circle-outline"
            title={d.track.cancelledTitle}
            body={order.cancelReason ?? undefined}
          />
        ) : null}

        {complete ? (
          <Notice
            tone="success"
            icon="checkmark-circle-outline"
            title={d.track.completedTitle}
            body={d.track.completedBody}
          />
        ) : null}

        {/* Roadmap */}
        <View style={styles.section}>
          <Text variant="heading">{d.track.roadmap}</Text>
          {steps.length === 0 ? (
            <EmptyState icon="git-commit-outline" title={d.orders.noSteps} />
          ) : (
            <Roadmap steps={steps} />
          )}
        </View>

        {/* Services */}
        {items.length > 0 ? (
          <Card>
            <Text variant="heading">{d.track.services}</Text>
            <View style={styles.items}>
              {items.map((item) => (
                <View key={`${item.kind}-${item.refId}`} style={styles.itemRow}>
                  <Ionicons
                    name={item.kind === 'PACKAGE' ? 'cube-outline' : 'sparkles-outline'}
                    size={15}
                    color={palette.textMuted}
                  />
                  <Text variant="body" style={styles.grow} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.price ? (
                    <Text variant="caption" tone="muted">
                      {formatMoney(item.price, order.currency ?? undefined)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
            {order.totalAmount ? (
              <>
                <Divider style={styles.divider} />
                <View style={styles.itemRow}>
                  <Text variant="bodyStrong" style={styles.grow}>
                    {d.common.total}
                  </Text>
                  <Text variant="bodyStrong" tone="primary">
                    {formatMoney(order.totalAmount, order.currency ?? undefined)}
                  </Text>
                </View>
              </>
            ) : null}
          </Card>
        ) : null}

        {/* Vehicle photos */}
        {vehicleImages.length > 0 ? (
          <Card>
            <Text variant="heading">{d.orders.vehiclePhotos}</Text>
            <View style={styles.photos}>
              {vehicleImages.map((key) => (
                <StorageImage key={key} storageKey={key} style={styles.photo} />
              ))}
            </View>
          </Card>
        ) : null}

        {/* Advisor */}
        {order.assignedSupervisorName ? (
          <Card>
            <Text variant="caption" tone="muted">
              {d.track.supervisor}
            </Text>
            <Text variant="subheading">{order.assignedSupervisorName}</Text>
          </Card>
        ) : null}

        <Button
          label={d.track.messageSupervisor}
          icon="chatbubble-ellipses-outline"
          variant="secondary"
          size="lg"
          full
          onPress={() => router.push(`/chat/${order.id}`)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingBottom: spacing.xl },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1 },
  progress: { gap: spacing.xs, marginTop: spacing.lg },
  section: { gap: spacing.md },
  items: { gap: spacing.sm, marginTop: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { marginVertical: spacing.md },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photo: { width: 96, height: 76, borderRadius: radius.md },
});
