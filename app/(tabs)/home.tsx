import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { StorageImage } from '../../src/ui/StorageImage';
import { SkeletonCard } from '../../src/ui/Feedback';
import { CatalogCard } from '../../src/components/CatalogCard';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useCatalog } from '../../src/data/catalog';
import { useCompanyProfile } from '../../src/data/settings';
import { radius, shadow, spacing } from '../../src/theme/tokens';

/** Public landing page: who we are, what we do, how to reach us. */
export default function HomeScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d, locale } = useI18n();
  const catalog = useCatalog();
  const company = useCompanyProfile();

  const profile = company.data;
  const isArabic = locale === 'ar';
  const name = (isArabic ? profile?.companyNameAr : profile?.companyName) || d.common.appName;
  const tagline = isArabic ? profile?.taglineAr : profile?.tagline;
  const about = isArabic ? profile?.aboutAr : profile?.about;
  const address = (isArabic ? profile?.addressAr : profile?.address) || '';

  const hero = profile?.heroImageKeys ?? [];
  const services = catalog.data?.services ?? [];
  const packages = catalog.data?.packages ?? [];

  const refresh = async () => {
    await Promise.all([catalog.refresh(), company.refresh()]);
  };

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <Screen edges={{ bottom: false }}
      scroll
      refreshing={catalog.refreshing || company.refreshing}
      onRefresh={refresh}
      padded={false}
    >
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: palette.heroGradient[0] }]}>
        {hero.length > 0 ? (
          <StorageImage storageKey={hero[0]} style={styles.heroImage} rounded={0} />
        ) : null}
        <View style={[styles.heroOverlay, { backgroundColor: hero.length ? 'rgba(4,10,22,0.55)' : 'transparent' }]}>
          <Text variant="micro" color="rgba(255,255,255,0.8)">
            {d.home.greeting}
          </Text>
          <Text variant="display" color="#FFFFFF">
            {name}
          </Text>
          {tagline ? (
            <Text variant="body" color="rgba(255,255,255,0.9)">
              {tagline}
            </Text>
          ) : null}

          <View style={styles.heroActions}>
            <Button
              label={d.home.bookNow}
              onPress={() => router.push('/(tabs)/book')}
              icon="sparkles-outline"
            />
            <Button
              label={d.home.trackOrder}
              variant="secondary"
              onPress={() => router.push('/(tabs)/track')}
              icon="navigate-circle-outline"
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        {/* Gallery */}
        {hero.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {hero.slice(1).map((key) => (
              <StorageImage key={key} storageKey={key} style={styles.galleryImage} />
            ))}
          </ScrollView>
        ) : null}

        {/* Services */}
        <View style={styles.blockHeader}>
          <Text variant="heading">{d.home.ourServices}</Text>
          {services.length > 0 ? (
            <Pressable onPress={() => router.push('/(tabs)/book')} hitSlop={8}>
              <Text variant="caption" tone="primary">
                {d.common.seeAll}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {catalog.loading ? (
          <View style={styles.list}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : services.length === 0 && packages.length === 0 ? (
          <Card>
            <Text variant="body" tone="muted">
              {d.home.emptyCatalog}
            </Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {services.slice(0, 4).map((service) => (
              <CatalogCard
                key={service.id}
                item={service}
                onPress={() => router.push('/(tabs)/book')}
              />
            ))}
          </View>
        )}

        {/* Packages */}
        {packages.length > 0 ? (
          <>
            <View style={styles.blockHeader}>
              <Text variant="heading">{d.home.ourPackages}</Text>
            </View>
            <View style={styles.list}>
              {packages.slice(0, 3).map((pkg) => (
                <CatalogCard key={pkg.id} item={pkg} onPress={() => router.push('/(tabs)/book')} />
              ))}
            </View>
          </>
        ) : null}

        {/* About */}
        {about ? (
          <Card>
            <Text variant="heading">{d.home.aboutTitle}</Text>
            <Text variant="body" tone="muted" style={styles.aboutBody}>
              {about}
            </Text>
          </Card>
        ) : null}

        {/* Contact */}
        {profile?.phone || profile?.whatsapp || profile?.email || address ? (
          <Card>
            <Text variant="heading">{d.home.contactTitle}</Text>

            <View style={styles.contactGrid}>
              {profile?.phone ? (
                <ContactTile
                  icon="call"
                  label={d.home.call}
                  onPress={() => open(`tel:${profile.phone}`)}
                />
              ) : null}
              {profile?.whatsapp ? (
                <ContactTile
                  icon="logo-whatsapp"
                  label={d.home.whatsapp}
                  onPress={() => open(`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`)}
                />
              ) : null}
              {profile?.email ? (
                <ContactTile
                  icon="mail"
                  label={d.home.email}
                  onPress={() => open(`mailto:${profile.email}`)}
                />
              ) : null}
              {profile?.mapUrl ? (
                <ContactTile
                  icon="location"
                  label={d.home.directions}
                  onPress={() => open(profile.mapUrl)}
                />
              ) : null}
            </View>

            {address ? (
              <Text variant="caption" tone="muted" style={styles.address}>
                {address}
              </Text>
            ) : null}

            {profile?.workingHours?.length ? (
              <View style={styles.hours}>
                <Text variant="bodyStrong">{d.home.workingHours}</Text>
                {profile.workingHours.map((entry) => (
                  <View key={entry.day} style={styles.hourRow}>
                    <Text variant="caption" tone="muted">
                      {entry.day}
                    </Text>
                    <Text variant="caption">{entry.hours}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const ContactTile = ({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) => {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.contactTile,
        { backgroundColor: palette.surfaceAlt, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color={palette.primary} />
      <Text variant="micro" tone="muted">
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  hero: { minHeight: 260, justifyContent: 'flex-end' },
  heroImage: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  heroOverlay: { gap: spacing.xs, padding: spacing.xl, paddingTop: spacing.xxxl },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  section: { gap: spacing.lg, padding: spacing.lg },
  gallery: { gap: spacing.sm },
  galleryImage: { width: 150, height: 100, borderRadius: radius.md },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: spacing.sm },
  aboutBody: { marginTop: spacing.sm },
  contactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  contactTile: {
    minWidth: 78,
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  address: { marginTop: spacing.md },
  hours: { gap: spacing.xs, marginTop: spacing.lg },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
