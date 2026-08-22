import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { spacing } from '../theme/tokens';

type ScreenProps = {
  children: React.ReactNode;
  /** Wraps children in a ScrollView. Turn off for FlatList-based screens. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Adds the standard horizontal gutter. */
  padded?: boolean;
  /**
   * Extra scroll room under the last item, so a floating button cannot cover
   * it. Applies to this screen's own ScrollView, i.e. only when `scroll`.
   *
   * A screen that scrolls a list of its own pads that list instead. Do not add
   * the room by shrinking this container: anything the screen positions
   * absolutely — a FAB, a sticky bar — is measured against the container, so
   * shrinking it lifts that element off the bottom of the screen too.
   */
  bottomInset?: number;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /**
   * Which system insets to pad for. Screens inside a tab navigator must pass
   * `bottom: false` — the tab bar already sits in that strip, so padding for it
   * again just opens a dead band above the bar.
   */
  edges?: { top?: boolean; bottom?: boolean };
};

/**
 * Page shell: safe-area padding, themed background, RTL direction and — when
 * asked — pull-to-refresh. `direction` on this root is what flips the whole
 * layout for Arabic without needing a native restart.
 */
export const Screen = ({
  children,
  scroll = false,
  refreshing = false,
  onRefresh,
  padded = true,
  bottomInset = 0,
  style,
  contentStyle,
  edges,
}: ScreenProps) => {
  const palette = usePalette();
  const { dir } = useI18n();
  const insets = useSafeAreaInsets();

  const paddingTop = edges?.top === false ? 0 : insets.top;
  const paddingBottom = edges?.bottom === false ? 0 : insets.bottom;

  const body = (
    <View
      style={[
        styles.body,
        padded ? { paddingHorizontal: spacing.lg } : null,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View
      style={[styles.root, { backgroundColor: palette.bg, direction: dir, paddingTop }, style]}
    >
      <StatusBar style={palette.mode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? paddingTop : 0}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={{ paddingBottom: paddingBottom + bottomInset + spacing.xl }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={palette.textMuted}
                  colors={[palette.primary]}
                  progressBackgroundColor={palette.surface}
                />
              ) : undefined
            }
          >
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.flex, { paddingBottom }]}>{body}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  body: { flex: 1 },
});
