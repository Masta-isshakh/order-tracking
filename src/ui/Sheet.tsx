import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme/ThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import { radius, shadow, spacing } from '../theme/tokens';
import { Text } from './Text';

/**
 * Bottom sheet used for every "do one thing" flow: put an order on hold, rename
 * a step, add a supervisor. Keeps the underlying list visible for context.
 */
export const Sheet = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
}) => {
  const palette = usePalette();
  const { dir } = useI18n();
  const insets = useSafeAreaInsets();

  const body = <View style={styles.body}>{children}</View>;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: palette.overlay }]}
          onPress={onClose}
          accessibilityLabel="Close"
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: palette.surface,
                direction: dir,
                paddingBottom: insets.bottom + spacing.lg,
              },
              shadow(3, palette),
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.grabber, { backgroundColor: palette.borderStrong }]} />

            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text variant="heading">{title}</Text>
                {subtitle ? (
                  <Text variant="caption" tone="muted">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.close, { backgroundColor: palette.surfaceAlt }]}
              >
                <Ionicons name="close" size={18} color={palette.textMuted} />
              </Pressable>
            </View>

            {scroll ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.scroll}
              >
                {body}
              </ScrollView>
            ) : (
              body
            )}

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
  },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  headerText: { flex: 1, gap: 2 },
  close: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexShrink: 1 },
  body: { gap: spacing.lg, paddingBottom: spacing.lg },
  footer: { gap: spacing.sm, paddingTop: spacing.sm },
});
