import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Input } from '../../src/ui/Input';
import { Segmented } from '../../src/ui/Segmented';
import { EmptyState, ErrorState, SkeletonCard } from '../../src/ui/Feedback';
import { OrderCard } from '../../src/components/OrderCard';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useStaffOrders, type OrderBucket } from '../../src/data/orders';
import { radius, shadow, spacing, fabClearance } from '../../src/theme/tokens';

/** Staff order board: New, Pending, Completed and full History. */
export default function StaffOrdersScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d } = useI18n();

  const [bucket, setBucket] = useState<OrderBucket>('new');
  const [query, setQuery] = useState('');

  const orders = useStaffOrders(bucket);

  const list = useMemo(() => {
    const all = orders.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((order) =>
      [order.customerName, order.customerPhone, order.orderNumber, order.vehiclePlate]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [orders.data, query]);

  const emptyBody: Record<OrderBucket, string> = {
    new: d.orders.emptyNew,
    pending: d.orders.emptyPending,
    completed: d.orders.emptyCompleted,
    history: d.orders.emptyHistory,
  };

  return (
    <Screen edges={{ bottom: false }}>
      <Header title={d.orders.title} />

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={d.orders.searchPlaceholder}
        icon="search-outline"
        autoCapitalize="none"
        containerStyle={styles.search}
      />

      <Segmented
        options={[
          { value: 'new', label: d.orders.new },
          { value: 'pending', label: d.orders.pending },
          { value: 'completed', label: d.orders.completed },
          { value: 'history', label: d.orders.history },
        ]}
        value={bucket}
        onChange={setBucket}
      />

      <View style={styles.listWrap}>
        {orders.loading ? (
          <View style={styles.list}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : orders.error ? (
          <ErrorState
            message={d.common.somethingWentWrong}
            onRetry={orders.refresh}
            retryLabel={d.common.retry}
          />
        ) : list.length === 0 ? (
          <EmptyState icon="clipboard-outline" title={d.orders.empty} body={emptyBody[bucket]} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={orders.refreshing}
                onRefresh={orders.refresh}
                tintColor={palette.textMuted}
                colors={[palette.primary]}
                progressBackgroundColor={palette.surface}
              />
            }
          >
            {list.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => router.push(`/staff/order/${order.id}`)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <Pressable
        onPress={() => router.push('/staff/order/new')}
        accessibilityRole="button"
        accessibilityLabel={d.orders.createOrder}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: palette.primary, opacity: pressed ? 0.9 : 1 },
          shadow(3, palette),
        ]}
      >
        <Ionicons name="add" size={26} color={palette.onPrimary} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: spacing.md },
  listWrap: { flex: 1, marginTop: spacing.md },
  list: { gap: spacing.md, paddingBottom: fabClearance },
  fab: {
    position: 'absolute',
    insetInlineEnd: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
