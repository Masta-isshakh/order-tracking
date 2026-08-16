import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/tokens';
import { Text } from './Text';
import { Button } from './Button';

/** Shimmering placeholder used while a list loads for the first time. */
export const Skeleton = ({
  height = 16,
  width = '100%',
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
}) => {
  const palette = usePalette();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [pulse]);

  // Explicit `return`: the worklets Babel plugin cannot parse a concise arrow
  // body that returns an object literal.
  const animated = useAnimatedStyle(() => {
    return { opacity: pulse.value };
  });

  return (
    <Animated.View
      style={[
        { height, width, backgroundColor: palette.skeleton, borderRadius: radius.sm },
        animated,
        style,
      ]}
    />
  );
};

export const SkeletonCard = () => {
  const palette = usePalette();
  return (
    <View
      style={[
        styles.skeletonCard,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Skeleton height={14} width="45%" />
      <Skeleton height={20} width="75%" />
      <Skeleton height={12} width="60%" />
    </View>
  );
};

export const EmptyState = ({
  icon = 'file-tray-outline',
  title,
  body,
  actionLabel,
  onAction,
  style,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) => {
  const palette = usePalette();
  return (
    <View style={[styles.empty, style]}>
      <View style={[styles.emptyIcon, { backgroundColor: palette.surfaceAlt }]}>
        <Ionicons name={icon} size={30} color={palette.textFaint} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="muted" align="center">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
};

export const ErrorState = ({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel: string;
}) => (
  <EmptyState
    icon="cloud-offline-outline"
    title={message}
    actionLabel={onRetry ? retryLabel : undefined}
    onAction={onRetry}
  />
);

export const Loader = ({ label }: { label?: string }) => {
  const palette = usePalette();
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={palette.primary} />
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
};

/** Inline banner for non-blocking problems (offline, partial failure). */
export const Notice = ({
  tone = 'info',
  icon = 'information-circle-outline',
  title,
  body,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
}) => {
  const palette = usePalette();
  const map = {
    info: { bg: palette.infoSoft, fg: palette.info },
    warning: { bg: palette.warningSoft, fg: palette.warning },
    danger: { bg: palette.dangerSoft, fg: palette.danger },
    success: { bg: palette.successSoft, fg: palette.success },
  }[tone];

  return (
    <View style={[styles.notice, { backgroundColor: map.bg }]}>
      <Ionicons name={icon} size={18} color={map.fg} style={styles.noticeIcon} />
      <View style={styles.noticeBody}>
        <Text variant="bodyStrong" color={map.fg}>
          {title}
        </Text>
        {body ? (
          <Text variant="caption" color={map.fg}>
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeIcon: { marginTop: 2 },
  noticeBody: { flex: 1, gap: 2 },
});
