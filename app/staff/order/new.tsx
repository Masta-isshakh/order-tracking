import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../../src/ui/Screen';
import { Header } from '../../../src/ui/Header';
import { Text } from '../../../src/ui/Text';
import { Button } from '../../../src/ui/Button';
import { Card, Divider } from '../../../src/ui/Card';
import { Input } from '../../../src/ui/Input';
import { PhoneField, type PhoneFieldValue } from '../../../src/ui/PhoneField';
import { ImagesField } from '../../../src/ui/ImagesField';
import { Notice, SkeletonCard } from '../../../src/ui/Feedback';
import { CatalogCard } from '../../../src/components/CatalogCard';
import { usePalette } from '../../../src/theme/ThemeProvider';
import { useI18n, useLocalizedName } from '../../../src/i18n/I18nProvider';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useCatalog } from '../../../src/data/catalog';
import { createOrder, ensureCustomerAccount } from '../../../src/data/orders';
import { DEFAULT_COUNTRY, isLocalComplete, toE164 } from '../../../src/lib/phone';
import { parseJsonArray, type CatalogKind, type StepTemplate } from '../../../shared/domain';
import type { CatalogEntry } from '../../../shared/orders';
import { radius, spacing } from '../../../src/theme/tokens';

type Stage = 0 | 1 | 2 | 3;

/**
 * Four-stage order intake: customer, vehicle, services, review.
 *
 * Creating the customer's Cognito account is deferred to the final submit, so an
 * abandoned wizard never leaves an account behind that can request SMS codes.
 */
export default function NewOrderScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d, t, formatMoney } = useI18n();
  const localized = useLocalizedName();
  const { user } = useAuth();
  const catalog = useCatalog();

  const [stage, setStage] = useState<Stage>(0);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState<PhoneFieldValue>({ country: DEFAULT_COUNTRY, local: '' });
  const [email, setEmail] = useState('');

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('');
  const [vin, setVin] = useState('');
  const [vehicleImages, setVehicleImages] = useState<string[]>([]);

  const [picked, setPicked] = useState<{ kind: CatalogKind; id: string }[]>([]);
  const [notes, setNotes] = useState('');

  const services = catalog.data?.services ?? [];
  const packages = catalog.data?.packages ?? [];

  const selections = useMemo(() => {
    return picked
      .map(({ kind, id }) => {
        const entry =
          kind === 'SERVICE' ? services.find((s) => s.id === id) : packages.find((p) => p.id === id);
        return entry ? { kind, entry: entry as CatalogEntry } : null;
      })
      .filter((item): item is { kind: CatalogKind; entry: CatalogEntry } => item !== null);
  }, [picked, services, packages]);

  const total = selections.reduce((sum, item) => sum + (Number(item.entry.price) || 0), 0);
  const stepCount = selections.reduce((sum, item) => {
    const count = parseJsonArray<StepTemplate>(item.entry.steps).length;
    return sum + (count || 1);
  }, 0);

  const customerValid = name.trim().length > 0 && isLocalComplete(phone.local, phone.country);
  const canContinue = stage === 0 ? customerValid : stage === 2 ? selections.length > 0 : true;

  const toggle = (kind: CatalogKind, id: string) => {
    setPicked((current) =>
      current.some((item) => item.id === id)
        ? current.filter((item) => item.id !== id)
        : [...current, { kind, id }],
    );
  };

  const submit = async () => {
    const e164 = toE164(phone.local, phone.country);
    if (!e164 || !user) return;

    setBusy(true);
    setBanner(null);
    try {
      // Provisioning the Cognito account first means the order can carry
      // `customerOwner` from the start, which is what unlocks tracking.
      const account = await ensureCustomerAccount({ name, phone: e164, email });
      if (!account.ok || !account.userId) {
        setBanner(
          account.code === 'INVALID_PHONE'
            ? d.team.errors.invalidPhone
            : account.code === 'NAME_REQUIRED'
              ? d.team.errors.nameRequired
              : d.team.errors.generic,
        );
        return;
      }

      const order = await createOrder(
        {
          customer: {
            name,
            phone: e164,
            email,
            ownerSub: account.userId,
            profileId: account.orderId ?? null,
          },
          vehicle: { make, model, year, plate, color, vin, imageKeys: vehicleImages },
          selections,
          notes,
          scheduledAt: null,
        },
        user,
      );

      router.replace(`/staff/order/${order.id}`);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : d.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  };

  const stageTitles = [
    d.orders.stepCustomer,
    d.orders.stepVehicle,
    d.orders.stepServices,
    d.orders.stepReview,
  ];

  return (
    <Screen>
      <Header
        title={d.orders.createTitle}
        subtitle={`${d.common.step} ${stage + 1} ${d.common.of} 4 · ${stageTitles[stage]}`}
        showBack
        onBack={() => (stage === 0 ? router.back() : setStage((s) => (s - 1) as Stage))}
      />

      {/* Stage rail */}
      <View style={styles.rail}>
        {stageTitles.map((label, index) => (
          <View
            key={label}
            style={[
              styles.railSegment,
              {
                backgroundColor:
                  index <= stage ? palette.primary : palette.surfaceAlt,
              },
            ]}
          />
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {banner ? <Notice tone="danger" icon="alert-circle-outline" title={banner} /> : null}

        {stage === 0 ? (
          <>
            <Input
              label={d.book.name}
              value={name}
              onChangeText={setName}
              placeholder={d.book.namePlaceholder}
              icon="person-outline"
              autoCapitalize="words"
              required
            />
            <PhoneField label={d.book.phone} value={phone} onChange={setPhone} />
            <Text variant="micro" tone="faint">
              {d.team.phoneHint}
            </Text>
            <Input
              label={d.book.email}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />
          </>
        ) : null}

        {stage === 1 ? (
          <>
            <View style={styles.row}>
              <Input
                label={d.orders.vehicleMake}
                value={make}
                onChangeText={setMake}
                containerStyle={styles.grow}
                autoCapitalize="words"
              />
              <Input
                label={d.orders.vehicleModel}
                value={model}
                onChangeText={setModel}
                containerStyle={styles.grow}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.row}>
              <Input
                label={d.orders.vehicleYear}
                value={year}
                onChangeText={setYear}
                containerStyle={styles.grow}
                keyboardType="number-pad"
                maxLength={4}
              />
              <Input
                label={d.orders.vehicleColor}
                value={color}
                onChangeText={setColor}
                containerStyle={styles.grow}
                autoCapitalize="words"
              />
            </View>
            <Input
              label={d.orders.vehiclePlate}
              value={plate}
              onChangeText={setPlate}
              autoCapitalize="characters"
              icon="car-outline"
            />
            <Input
              label={d.orders.vehicleVin}
              value={vin}
              onChangeText={setVin}
              autoCapitalize="characters"
            />
            <ImagesField
              label={d.orders.vehiclePhotos}
              folder="orders"
              value={vehicleImages}
              onChange={setVehicleImages}
              max={6}
            />
          </>
        ) : null}

        {stage === 2 ? (
          <>
            {catalog.loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                {services.length > 0 ? (
                  <>
                    <Text variant="heading">{d.book.services}</Text>
                    {services.map((service) => (
                      <CatalogCard
                        key={service.id}
                        item={service}
                        compact
                        selected={picked.some((item) => item.id === service.id)}
                        onPress={() => toggle('SERVICE', service.id)}
                      />
                    ))}
                  </>
                ) : null}

                {packages.length > 0 ? (
                  <>
                    <Text variant="heading" style={styles.spaced}>
                      {d.book.packages}
                    </Text>
                    {packages.map((pkg) => (
                      <CatalogCard
                        key={pkg.id}
                        item={pkg}
                        compact
                        selected={picked.some((item) => item.id === pkg.id)}
                        onPress={() => toggle('PACKAGE', pkg.id)}
                      />
                    ))}
                  </>
                ) : null}

                {services.length === 0 && packages.length === 0 ? (
                  <Notice tone="info" title={d.catalog.emptyServices} body={d.catalog.emptyBody} />
                ) : null}
              </>
            )}
          </>
        ) : null}

        {stage === 3 ? (
          <>
            <Notice tone="info" icon="information-circle-outline" title={d.orders.reviewHint} />

            <Card>
              <Text variant="caption" tone="muted">
                {d.orders.customer}
              </Text>
              <Text variant="subheading">{name}</Text>
              <Text variant="caption" tone="muted">
                +{phone.country.dial} {phone.local}
              </Text>
              {email ? (
                <Text variant="caption" tone="muted">
                  {email}
                </Text>
              ) : null}
            </Card>

            {make || model || plate ? (
              <Card>
                <Text variant="caption" tone="muted">
                  {d.track.vehicle}
                </Text>
                <Text variant="subheading">{[make, model, year].filter(Boolean).join(' ')}</Text>
                {plate ? (
                  <Text variant="caption" tone="muted">
                    {plate}
                    {color ? ` · ${color}` : ''}
                  </Text>
                ) : null}
              </Card>
            ) : null}

            <Card>
              <Text variant="caption" tone="muted">
                {d.track.services}
              </Text>
              <View style={styles.summary}>
                {selections.map(({ kind, entry }) => (
                  <View key={entry.id} style={styles.summaryRow}>
                    <Ionicons
                      name={kind === 'PACKAGE' ? 'cube-outline' : 'sparkles-outline'}
                      size={15}
                      color={palette.textMuted}
                    />
                    <Text variant="body" style={styles.grow} numberOfLines={1}>
                      {localized(entry.name, entry.nameAr)}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {entry.price ? formatMoney(entry.price) : '—'}
                    </Text>
                  </View>
                ))}
              </View>
              <Divider style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text variant="bodyStrong" style={styles.grow}>
                  {d.common.total}
                </Text>
                <Text variant="bodyStrong" tone="primary">
                  {formatMoney(total)}
                </Text>
              </View>
              <Text variant="micro" tone="faint" style={styles.spaced}>
                {t(d.track.progress, { done: 0, total: stepCount })}
              </Text>
            </Card>

            <Input
              label={d.common.notes}
              value={notes}
              onChangeText={setNotes}
              multilineRows={3}
            />
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: palette.border }]}>
        {stage > 0 ? (
          <Button
            label={d.common.back}
            variant="secondary"
            onPress={() => setStage((s) => (s - 1) as Stage)}
            style={styles.grow}
          />
        ) : null}
        {stage < 3 ? (
          <Button
            label={d.common.next}
            onPress={() => setStage((s) => (s + 1) as Stage)}
            disabled={!canContinue}
            icon="arrow-forward"
            iconPosition="end"
            style={styles.grow}
          />
        ) : (
          <Button
            label={busy ? d.common.saving : d.orders.createOrder}
            onPress={submit}
            loading={busy}
            disabled={selections.length === 0 || !customerValid}
            icon="checkmark"
            style={styles.grow}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', gap: 4, paddingBottom: spacing.md },
  railSegment: { flex: 1, height: 4, borderRadius: radius.pill },
  body: { gap: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  spaced: { marginTop: spacing.sm },
  summary: { gap: spacing.sm, marginTop: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { marginVertical: spacing.md },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
