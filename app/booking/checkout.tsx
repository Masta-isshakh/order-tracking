import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { Card, Divider } from '../../src/ui/Card';
import { Input } from '../../src/ui/Input';
import { PhoneField, type PhoneFieldValue } from '../../src/ui/PhoneField';
import { Notice } from '../../src/ui/Feedback';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n, useLocalizedName } from '../../src/i18n/I18nProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { useBookingDraft } from '../../src/data/bookingDraft';
import { submitPublicBooking } from '../../src/data/orders';
import { DEFAULT_COUNTRY, isLocalComplete, toE164 } from '../../src/lib/phone';
import { radius, spacing } from '../../src/theme/tokens';

/** Final step of a public booking: contact details, then submit. */
export default function CheckoutScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { d, t, formatMoney } = useI18n();
  const localized = useLocalizedName();
  const { status } = useAuth();
  const { selections, clear } = useBookingDraft();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState<PhoneFieldValue>({ country: DEFAULT_COUNTRY, local: '' });
  const [email, setEmail] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ orderNumber: string } | null>(null);

  const total = selections.reduce((sum, item) => sum + (item.price ?? 0), 0);

  const submit = async () => {
    const e164 = toE164(phone.local, phone.country);
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = d.book.errors.nameRequired;
    if (!e164 || !isLocalComplete(phone.local, phone.country)) {
      nextErrors.phone = d.book.errors.invalidPhone;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !e164) return;

    setBusy(true);
    setBanner(null);
    try {
      const result = await submitPublicBooking({
        name,
        phone: e164,
        email,
        notes,
        preferredDate: null,
        vehicleMake,
        vehicleModel,
        vehiclePlate,
        selections: selections.map((item) => ({ kind: item.kind, refId: item.refId })),
        signedIn: status === 'signedIn',
      });

      if (!result.ok) {
        setBanner(
          result.code === 'RATE_LIMITED'
            ? d.book.errors.rateLimited
            : result.code === 'INVALID_PHONE'
              ? d.book.errors.invalidPhone
              : result.code === 'NAME_REQUIRED'
                ? d.book.errors.nameRequired
                : d.book.errors.generic,
        );
        return;
      }

      clear();
      setDone({ orderNumber: result.orderNumber ?? '' });
    } catch {
      setBanner(d.book.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen scroll>
        <Header title={d.book.successTitle} />
        <View style={styles.success}>
          <View style={[styles.successIcon, { backgroundColor: palette.successSoft }]}>
            <Ionicons name="checkmark-circle" size={46} color={palette.success} />
          </View>
          <Text variant="title" align="center">
            {d.book.successTitle}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {t(d.book.successBody, { orderNumber: done.orderNumber })}
          </Text>
          <Button
            label={d.book.successAction}
            size="lg"
            full
            onPress={() => router.replace('/(tabs)/track')}
            icon="navigate-circle-outline"
          />
          <Button
            label={d.common.close}
            variant="ghost"
            full
            onPress={() => router.replace('/(tabs)/home')}
          />
        </View>
      </Screen>
    );
  }

  if (selections.length === 0) {
    return (
      <Screen scroll>
        <Header title={d.book.title} showBack />
        <Notice tone="info" title={d.book.emptySelection} />
        <Button
          label={d.book.title}
          onPress={() => router.replace('/(tabs)/book')}
          style={styles.spaced}
          full
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title={d.book.yourDetails} showBack />

      <View style={styles.body}>
        <Card>
          <Text variant="bodyStrong">{t(d.book.selected, { count: selections.length })}</Text>
          <View style={styles.summary}>
            {selections.map((item) => (
              <View key={item.refId} style={styles.summaryRow}>
                <Text variant="caption" tone="muted" style={styles.grow} numberOfLines={1}>
                  {localized(item.name, item.nameAr)}
                </Text>
                <Text variant="caption">{item.price ? formatMoney(item.price) : '—'}</Text>
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
        </Card>

        {banner ? <Notice tone="danger" icon="alert-circle-outline" title={banner} /> : null}

        <Input
          label={d.book.name}
          required
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
          }}
          placeholder={d.book.namePlaceholder}
          error={errors.name}
          icon="person-outline"
          autoCapitalize="words"
          textContentType="name"
        />

        <PhoneField
          label={d.book.phone}
          value={phone}
          onChange={(next) => {
            setPhone(next);
            if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
          }}
          error={errors.phone}
        />

        <Input
          label={d.book.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          icon="mail-outline"
        />

        <Text variant="bodyStrong" style={styles.sectionTitle}>
          {d.book.vehicle}
        </Text>

        <View style={styles.row}>
          <Input
            label={d.book.make}
            value={vehicleMake}
            onChangeText={setVehicleMake}
            containerStyle={styles.grow}
            autoCapitalize="words"
          />
          <Input
            label={d.book.model}
            value={vehicleModel}
            onChangeText={setVehicleModel}
            containerStyle={styles.grow}
            autoCapitalize="words"
          />
        </View>

        <Input
          label={d.book.plate}
          value={vehiclePlate}
          onChangeText={setVehiclePlate}
          autoCapitalize="characters"
          icon="car-outline"
        />

        <Input
          label={d.book.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder={d.book.notesPlaceholder}
          multilineRows={4}
        />

        <Button
          label={busy ? d.book.submitting : d.book.submit}
          onPress={submit}
          loading={busy}
          size="lg"
          full
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingBottom: spacing.xl },
  summary: { gap: spacing.xs, marginTop: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  divider: { marginVertical: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  sectionTitle: { marginTop: spacing.sm },
  spaced: { marginTop: spacing.lg },
  success: { gap: spacing.lg, paddingTop: spacing.xxl, alignItems: 'stretch' },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
