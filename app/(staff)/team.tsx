import React, { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Redirect } from 'expo-router';
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
import { createSupervisor, removeSupervisor, setSupervisorAccess, useSupervisors } from '../../src/data/team';
import { DEFAULT_COUNTRY, isLocalComplete, prettyPhone, toE164 } from '../../src/lib/phone';
import { radius, shadow, spacing } from '../../src/theme/tokens';

/** Admin-only: create supervisors and control their access. */
export default function TeamScreen() {
  const palette = usePalette();
  const { d } = useI18n();
  const { user } = useAuth();
  const supervisors = useSupervisors(user?.role === 'ADMIN');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState<PhoneFieldValue>({ country: DEFAULT_COUNTRY, local: '' });
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  if (user && user.role !== 'ADMIN') return <Redirect href="/(staff)/orders" />;

  const reset = () => {
    setName('');
    setPhone({ country: DEFAULT_COUNTRY, local: '' });
    setEmail('');
    setDescription('');
    setBanner(null);
  };

  const submit = async () => {
    const e164 = toE164(phone.local, phone.country);
    if (!name.trim()) {
      setBanner(d.team.errors.nameRequired);
      return;
    }
    if (!e164 || !isLocalComplete(phone.local, phone.country)) {
      setBanner(d.team.errors.invalidPhone);
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      const result = await createSupervisor({ name, phone: e164, email, description });
      if (!result.ok) {
        setBanner(
          result.code === 'ALREADY_EXISTS'
            ? d.team.errors.alreadyExists
            : result.code === 'INVALID_PHONE'
              ? d.team.errors.invalidPhone
              : result.code === 'NAME_REQUIRED'
                ? d.team.errors.nameRequired
                : d.team.errors.generic,
        );
        return;
      }
      setSheetOpen(false);
      reset();
      await supervisors.refresh();
    } catch {
      setBanner(d.team.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const toggleAccess = async (id: string, isActive: boolean) => {
    try {
      await setSupervisorAccess(id, isActive);
      await supervisors.refresh();
    } catch {
      Alert.alert(d.common.somethingWentWrong, d.common.tryAgain);
    }
  };

  const confirmRemove = (id: string) => {
    Alert.alert(d.team.deleteTitle, d.team.deleteBody, [
      { text: d.common.cancel, style: 'cancel' },
      {
        text: d.common.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await removeSupervisor(id);
            await supervisors.refresh();
          } catch {
            Alert.alert(d.common.somethingWentWrong, d.common.tryAgain);
          }
        },
      },
    ]);
  };

  const list = supervisors.data ?? [];

  return (
    <Screen bottomInset={80}>
      <Header title={d.team.title} />

      {supervisors.loading ? (
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : supervisors.error ? (
        <ErrorState
          message={d.common.somethingWentWrong}
          onRetry={supervisors.refresh}
          retryLabel={d.common.retry}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={d.team.empty}
          body={d.team.emptyBody}
          actionLabel={d.team.add}
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={supervisors.refreshing}
              onRefresh={supervisors.refresh}
              tintColor={palette.textMuted}
              colors={[palette.primary]}
              progressBackgroundColor={palette.surface}
            />
          }
        >
          {list.map((supervisor) => (
            <Card key={supervisor.id}>
              <View style={styles.cardHead}>
                <View style={[styles.avatar, { backgroundColor: palette.primarySoft }]}>
                  <Text variant="subheading" tone="primary">
                    {supervisor.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.grow}>
                  <Text variant="subheading" numberOfLines={1}>
                    {supervisor.name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {prettyPhone(supervisor.phone)}
                  </Text>
                  {supervisor.description ? (
                    <Text variant="micro" tone="faint" numberOfLines={1}>
                      {supervisor.description}
                    </Text>
                  ) : null}
                </View>

                <Badge
                  label={supervisor.isActive === false ? d.team.accessOff : d.team.accessOn}
                  tone={supervisor.isActive === false ? 'warning' : 'success'}
                />
              </View>

              <View style={styles.cardActions}>
                <View style={styles.switchRow}>
                  <Text variant="caption" tone="muted">
                    {d.common.enabled}
                  </Text>
                  <Switch
                    value={supervisor.isActive !== false}
                    onValueChange={(value) => void toggleAccess(supervisor.id, value)}
                    trackColor={{ false: palette.borderStrong, true: palette.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <Button
                  label={d.common.remove}
                  size="sm"
                  variant="ghost"
                  icon="trash-outline"
                  onPress={() => confirmRemove(supervisor.id)}
                />
              </View>
            </Card>
          ))}
        </ScrollView>
      )}

      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={d.team.add}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: palette.primary, opacity: pressed ? 0.9 : 1 },
          shadow(3, palette),
        ]}
      >
        <Ionicons name="person-add" size={22} color={palette.onPrimary} />
      </Pressable>

      <Sheet
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          reset();
        }}
        title={d.team.add}
        subtitle={d.team.phoneHint}
        footer={
          <Button
            label={busy ? d.common.saving : d.common.create}
            onPress={submit}
            loading={busy}
            full
          />
        }
      >
        {banner ? <Notice tone="danger" icon="alert-circle-outline" title={banner} /> : null}
        <Input label={d.team.name} value={name} onChangeText={setName} required autoCapitalize="words" />
        <PhoneField label={d.team.phone} value={phone} onChange={setPhone} />
        <Input
          label={d.team.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input label={d.team.description} value={description} onChangeText={setDescription} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1, gap: 1 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
