import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Segmented } from '../../src/ui/Segmented';
import { EmptyState, ErrorState, SkeletonCard } from '../../src/ui/Feedback';
import { CatalogCard } from '../../src/components/CatalogCard';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useCatalog } from '../../src/data/catalog';
import { radius, shadow, spacing, fabClearance } from '../../src/theme/tokens';

/** Staff catalog: create, edit and hide services and packages. */
export default function StaffCatalogScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d } = useI18n();
  const [tab, setTab] = useState<'services' | 'packages'>('services');

  // Hidden items must stay visible to staff so they can be re-enabled.
  const catalog = useCatalog({ includeHidden: true });

  // Coming back from the editor should show the change immediately.
  useFocusEffect(
    React.useCallback(() => {
      void catalog.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const services = catalog.data?.services ?? [];
  const packages = catalog.data?.packages ?? [];
  const items = tab === 'services' ? services : packages;
  const kind = tab === 'services' ? 'service' : 'package';

  return (
    <Screen edges={{ bottom: false }}>
      <Header title={d.catalog.title} />

      <Segmented
        options={[
          { value: 'services', label: d.catalog.services, count: services.length },
          { value: 'packages', label: d.catalog.packages, count: packages.length },
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
            body={d.catalog.emptyBody}
            actionLabel={tab === 'services' ? d.catalog.newService : d.catalog.newPackage}
            onAction={() => router.push({ pathname: '/staff/catalog-item', params: { kind } })}
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
                onPress={() =>
                  router.push({ pathname: '/staff/catalog-item', params: { kind, id: item.id } })
                }
                onEdit={() =>
                  router.push({ pathname: '/staff/catalog-item', params: { kind, id: item.id } })
                }
              />
            ))}
          </ScrollView>
        )}
      </View>

      <Pressable
        onPress={() => router.push({ pathname: '/staff/catalog-item', params: { kind } })}
        accessibilityRole="button"
        accessibilityLabel={tab === 'services' ? d.catalog.newService : d.catalog.newPackage}
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
  listWrap: { flex: 1, marginTop: spacing.md },
  list: { gap: spacing.sm, paddingBottom: fabClearance },
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
