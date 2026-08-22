import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Input } from '../../src/ui/Input';
import { Sheet } from '../../src/ui/Sheet';
import { Badge } from '../../src/ui/Badge';
import { PhoneField, type PhoneFieldValue } from '../../src/ui/PhoneField';
import { EmptyState, ErrorState, Notice, SkeletonCard } from '../../src/ui/Feedback';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import {
  confirmSmsNumber,
  registerSmsNumber,
  removeSmsNumber,
  useSmsRegistry,
} from '../../src/data/smsNumbers';
import { useSupervisors } from '../../src/data/team';
import {
  DEFAULT_COUNTRY,
  fromE164,
  isLocalComplete,
  prettyPhone,
  toE164,
} from '../../src/lib/phone';
import { radius, shadow, spacing, fabClearance } from '../../src/theme/tokens';

type Stage =
  | { kind: 'closed' }
  | { kind: 'add' }
  | { kind: 'confirm'; phone: string };

/**
 * Manages which numbers Amazon SNS may text.
 *
 * The AWS concept ("SMS sandbox destination phone numbers") is deliberately
 * never named here. From the admin's side this is simply: add a number, it gets
 * a code, type the code back, done — with the staff who still cannot receive
 * codes surfaced at the top so the list stays honest.
 */
export default function SmsNumbersScreen() {
  const palette = usePalette();
  const { d, t } = useI18n();
  const { user } = useAuth();

  const isAdmin = user?.role === 'ADMIN';
  const registry = useSmsRegistry(isAdmin);
  const staff = useSupervisors(isAdmin);

  const [stage, setStage] = useState<Stage>({ kind: 'closed' });
  const [phone, setPhone] = useState<PhoneFieldValue>({ country: DEFAULT_COUNTRY, local: '' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);

  /*
   * Arriving from "Add phone number" on the supervisor-created alert: open the
   * sheet already filled in, so the admin does not have to re-key a number the
   * app already knows. Guarded by a ref because the param survives re-renders,
   * and without it closing the sheet would immediately reopen it.
   */
  const { phone: prefill } = useLocalSearchParams<{ phone?: string }>();
  const prefilled = useRef(false);
  useEffect(() => {
    if (!prefill || prefilled.current) return;
    prefilled.current = true;
    setPhone(fromE164(prefill));
    setStage({ kind: 'add' });
  }, [prefill]);

  const data = registry.data;
  const numbers = data?.numbers ?? [];
  const inSandbox = data?.inSandbox !== false;

  /* Staff who would never receive a sign-in code — the thing that actually
     breaks, surfaced before anyone hits it.
     Declared before the redirect below: hooks must run in the same order on
     every render, so no hook may sit after a conditional return. */
  const unlisted = useMemo(() => {
    if (!inSandbox) return [];
    const known = new Set(numbers.map((n) => n.phone));
    return (staff.data ?? []).filter((member) => member.phone && !known.has(member.phone));
  }, [numbers, staff.data, inSandbox]);

  if (user && !isAdmin) return <Redirect href="/(staff)/orders" />;

  const close = () => {
    setStage({ kind: 'closed' });
    setPhone({ country: DEFAULT_COUNTRY, local: '' });
    setCode('');
    setBanner(null);
  };

  const run = async (action: () => Promise<{ ok: boolean; message: string; code: string }>) => {
    if (busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const result = await action();
      await registry.refresh();
      if (result.ok) {
        setBanner({ tone: 'success', text: result.message });
        return result;
      }
      setBanner({ tone: 'danger', text: result.message });
      return result;
    } catch (err) {
      setBanner({ tone: 'danger', text: err instanceof Error ? err.message : d.common.somethingWentWrong });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e164: string) => {
    const result = await run(() => registerSmsNumber(e164));
    if (result?.ok) setStage({ kind: 'confirm', phone: e164 });
  };

  const confirm = async () => {
    if (stage.kind !== 'confirm') return;
    const result = await run(() => confirmSmsNumber(stage.phone, code));
    if (result?.ok) close();
  };

  const remove = (target: string) => {
    Alert.alert(d.sms.removeTitle, d.sms.removeBody, [
      { text: d.common.cancel, style: 'cancel' },
      {
        text: d.common.remove,
        style: 'destructive',
        onPress: () => void run(() => removeSmsNumber(target)),
      },
    ]);
  };

  return (
    <Screen>
      <Header title={d.sms.title} subtitle={d.sms.subtitle} showBack />

      {registry.loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : registry.error ? (
        <ErrorState
          message={d.common.somethingWentWrong}
          onRetry={registry.refresh}
          retryLabel={d.common.retry}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={registry.refreshing}
              onRefresh={registry.refresh}
              tintColor={palette.textMuted}
              colors={[palette.primary]}
              progressBackgroundColor={palette.surface}
            />
          }
        >
          {banner ? (
            <Notice
              tone={banner.tone}
              icon={banner.tone === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              title={banner.text}
            />
          ) : null}

          {!inSandbox ? (
            <Notice
              tone="success"
              icon="checkmark-circle-outline"
              title={d.sms.productionTitle}
              body={d.sms.productionBody}
            />
          ) : (
            <Notice
              tone="info"
              icon="information-circle-outline"
              title={d.sms.explainerTitle}
              body={d.sms.explainerBody}
            />
          )}

          {/* The failure that actually bites: staff who cannot receive a code. */}
          {unlisted.length > 0 ? (
            <Card onPress={() => void addAll(unlisted, add)} elevation={2}>
              <View style={styles.row}>
                <View style={[styles.warnIcon, { backgroundColor: palette.warningSoft }]}>
                  <Ionicons name="warning-outline" size={20} color={palette.warning} />
                </View>
                <View style={styles.grow}>
                  <Text variant="bodyStrong" tone="warning">
                    {t(d.sms.staffNotListed, { count: unlisted.length })}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {d.sms.staffNotListedBody}
                  </Text>
                </View>
              </View>
              <View style={styles.unlisted}>
                {unlisted.slice(0, 4).map((member) => (
                  <Text key={member.id} variant="micro" tone="faint">
                    {member.name} · {prettyPhone(member.phone)}
                  </Text>
                ))}
              </View>
            </Card>
          ) : null}

          {inSandbox && numbers.length === 0 ? (
            <EmptyState
              icon="call-outline"
              title={d.sms.empty}
              body={d.sms.emptyBody}
              actionLabel={d.sms.addTitle}
              onAction={() => setStage({ kind: 'add' })}
            />
          ) : null}

          {numbers.map((entry) => {
            const verified = entry.status === 'Verified';
            return (
              <Card
                key={entry.phone}
                onPress={verified ? undefined : () => setStage({ kind: 'confirm', phone: entry.phone })}
              >
                <View style={styles.row}>
                  <View
                    style={[
                      styles.statusIcon,
                      { backgroundColor: verified ? palette.successSoft : palette.warningSoft },
                    ]}
                  >
                    <Ionicons
                      name={verified ? 'checkmark-circle' : 'time-outline'}
                      size={20}
                      color={verified ? palette.success : palette.warning}
                    />
                  </View>

                  <View style={styles.grow}>
                    <Text variant="subheading">{prettyPhone(entry.phone)}</Text>
                    <Text variant="caption" tone="muted">
                      {verified ? d.sms.statusVerified : d.sms.pendingHint}
                    </Text>
                  </View>

                  <Badge
                    label={verified ? d.sms.statusVerified : d.sms.statusPending}
                    tone={verified ? 'success' : 'warning'}
                  />
                </View>

                <View style={styles.cardActions}>
                  {!verified ? (
                    <Button
                      label={d.sms.confirmAction}
                      size="sm"
                      icon="key-outline"
                      onPress={() => setStage({ kind: 'confirm', phone: entry.phone })}
                    />
                  ) : null}
                  <Button
                    label={d.common.remove}
                    size="sm"
                    variant="ghost"
                    icon="trash-outline"
                    onPress={() => remove(entry.phone)}
                  />
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {inSandbox ? (
        <Pressable
          onPress={() => setStage({ kind: 'add' })}
          accessibilityRole="button"
          accessibilityLabel={d.sms.addTitle}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: palette.primary, opacity: pressed ? 0.9 : 1 },
            shadow(3, palette),
          ]}
        >
          <Ionicons name="add" size={26} color={palette.onPrimary} />
        </Pressable>
      ) : null}

      {/* Add */}
      <Sheet
        visible={stage.kind === 'add'}
        onClose={close}
        title={d.sms.addTitle}
        subtitle={d.sms.addHint}
        footer={
          <Button
            label={d.sms.addAction}
            loading={busy}
            disabled={!isLocalComplete(phone.local, phone.country)}
            full
            icon="send-outline"
            onPress={() => {
              const e164 = toE164(phone.local, phone.country);
              if (e164) void add(e164);
            }}
          />
        }
      >
        {banner ? <Notice tone={banner.tone} title={banner.text} /> : null}
        <PhoneField label={d.auth.phoneLabel} value={phone} onChange={setPhone} />
      </Sheet>

      {/* Confirm */}
      <Sheet
        visible={stage.kind === 'confirm'}
        onClose={close}
        title={d.sms.confirmTitle}
        subtitle={
          stage.kind === 'confirm'
            ? t(d.sms.confirmSubtitle, { phone: prettyPhone(stage.phone) })
            : undefined
        }
        footer={
          <>
            <Button
              label={d.sms.confirmAction}
              loading={busy}
              disabled={code.replace(/\D/g, '').length < 4}
              full
              onPress={confirm}
            />
            <Button
              label={d.sms.resend}
              variant="ghost"
              full
              onPress={() => stage.kind === 'confirm' && void run(() => registerSmsNumber(stage.phone))}
            />
          </>
        }
      >
        {banner ? <Notice tone={banner.tone} title={banner.text} /> : null}
        <Input
          label={d.sms.codeLabel}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={10}
          icon="key-outline"
          autoFocus
        />
      </Sheet>
    </Screen>
  );
}

/** Registers every staff number that is missing, one after another. */
const addAll = async (
  members: { phone: string }[],
  add: (phone: string) => Promise<void>,
) => {
  for (const member of members) {
    if (member.phone) await add(member.phone);
  }
};

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: fabClearance },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: 1 },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlisted: { gap: 2, marginTop: spacing.md },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
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
