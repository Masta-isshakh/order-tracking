import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../src/ui/Screen';
import { Header } from '../../../src/ui/Header';
import { Text } from '../../../src/ui/Text';
import { Button } from '../../../src/ui/Button';
import { Card, Divider } from '../../../src/ui/Card';
import { Input } from '../../../src/ui/Input';
import { Sheet } from '../../../src/ui/Sheet';
import { OrderStatusBadge } from '../../../src/ui/Badge';
import { EmptyState, ErrorState, Loader, Notice } from '../../../src/ui/Feedback';
import { ProgressBar, Roadmap, type RoadmapStep } from '../../../src/ui/Roadmap';
import { ImagesField } from '../../../src/ui/ImagesField';
import { StorageImage } from '../../../src/ui/StorageImage';
import { usePalette } from '../../../src/theme/ThemeProvider';
import { useI18n } from '../../../src/i18n/I18nProvider';
import { useAuth } from '../../../src/auth/AuthProvider';
import {
  acceptOrder,
  addStepToOrder,
  cancelOrder,
  completeOrder,
  holdOrder,
  renameStep,
  resumeOrder,
  setStepImages,
  setStepStatus,
  useOrderDetail,
} from '../../../src/data/orders';
import { prettyPhone } from '../../../src/lib/phone';
import { parseJsonArray, type OrderItemSnapshot } from '../../../shared/domain';
import { radius, spacing } from '../../../src/theme/tokens';
import type { OrderStep } from '../../../src/lib/amplify';

type SheetKind = 'hold' | 'cancel' | 'rename' | 'photos' | 'addStep' | null;

/** Staff view of one order: run the roadmap, manage status, talk to the customer. */
export default function StaffOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { d, t, formatMoney, formatDate } = useI18n();
  const { user } = useAuth();
  const detail = useOrderDetail(id);

  const [sheet, setSheet] = useState<SheetKind>(null);
  const [activeStep, setActiveStep] = useState<OrderStep | null>(null);
  const [reason, setReason] = useState('');
  const [stepName, setStepName] = useState('');
  const [stepNameAr, setStepNameAr] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const order = detail.data?.order;
  const steps = detail.data?.steps ?? [];

  const closeSheet = () => {
    setSheet(null);
    setActiveStep(null);
    setReason('');
    setStepName('');
    setStepNameAr('');
  };

  /** Wraps a mutation with busy state, error surfacing and a refresh. */
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setBanner(null);
    try {
      await action();
      await detail.refresh();
      closeSheet();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : d.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading) {
    return (
      <Screen>
        <Header title={d.orders.title} showBack />
        <Loader label={d.common.loading} />
      </Screen>
    );
  }

  if (detail.error || !order || !user) {
    return (
      <Screen>
        <Header title={d.orders.title} showBack />
        <ErrorState
          message={d.common.somethingWentWrong}
          onRetry={detail.refresh}
          retryLabel={d.common.retry}
        />
      </Screen>
    );
  }

  const items = parseJsonArray<OrderItemSnapshot>(order.items);
  const vehicle = [order.vehicleMake, order.vehicleModel, order.vehicleYear].filter(Boolean).join(' ');
  const vehicleImages = (order.vehicleImageKeys ?? []).filter((key): key is string => !!key);
  const done = order.completedStepCount ?? 0;
  const total = order.totalStepCount ?? steps.length;
  const closed = order.status === 'COMPLETED' || order.status === 'CANCELLED';

  const stepActions = (step: RoadmapStep) => {
    const model = steps.find((item) => item.id === step.id);
    if (!model || closed) return null;

    const isPending = model.status === 'PENDING';
    const isActive = model.status === 'IN_PROGRESS';
    const isDone = model.status === 'COMPLETED';

    return (
      <>
        {isPending ? (
          <Button
            label={d.orders.markInProgress}
            size="sm"
            variant="secondary"
            icon="play"
            onPress={() => void run(() => setStepStatus(order, steps, model.id, 'IN_PROGRESS', user))}
          />
        ) : null}

        {isActive ? (
          <Button
            label={d.orders.markComplete}
            size="sm"
            variant="success"
            icon="checkmark"
            onPress={() => void run(() => setStepStatus(order, steps, model.id, 'COMPLETED', user))}
          />
        ) : null}

        {isDone ? (
          <>
            <Button
              label={d.orders.addStepPhoto}
              size="sm"
              variant="secondary"
              icon="camera-outline"
              onPress={() => {
                setActiveStep(model);
                setSheet('photos');
              }}
            />
            <Button
              label={d.orders.reopenStep}
              size="sm"
              variant="ghost"
              icon="refresh-outline"
              onPress={() => void run(() => setStepStatus(order, steps, model.id, 'IN_PROGRESS', user))}
            />
          </>
        ) : null}

        <Button
          label={d.orders.renameStep}
          size="sm"
          variant="ghost"
          icon="create-outline"
          onPress={() => {
            setActiveStep(model);
            setStepName(model.name);
            setStepNameAr(model.nameAr ?? '');
            setSheet('rename');
          }}
        />
      </>
    );
  };

  return (
    <Screen scroll refreshing={detail.refreshing} onRefresh={detail.refresh}>
      <Header
        title={order.orderNumber}
        subtitle={order.customerName}
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
        {banner ? <Notice tone="danger" icon="alert-circle-outline" title={banner} /> : null}

        {/* Customer + vehicle */}
        <Card>
          <View style={styles.rowTop}>
            <View style={styles.grow}>
              <Text variant="caption" tone="muted">
                {d.orders.customer}
              </Text>
              <Text variant="title">{order.customerName}</Text>
              <Text variant="caption" tone="muted">
                {prettyPhone(order.customerPhone)}
              </Text>
            </View>
            <OrderStatusBadge status={order.status} />
          </View>

          {vehicle || order.vehiclePlate ? (
            <>
              <Divider style={styles.divider} />
              <Text variant="caption" tone="muted">
                {d.track.vehicle}
              </Text>
              <Text variant="subheading">{vehicle || '—'}</Text>
              {order.vehiclePlate ? (
                <Text variant="caption" tone="muted">
                  {order.vehiclePlate}
                  {order.vehicleColor ? ` · ${order.vehicleColor}` : ''}
                </Text>
              ) : null}
            </>
          ) : null}

          {vehicleImages.length > 0 ? (
            <View style={styles.photos}>
              {vehicleImages.map((key) => (
                <StorageImage key={key} storageKey={key} style={styles.photo} />
              ))}
            </View>
          ) : null}

          {total > 0 ? (
            <View style={styles.progress}>
              <ProgressBar
                done={done}
                total={total}
                tone={order.status === 'COMPLETED' ? palette.success : palette.primary}
              />
              <Text variant="micro" tone="muted">
                {t(d.track.progress, { done, total })}
              </Text>
            </View>
          ) : null}
        </Card>

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

        {/* Status actions */}
        {!closed ? (
          <View style={styles.actions}>
            {order.status === 'NEW' ? (
              <Button
                label={d.orders.accept}
                icon="checkmark-circle-outline"
                onPress={() => void run(() => acceptOrder(order.id, user))}
                loading={busy}
              />
            ) : null}

            {order.status === 'ON_HOLD' ? (
              <Button
                label={d.orders.resume}
                icon="play-circle-outline"
                onPress={() => void run(() => resumeOrder(order.id))}
                loading={busy}
              />
            ) : (
              <Button
                label={d.orders.hold}
                variant="secondary"
                icon="pause-circle-outline"
                onPress={() => setSheet('hold')}
              />
            )}

            <Button
              label={d.orders.complete}
              variant="success"
              icon="flag-outline"
              onPress={() =>
                Alert.alert(d.orders.complete, d.orders.completeConfirm, [
                  { text: d.common.cancel, style: 'cancel' },
                  {
                    text: d.common.confirm,
                    onPress: () => void run(() => completeOrder(order.id, steps, user)),
                  },
                ])
              }
            />

            <Button
              label={d.orders.cancel}
              variant="ghost"
              icon="close-circle-outline"
              onPress={() => setSheet('cancel')}
            />
          </View>
        ) : null}

        {/* Roadmap */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="heading">{d.orders.steps}</Text>
            {!closed ? (
              <Button
                label={d.common.add}
                size="sm"
                variant="ghost"
                icon="add"
                onPress={() => setSheet('addStep')}
              />
            ) : null}
          </View>

          {steps.length === 0 ? (
            <EmptyState icon="git-commit-outline" title={d.orders.noSteps} />
          ) : (
            <Roadmap steps={steps} renderActions={stepActions} />
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

        {order.notes ? (
          <Card>
            <Text variant="caption" tone="muted">
              {d.common.notes}
            </Text>
            <Text variant="body">{order.notes}</Text>
          </Card>
        ) : null}

        <Card>
          <Text variant="micro" tone="faint">
            {d.track.placedOn} {formatDate(order.createdAtIso, true)}
          </Text>
          {order.assignedSupervisorName ? (
            <Text variant="micro" tone="faint">
              {d.orders.assignedTo} {order.assignedSupervisorName}
            </Text>
          ) : null}
          {order.completedAt ? (
            <Text variant="micro" tone="faint">
              {d.track.completedOn} {formatDate(order.completedAt, true)}
            </Text>
          ) : null}
        </Card>
      </View>

      {/* Hold */}
      <Sheet
        visible={sheet === 'hold'}
        onClose={closeSheet}
        title={d.orders.holdTitle}
        subtitle={d.orders.holdReasonRequired}
        footer={
          <Button
            label={d.common.confirm}
            loading={busy}
            disabled={!reason.trim()}
            full
            onPress={() => void run(() => holdOrder(order.id, reason))}
          />
        }
      >
        <Input
          label={d.orders.holdReasonLabel}
          value={reason}
          onChangeText={setReason}
          placeholder={d.orders.holdReasonPlaceholder}
          multilineRows={3}
          required
        />
      </Sheet>

      {/* Cancel */}
      <Sheet
        visible={sheet === 'cancel'}
        onClose={closeSheet}
        title={d.orders.cancelTitle}
        footer={
          <Button
            label={d.orders.cancel}
            variant="danger"
            loading={busy}
            full
            onPress={() => void run(() => cancelOrder(order.id, reason))}
          />
        }
      >
        <Input
          label={d.orders.cancelReasonLabel}
          value={reason}
          onChangeText={setReason}
          multilineRows={3}
        />
      </Sheet>

      {/* Rename step */}
      <Sheet
        visible={sheet === 'rename'}
        onClose={closeSheet}
        title={d.orders.renameStep}
        footer={
          <Button
            label={d.common.save}
            loading={busy}
            disabled={!stepName.trim()}
            full
            onPress={() =>
              activeStep && void run(() => renameStep(activeStep.id, stepName, stepNameAr))
            }
          />
        }
      >
        <Input label={d.catalog.name} value={stepName} onChangeText={setStepName} required />
        <Input label={d.catalog.nameAr} value={stepNameAr} onChangeText={setStepNameAr} />
      </Sheet>

      {/* Add step */}
      <Sheet
        visible={sheet === 'addStep'}
        onClose={closeSheet}
        title={d.catalog.addStep}
        footer={
          <Button
            label={d.common.add}
            loading={busy}
            disabled={!stepName.trim()}
            full
            onPress={() => void run(() => addStepToOrder(order, steps, stepName, stepNameAr))}
          />
        }
      >
        <Input
          label={d.orders.stepName}
          value={stepName}
          onChangeText={setStepName}
          placeholder={d.catalog.stepPlaceholder}
          required
        />
        <Input label={d.catalog.nameAr} value={stepNameAr} onChangeText={setStepNameAr} />
      </Sheet>

      {/* Step photos — only reachable once the step is complete. */}
      <Sheet
        visible={sheet === 'photos'}
        onClose={closeSheet}
        title={d.orders.addStepPhoto}
        subtitle={activeStep?.name}
      >
        {activeStep ? (
          <ImagesField
            folder="orders"
            value={(activeStep.imageKeys ?? []).filter((key): key is string => !!key)}
            onChange={(next) => {
              setActiveStep({ ...activeStep, imageKeys: next });
              void run(() => setStepImages(activeStep.id, next));
            }}
            max={8}
            hint={d.orders.photosOnlyWhenDone}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingBottom: spacing.xl },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1 },
  divider: { marginVertical: spacing.md },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  photo: { width: 88, height: 68, borderRadius: radius.md },
  progress: { gap: spacing.xs, marginTop: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  items: { gap: spacing.sm, marginTop: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
