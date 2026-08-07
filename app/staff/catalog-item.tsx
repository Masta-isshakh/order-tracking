import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Input } from '../../src/ui/Input';
import { Notice, Loader } from '../../src/ui/Feedback';
import { ImagesField } from '../../src/ui/ImagesField';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { client, must } from '../../src/lib/amplify';
import {
  createPackage,
  createService,
  deletePackage,
  deleteService,
  draftFromItem,
  emptyDraft,
  updatePackage,
  updateService,
  type CatalogDraft,
} from '../../src/data/catalog';
import { radius, spacing } from '../../src/theme/tokens';

/**
 * Editor for one service or package.
 *
 * The step list is the important part: it becomes the roadmap every customer
 * watches, so it is edited inline with explicit ordering rather than hidden
 * behind another screen.
 */
export default function CatalogItemScreen() {
  const { kind = 'service', id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const router = useRouter();
  const palette = usePalette();
  const { d } = useI18n();
  const { user } = useAuth();

  const isPackage = kind === 'package';
  const isNew = !id;

  const [draft, setDraft] = useState<CatalogDraft>(emptyDraft());
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        // Read each model on its own branch: Service and Package have different
        // field sets, so a shared `must()` call would collapse them into a union
        // that neither type satisfies.
        const item = isPackage
          ? must(await client.models.Package.get({ id: id! }), 'read package')
          : must(await client.models.Service.get({ id: id! }), 'read service');
        if (!cancelled && item) setDraft(draftFromItem(item));
      } catch (err) {
        if (!cancelled) setBanner(err instanceof Error ? err.message : d.common.somethingWentWrong);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, isPackage, d]);

  const patch = (changes: Partial<CatalogDraft>) => setDraft((current) => ({ ...current, ...changes }));

  const addStep = () =>
    patch({
      steps: [...draft.steps, { key: `step-${Date.now()}`, name: '', nameAr: '', description: null }],
    });

  const updateStep = (index: number, changes: Partial<CatalogDraft['steps'][number]>) =>
    patch({
      steps: draft.steps.map((step, i) => (i === index ? { ...step, ...changes } : step)),
    });

  const removeStep = (index: number) =>
    patch({ steps: draft.steps.filter((_, i) => i !== index) });

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.steps.length) return;
    const next = [...draft.steps];
    [next[index], next[target]] = [next[target], next[index]];
    patch({ steps: next });
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setNameError(d.catalog.nameRequired);
      return;
    }
    if (!user) return;

    setBusy(true);
    setBanner(null);
    try {
      const cleaned: CatalogDraft = {
        ...draft,
        steps: draft.steps.filter((step) => step.name.trim()),
      };
      const actor = { sub: user.sub, name: user.name };

      if (isPackage) {
        if (isNew) await createPackage(cleaned, actor);
        else await updatePackage(id!, cleaned, actor);
      } else if (isNew) {
        await createService(cleaned, actor);
      } else {
        await updateService(id!, cleaned, actor);
      }
      router.back();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : d.common.somethingWentWrong);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      isPackage ? d.catalog.deletePackageTitle : d.catalog.deleteServiceTitle,
      d.catalog.deleteBody,
      [
        { text: d.common.cancel, style: 'cancel' },
        {
          text: d.common.delete,
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              if (isPackage) await deletePackage(id!);
              else await deleteService(id!);
              router.back();
            } catch (err) {
              setBanner(err instanceof Error ? err.message : d.common.somethingWentWrong);
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen>
        <Header title={d.catalog.title} showBack />
        <Loader label={d.common.loading} />
      </Screen>
    );
  }

  const title = isNew
    ? isPackage
      ? d.catalog.newPackage
      : d.catalog.newService
    : isPackage
      ? d.catalog.editPackage
      : d.catalog.editService;

  return (
    <Screen>
      <Header
        title={title}
        showBack
        actions={
          isNew
            ? []
            : [{ icon: 'trash-outline', label: d.common.delete, onPress: confirmDelete, tone: 'danger' }]
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {banner ? <Notice tone="danger" icon="alert-circle-outline" title={banner} /> : null}

        <ImagesField
          label={d.catalog.image}
          folder="catalog"
          value={draft.imageKey ? [draft.imageKey] : []}
          onChange={(next) => patch({ imageKey: next[0] ?? null })}
          max={1}
        />

        <Input
          label={d.catalog.name}
          value={draft.name}
          onChangeText={(text) => {
            patch({ name: text });
            if (nameError) setNameError(null);
          }}
          error={nameError}
          required
        />
        <Input
          label={d.catalog.nameAr}
          value={draft.nameAr}
          onChangeText={(text) => patch({ nameAr: text })}
        />
        <Input
          label={d.catalog.description}
          value={draft.description}
          onChangeText={(text) => patch({ description: text })}
          multilineRows={3}
        />
        <Input
          label={d.catalog.descriptionAr}
          value={draft.descriptionAr}
          onChangeText={(text) => patch({ descriptionAr: text })}
          multilineRows={3}
        />

        <View style={styles.row}>
          <Input
            label={d.catalog.price}
            value={draft.price}
            onChangeText={(text) => patch({ price: text.replace(/[^0-9.]/g, '') })}
            keyboardType="decimal-pad"
            containerStyle={styles.grow}
            icon="cash-outline"
          />
          <Input
            label={d.catalog.duration}
            value={draft.durationMinutes}
            onChangeText={(text) => patch({ durationMinutes: text.replace(/\D/g, '') })}
            keyboardType="number-pad"
            containerStyle={styles.grow}
            icon="time-outline"
          />
        </View>

        {!isPackage ? (
          <Input
            label={d.catalog.category}
            value={draft.category}
            onChangeText={(text) => patch({ category: text })}
            icon="pricetag-outline"
          />
        ) : null}

        <Card>
          <View style={styles.switchRow}>
            <View style={styles.grow}>
              <Text variant="bodyStrong">{d.catalog.visible}</Text>
            </View>
            <Switch
              value={draft.isActive}
              onValueChange={(value) => patch({ isActive: value })}
              trackColor={{ false: palette.borderStrong, true: palette.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Steps */}
        <View style={styles.stepsHeader}>
          <View style={styles.grow}>
            <Text variant="heading">{d.catalog.steps}</Text>
            <Text variant="micro" tone="faint">
              {d.catalog.stepsHint}
            </Text>
          </View>
          <Button label={d.catalog.addStep} size="sm" variant="secondary" icon="add" onPress={addStep} />
        </View>

        {draft.steps.length === 0 ? (
          <Notice tone="warning" icon="git-commit-outline" title={d.catalog.noSteps} />
        ) : null}

        {draft.steps.map((step, index) => (
          <Card key={step.key} padded={false} style={styles.stepCard}>
            <View style={styles.stepHead}>
              <View style={[styles.stepIndex, { backgroundColor: palette.primarySoft }]}>
                <Text variant="caption" tone="primary">
                  {index + 1}
                </Text>
              </View>

              <View style={styles.stepControls}>
                <StepIconButton
                  icon="arrow-up"
                  disabled={index === 0}
                  onPress={() => moveStep(index, -1)}
                />
                <StepIconButton
                  icon="arrow-down"
                  disabled={index === draft.steps.length - 1}
                  onPress={() => moveStep(index, 1)}
                />
                <StepIconButton icon="trash-outline" tone="danger" onPress={() => removeStep(index)} />
              </View>
            </View>

            <View style={styles.stepBody}>
              <Input
                value={step.name}
                onChangeText={(text) => updateStep(index, { name: text })}
                placeholder={d.catalog.stepPlaceholder}
              />
              <Input
                value={step.nameAr ?? ''}
                onChangeText={(text) => updateStep(index, { nameAr: text })}
                placeholder={d.catalog.stepPlaceholderAr}
              />
            </View>
          </Card>
        ))}

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

const StepIconButton = ({
  icon,
  onPress,
  disabled = false,
  tone = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) => {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      style={[
        styles.stepIconButton,
        {
          backgroundColor: tone === 'danger' ? palette.dangerSoft : palette.surfaceAlt,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={15}
        color={tone === 'danger' ? palette.danger : palette.textMuted}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  stepCard: { padding: spacing.md, gap: spacing.md },
  stepHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepIndex: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepControls: { flexDirection: 'row', gap: spacing.xs },
  stepIconButton: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: { gap: spacing.sm },
  save: { marginTop: spacing.md },
});
