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
  /** Extra bottom room so a floating action button never covers content. */
  bottomInset?: number;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
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
  const paddingBottom = (edges?.bottom === false ? 0 : insets.bottom) + bottomInset;

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
            contentContainerStyle={{ paddingBottom: paddingBottom + spacing.xl }}
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
