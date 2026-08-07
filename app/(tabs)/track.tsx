import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { EmptyState, ErrorState, SkeletonCard } from '../../src/ui/Feedback';
import { OrderCard } from '../../src/components/OrderCard';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { useMyOrders } from '../../src/data/orders';
import { radius, spacing } from '../../src/theme/tokens';

/**
 * The one gated tab.
 *
 * Signed out -> a verification prompt. Signed in as staff -> a shortcut into
 * their workspace. Signed in as a customer -> their live order list.
 */
export default function TrackScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d } = useI18n();
  const { status, user } = useAuth();
  const orders = useMyOrders();

  const isStaff = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

  // Staff who land here (e.g. by tapping the tab after signing in) are sent
  // straight to their workspace rather than shown an empty customer list.
  useFocusEffect(
    React.useCallback(() => {
      if (isStaff) router.replace('/(staff)/orders');
    }, [isStaff, router]),
  );

  if (status !== 'signedIn') {
    return (
      <Screen scroll>
        <Header title={d.tabs.track} />
        <View style={styles.gate}>
          <View style={[styles.gateIcon, { backgroundColor: palette.primarySoft }]}>
            <Ionicons name="navigate-circle" size={40} color={palette.primary} />
          </View>
          <Text variant="title" align="center">
            {d.auth.gateTitle}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {d.auth.gateSubtitle}
          </Text>
          <Button
            label={d.auth.gateAction}
            onPress={() => router.push('/auth/phone')}
            size="lg"
            icon="phone-portrait-outline"
            full
          />
          <Card elevation={0} style={{ backgroundColor: palette.surfaceAlt }}>
            <Text variant="caption" tone="muted" align="center">
              {d.auth.phoneSubtitle}
            </Text>
          </Card>
        </View>
      </Screen>
    );
  }

  if (isStaff) return null;

  const list = orders.data ?? [];

  return (
    <Screen>
      <Header title={d.track.title} subtitle={user?.name || undefined} />

      {orders.loading ? (
        <View style={styles.list}>
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
        <EmptyState
          icon="car-sport-outline"
          title={d.track.empty}
          body={d.track.emptyBody}
          actionLabel={d.track.emptyAction}
          onAction={() => router.push('/(tabs)/book')}
        />
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
              showCustomer={false}
              onPress={() => router.push(`/order/${order.id}`)}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gate: { gap: spacing.lg, paddingTop: spacing.xxl, alignItems: 'stretch' },
  gateIcon: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  list: { gap: spacing.md, paddingBottom: spacing.xl },
});
