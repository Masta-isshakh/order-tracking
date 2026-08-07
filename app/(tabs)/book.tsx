import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { Segmented } from '../../src/ui/Segmented';
import { EmptyState, ErrorState, SkeletonCard } from '../../src/ui/Feedback';
import { CatalogCard } from '../../src/components/CatalogCard';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useCatalog } from '../../src/data/catalog';
import { useBookingDraft } from '../../src/data/bookingDraft';
import { shadow, spacing } from '../../src/theme/tokens';

/**
 * Public catalog with selection. No sign-in required — verification only happens
 * later, when the customer wants to track what they booked.
 */
export default function BookScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d, t, formatMoney } = useI18n();
  const catalog = useCatalog();
  const { selections, toggle, clear } = useBookingDraft();

  const [tab, setTab] = useState<'services' | 'packages'>('services');

  const services = catalog.data?.services ?? [];
  const packages = catalog.data?.packages ?? [];

  const items = tab === 'services' ? services : packages;
  const kind = tab === 'services' ? 'SERVICE' : 'PACKAGE';

  const total = useMemo(
    () => selections.reduce((sum, item) => sum + (item.price ?? 0), 0),
    [selections],
  );

  return (
    <Screen bottomInset={selections.length > 0 ? 96 : 0}>
      <Header title={d.book.title} />

      <Text variant="body" tone="muted" style={styles.subtitle}>
        {d.book.subtitle}
      </Text>

      <Segmented
        options={[
          { value: 'services', label: d.book.services, count: services.length },
          { value: 'packages', label: d.book.packages, count: packages.length },
        ]}
        value={tab}
        onChange={setTab}
        scrollable={false}
      />

      <View style={styles.listWrap}>
        {catalog.loading ? (
          <View style={styles.list}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : catalog.error ? (
          <ErrorState
            message={d.common.somethingWentWrong}
            onRetry={catalog.refresh}
            retryLabel={d.common.retry}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="pricetags-outline"
            title={tab === 'services' ? d.catalog.emptyServices : d.catalog.emptyPackages}
            body={d.home.emptyCatalog}
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={catalog.refreshing}
                onRefresh={catalog.refresh}
                tintColor={palette.textMuted}
                colors={[palette.primary]}
                progressBackgroundColor={palette.surface}
              />
            }
          >
            {items.map((item) => (
              <CatalogCard
                key={item.id}
                item={item}
                selected={selections.some((s) => s.refId === item.id)}
                onPress={() =>
                  toggle({
                    kind,
                    refId: item.id,
                    name: item.name,
                    nameAr: item.nameAr ?? null,
                    price: item.price ?? null,
                  })
                }
              />
            ))}
          </ScrollView>
        )}
      </View>

      {selections.length > 0 ? (
        <View
          style={[
            styles.bar,
            { backgroundColor: palette.surface, borderColor: palette.border },
            shadow(3, palette),
          ]}
        >
          <View style={styles.barText}>
            <Text variant="caption" tone="muted">
              {t(d.book.selected, { count: selections.length })}
            </Text>
            <Text variant="heading">{formatMoney(total)}</Text>
          </View>
          <Button label={d.common.cancel} variant="ghost" size="sm" onPress={clear} />
          <Button
            label={d.book.continue}
            onPress={() => router.push('/booking/checkout')}
            icon="arrow-forward"
            iconPosition="end"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: spacing.md },
  listWrap: { flex: 1, marginTop: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.lg },
  bar: {
    position: 'absolute',
    insetInlineStart: spacing.lg,
    insetInlineEnd: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  barText: { flex: 1 },
});
