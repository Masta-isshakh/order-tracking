import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n, useLocalizedName } from '../i18n/I18nProvider';
import { radius, shadow, spacing } from '../theme/tokens';
import { Text } from './Text';
import { StorageImage } from './StorageImage';
import type { StepStatus } from '../../shared/domain';

export type RoadmapStep = {
  id: string;
  sortOrder: number;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  sourceName?: string | null;
  status: string;
  imageKeys?: (string | null)[] | null;
  note?: string | null;
  completedAt?: string | null;
  completedByName?: string | null;
};

const NODE = 34;
const RAIL = 2;

/** Soft pulse on the active node so the eye lands on "where is my car now?". */
const PulseRing = ({ color }: { color: string }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  // Explicit `return` rather than a concise arrow body: the Reanimated worklets
  // Babel plugin fails to parse `() => ({ ... })` and reports a bogus
  // "Missing semicolon" at bundle time.
  const style = useAnimatedStyle(() => {
    return {
      opacity: 0.45 * (1 - progress.value),
      transform: [{ scale: 1 + progress.value * 0.85 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pulse, { borderColor: color, width: NODE, height: NODE }, style]}
    />
  );
};

const StepNode = ({ status, index }: { status: StepStatus; index: number }) => {
  const palette = usePalette();

  if (status === 'COMPLETED') {
    return (
      <View style={[styles.node, { backgroundColor: palette.success, borderColor: palette.success }]}>
        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
      </View>
    );
  }

  if (status === 'IN_PROGRESS') {
    return (
      <View style={styles.nodeWrap}>
        <PulseRing color={palette.primary} />
        <View style={[styles.node, { backgroundColor: palette.primary, borderColor: palette.primary }]}>
          <Ionicons name="build" size={15} color={palette.onPrimary} />
        </View>
      </View>
    );
  }

  if (status === 'SKIPPED') {
    return (
      <View style={[styles.node, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
        <Ionicons name="remove" size={16} color={palette.textFaint} />
      </View>
    );
  }

  return (
    <View style={[styles.node, { backgroundColor: palette.surface, borderColor: palette.borderStrong }]}>
      <Text variant="caption" tone="faint">
        {index + 1}
      </Text>
    </View>
  );
};

/**
 * Vertical progress roadmap.
 *
 * Reads top-to-bottom in both languages; only the rail swaps sides, which the
 * parent's `direction: rtl` handles for free. Completed steps carry their photos
 * so the customer can see the work rather than just read a label.
 */
export const Roadmap = ({
  steps,
  onStepPress,
  renderActions,
  onImagePress,
}: {
  steps: RoadmapStep[];
  onStepPress?: (step: RoadmapStep) => void;
  renderActions?: (step: RoadmapStep) => React.ReactNode;
  onImagePress?: (key: string, step: RoadmapStep) => void;
}) => {
  const palette = usePalette();
  const { d, formatDate } = useI18n();
  const localized = useLocalizedName();

  const ordered = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View style={styles.list}>
      {ordered.map((step, index) => {
        const status = (step.status as StepStatus) ?? 'PENDING';
        const isLast = index === ordered.length - 1;
        const done = status === 'COMPLETED';
        const active = status === 'IN_PROGRESS';
        const images = (step.imageKeys ?? []).filter((key): key is string => !!key);

        // The rail below a node is "reached" only once that step is finished.
        const railColor = done ? palette.success : palette.border;

        return (
          <View key={step.id} style={styles.row}>
            <View style={styles.rail}>
              <StepNode status={status} index={index} />
              {!isLast ? (
                <View style={[styles.railLine, { backgroundColor: railColor }]} />
              ) : null}
            </View>

            <Pressable
              onPress={onStepPress ? () => onStepPress(step) : undefined}
              disabled={!onStepPress}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: active ? palette.primarySoft : palette.surface,
                  borderColor: active ? palette.primary : palette.border,
                  borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                  opacity: pressed ? 0.92 : status === 'PENDING' ? 0.85 : 1,
                  marginBottom: isLast ? 0 : spacing.md,
                },
                done || active ? shadow(1, palette) : null,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitle}>
                  <Text variant="micro" tone="faint">
                    {`${d.common.step} ${index + 1} ${d.common.of} ${ordered.length}`}
                  </Text>
                  <Text variant="subheading" numberOfLines={2}>
                    {localized(step.name, step.nameAr)}
                  </Text>
                  {step.sourceName ? (
                    <Text variant="micro" tone="faint" numberOfLines={1}>
                      {step.sourceName}
                    </Text>
                  ) : null}
                </View>
                {active ? (
                  <View style={[styles.livePill, { backgroundColor: palette.primary }]}>
                    <Text variant="micro" color={palette.onPrimary}>
                      {d.track.currentStep}
                    </Text>
                  </View>
                ) : null}
              </View>

              {step.description ? (
                <Text variant="caption" tone="muted">
                  {step.description}
                </Text>
              ) : null}

              {step.note ? (
                <View style={[styles.note, { backgroundColor: palette.surfaceAlt }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={palette.textMuted} />
                  <Text variant="caption" tone="muted" style={styles.grow}>
                    {step.note}
                  </Text>
                </View>
              ) : null}

              {images.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.gallery}
                >
                  {images.map((key) => (
                    <Pressable
                      key={key}
                      onPress={onImagePress ? () => onImagePress(key, step) : undefined}
                      disabled={!onImagePress}
                    >
                      <StorageImage storageKey={key} style={styles.thumb} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              {done && step.completedAt ? (
                <Text variant="micro" tone="faint">
                  {`${d.track.stepCompleted} · ${formatDate(step.completedAt, true)}`}
                  {step.completedByName ? ` · ${step.completedByName}` : ''}
                </Text>
              ) : null}

              {renderActions ? <View style={styles.actions}>{renderActions(step)}</View> : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
};

/** Slim progress bar used in list rows and the tracking header. */
export const ProgressBar = ({
  done,
  total,
  tone,
}: {
  done: number;
  total: number;
  tone?: string;
}) => {
  const palette = usePalette();
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  return (
    <View style={[styles.progressTrack, { backgroundColor: palette.surfaceAlt }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${ratio * 100}%`, backgroundColor: tone ?? palette.primary },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: NODE, alignItems: 'center' },
  railLine: { width: RAIL, flex: 1, marginVertical: 4, borderRadius: RAIL },
  nodeWrap: { alignItems: 'center', justifyContent: 'center' },
  pulse: { position: 'absolute', borderRadius: radius.pill, borderWidth: 2 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { flex: 1, gap: 2 },
  livePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  grow: { flex: 1 },
  gallery: { gap: spacing.sm, paddingVertical: 2 },
  thumb: { width: 84, height: 64 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  progressTrack: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
});
