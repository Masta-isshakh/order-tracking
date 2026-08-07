import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/ui/Screen';
import { Header } from '../../src/ui/Header';
import { Text } from '../../src/ui/Text';
import { EmptyState, Loader } from '../../src/ui/Feedback';
import { StorageImage } from '../../src/ui/StorageImage';
import { usePalette } from '../../src/theme/ThemeProvider';
import { useI18n } from '../../src/i18n/I18nProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { useOrderChat, markThreadRead, sendMessage } from '../../src/data/chat';
import { useOrderDetail } from '../../src/data/orders';
import { pickImages, uploadImage } from '../../src/lib/media';
import { radius, spacing, typography } from '../../src/theme/tokens';
import type { ChatMessage } from '../../src/lib/amplify';

/**
 * Live conversation between a customer and the Stars team, scoped to one order.
 * The same screen serves both sides; only the bubble alignment differs.
 */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const { d, formatRelative, isRTL } = useI18n();
  const { user } = useAuth();
  const chat = useOrderChat(id);
  const detail = useOrderDetail(id);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const messages = chat.data ?? [];
  const viewerIsStaff = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const order = detail.data?.order;

  // Clear the other side's unread flags once the thread is on screen.
  useEffect(() => {
    if (messages.length === 0 || !user) return;
    void markThreadRead(messages, viewerIsStaff);
  }, [messages, user, viewerIsStaff]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const send = async (imageKey?: string) => {
    const body = draft.trim();
    if ((!body && !imageKey) || !user || !id || sending) return;

    setSending(true);
    setDraft('');
    try {
      await sendMessage({
        orderId: id,
        customerOwner: order?.customerOwner,
        body,
        imageKey,
        actor: user,
      });
    } catch {
      // Restore the text so the message is not lost.
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  const attach = async () => {
    if (sending) return;
    const [uri] = await pickImages();
    if (!uri) return;
    setSending(true);
    try {
      const key = await uploadImage(uri, 'chat');
      await sendMessage({
        orderId: id!,
        customerOwner: order?.customerOwner,
        body: '',
        imageKey: key,
        actor: user!,
      });
    } catch {
      // Swallowed: the thread stays usable and the user can retry.
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <Screen>
        <Header title={d.chat.title} showBack />
        <EmptyState icon="lock-closed-outline" title={d.auth.gateTitle} body={d.auth.gateSubtitle} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <Header
          title={d.chat.title}
          subtitle={order ? `${order.orderNumber} · ${order.customerName}` : undefined}
          showBack
        />
      </View>

      {chat.loading ? (
        <Loader label={d.common.loading} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState icon="chatbubbles-outline" title={d.chat.empty} body={d.chat.emptyBody} />
          }
          renderItem={({ item }) => {
            const mine = item.senderSub === user.sub;
            const fromStaff = item.senderRole === 'ADMIN' || item.senderRole === 'SUPERVISOR';
            return (
              <View
                style={[
                  styles.bubbleRow,
                  { justifyContent: mine ? 'flex-end' : 'flex-start' },
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: mine ? palette.primary : palette.surface,
                      borderColor: mine ? palette.primary : palette.border,
                      borderStartWidth: !mine ? 3 : StyleSheet.hairlineWidth,
                      borderStartColor: !mine ? palette.accent : palette.border,
                    },
                  ]}
                >
                  {!mine ? (
                    <Text variant="micro" color={palette.textMuted}>
                      {fromStaff ? d.chat.staff : item.senderName || d.orders.customer}
                    </Text>
                  ) : null}

                  {item.imageKey ? (
                    <StorageImage storageKey={item.imageKey} style={styles.image} />
                  ) : null}

                  {item.body ? (
                    <Text
                      variant="body"
                      color={mine ? palette.onPrimary : palette.text}
                      style={styles.bubbleText}
                    >
                      {item.body}
                    </Text>
                  ) : null}

                  <Text
                    variant="micro"
                    color={mine ? palette.onPrimary : palette.textFaint}
                    align={isRTL ? 'start' : 'end'}
                    style={mine ? styles.myTimestamp : undefined}
                  >
                    {formatRelative(item.createdAtIso)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View
        style={[
          styles.composer,
          { backgroundColor: palette.surface, borderTopColor: palette.border },
        ]}
      >
        <Pressable
          onPress={attach}
          disabled={sending}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={d.chat.attachImage}
          style={[styles.iconButton, { backgroundColor: palette.surfaceAlt }]}
        >
          <Ionicons name="image-outline" size={19} color={palette.textMuted} />
        </Pressable>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={d.chat.placeholder}
          placeholderTextColor={palette.textFaint}
          selectionColor={palette.primary}
          keyboardAppearance={palette.mode === 'dark' ? 'dark' : 'light'}
          multiline
          style={[
            styles.input,
            typography.body,
            {
              color: palette.text,
              backgroundColor: palette.surfaceAlt,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
          ]}
        />

        <Pressable
          onPress={() => void send()}
          disabled={sending || !draft.trim()}
          accessibilityRole="button"
          accessibilityLabel={d.chat.send}
          style={[
            styles.iconButton,
            {
              backgroundColor: draft.trim() ? palette.primary : palette.surfaceAlt,
              opacity: sending ? 0.6 : 1,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color={palette.onPrimary} />
          ) : (
            <Ionicons
              name={isRTL ? 'send' : 'send'}
              size={17}
              color={draft.trim() ? palette.onPrimary : palette.textFaint}
            />
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubble: {
    maxWidth: '82%',
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: { marginTop: 2 },
  myTimestamp: { opacity: 0.75 },
  image: { width: 200, height: 150, borderRadius: radius.md },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: radius.lg,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
