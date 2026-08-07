import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { ImagesField } from '../../src/ui/ImagesField';
import { Loader, Notice } from '../../src/ui/Feedback';
import { useI18n } from '../../src/i18n/I18nProvider';
import { saveCompanyProfile, useCompanyProfile, type CompanyProfile } from '../../src/data/settings';
import { spacing } from '../../src/theme/tokens';

/** Admin editor for everything shown on the public Home tab. */
export default function CompanyScreen() {
  const router = useRouter();
  const { d } = useI18n();
  const remote = useCompanyProfile();

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (remote.data && !profile) setProfile(remote.data);
  }, [remote.data, profile]);

  if (!profile) {
    return (
      <Screen>
        <Header title={d.settings.company} showBack />
        <Loader label={d.common.loading} />
      </Screen>
    );
  }

  const patch = (changes: Partial<CompanyProfile>) =>
    setProfile((current) => (current ? { ...current, ...changes } : current));

  const save = async () => {
    setBusy(true);
    setBanner(null);
    try {
      await saveCompanyProfile(profile);
      router.back();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : d.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={d.settings.company} subtitle={d.settings.companyHint} showBack />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {banner ? <Notice tone="danger" icon="alert-circle-outline" title={banner} /> : null}

        <ImagesField
          label={d.common.photos}
          hint={d.home.aboutTitle}
          folder="branding"
          value={profile.heroImageKeys}
          onChange={(next) => patch({ heroImageKeys: next })}
          max={6}
        />

        <View style={styles.row}>
          <Input
            label={d.catalog.name}
            value={profile.companyName}
            onChangeText={(text) => patch({ companyName: text })}
            containerStyle={styles.grow}
          />
          <Input
            label={d.catalog.nameAr}
            value={profile.companyNameAr}
            onChangeText={(text) => patch({ companyNameAr: text })}
            containerStyle={styles.grow}
          />
        </View>

        <Input
          label="Tagline (EN)"
          value={profile.tagline}
          onChangeText={(text) => patch({ tagline: text })}
        />
        <Input
          label="Tagline (AR)"
          value={profile.taglineAr}
          onChangeText={(text) => patch({ taglineAr: text })}
        />

        <Input
          label={d.catalog.description}
          value={profile.about}
          onChangeText={(text) => patch({ about: text })}
          multilineRows={4}
        />
        <Input
          label={d.catalog.descriptionAr}
          value={profile.aboutAr}
          onChangeText={(text) => patch({ aboutAr: text })}
          multilineRows={4}
        />

        <Text variant="heading" style={styles.section}>
          {d.home.contactTitle}
        </Text>

        <Input
          label={d.home.call}
          value={profile.phone}
          onChangeText={(text) => patch({ phone: text })}
          keyboardType="phone-pad"
          icon="call-outline"
        />
        <Input
          label={d.home.whatsapp}
          value={profile.whatsapp}
          onChangeText={(text) => patch({ whatsapp: text })}
          keyboardType="phone-pad"
          icon="logo-whatsapp"
        />
        <Input
          label={d.home.email}
          value={profile.email}
          onChangeText={(text) => patch({ email: text })}
          keyboardType="email-address"
          autoCapitalize="none"
          icon="mail-outline"
        />
        <Input
          label={`${d.home.directions} (EN)`}
          value={profile.address}
          onChangeText={(text) => patch({ address: text })}
          multilineRows={2}
          icon="location-outline"
        />
        <Input
          label={`${d.home.directions} (AR)`}
          value={profile.addressAr}
          onChangeText={(text) => patch({ addressAr: text })}
          multilineRows={2}
        />
        <Input
          label="Google Maps URL"
          value={profile.mapUrl}
          onChangeText={(text) => patch({ mapUrl: text })}
          autoCapitalize="none"
          keyboardType="url"
          icon="map-outline"
        />

        <Button
          label={busy ? d.common.saving : d.common.save}
          onPress={save}
          loading={busy}
          size="lg"
          full
          style={styles.save}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  section: { marginTop: spacing.sm },
  save: { marginTop: spacing.md },
});
