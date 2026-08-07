import { useCallback, useEffect, useRef } from 'react';
import { client, must, type ChatMessage } from '../lib/amplify';
import { useAsync } from './useAsync';
import type { SignedInUser } from '../auth/AuthProvider';

const oldestFirst = (a: ChatMessage, b: ChatMessage) =>
  (a.createdAtIso ?? '').localeCompare(b.createdAtIso ?? '');

/**
 * Live thread for one order.
 *
 * New messages arrive through an AppSync subscription and are appended locally,
 * so the conversation feels immediate rather than waiting for a refetch.
 */
export const useOrderChat = (orderId: string | undefined) => {
  const load = useCallback(async () => {
    if (!orderId) return [];
    const result = must(
      await client.models.ChatMessage.messagesByOrder(
        { orderId },
        { sortDirection: 'ASC', limit: 300 },
      ),
      'list messages',
    );
    return [...result].sort(oldestFirst);
  }, [orderId]);

  const state = useAsync<ChatMessage[]>(load, [orderId], { enabled: !!orderId });

  const setRef = useRef(state.set);
  setRef.current = state.set;

  useEffect(() => {
    if (!orderId) return;
    const filter = { orderId: { eq: orderId } };

    const append = (message: ChatMessage) => {
      setRef.current((current) => {
        const list = current ?? [];
        // The sender already appended it optimistically.
        if (list.some((item) => item.id === message.id)) return list;
        return [...list, message].sort(oldestFirst);
      });
    };

    const subscriptions = [
      client.models.ChatMessage.onCreate({ filter }).subscribe({
        next: append,
        error: () => {},
      }),
      client.models.ChatMessage.onUpdate({ filter }).subscribe({
        next: (message) =>
          setRef.current((current) =>
            (current ?? []).map((item) => (item.id === message.id ? message : item)),
          ),
        error: () => {},
      }),
    ];

    return () => subscriptions.forEach((sub) => sub.unsubscribe());
  }, [orderId]);

  return state;
};

export const sendMessage = async (input: {
  orderId: string;
  customerOwner: string | null | undefined;
  body: string;
  imageKey?: string | null;
  actor: SignedInUser;
}) => {
  const fromStaff = input.actor.role === 'ADMIN' || input.actor.role === 'SUPERVISOR';

  return must(
    await client.models.ChatMessage.create({
      orderId: input.orderId,
      // Staff must stamp the customer's sub explicitly; for a customer the owner
      // rule fills it in from their own identity.
      customerOwner: fromStaff ? (input.customerOwner ?? null) : undefined,
      createdAtIso: new Date().toISOString(),
      senderSub: input.actor.sub,
      senderName: input.actor.name,
      senderRole: input.actor.role,
      body: input.body.trim() || null,
      imageKey: input.imageKey ?? null,
      readByCustomer: !fromStaff,
      readByStaff: fromStaff,
    }),
    'send message',
  );
};

/** Clears the other side's unread flag when a thread is opened. */
export const markThreadRead = async (messages: ChatMessage[], viewerIsStaff: boolean) => {
  const unread = messages.filter((message) =>
    viewerIsStaff ? message.readByStaff === false : message.readByCustomer === false,
  );
  if (unread.length === 0) return;

  await Promise.all(
    unread.map((message) =>
      client.models.ChatMessage.update({
        id: message.id,
        ...(viewerIsStaff ? { readByStaff: true } : { readByCustomer: true }),
      }),
    ),
  ).catch(() => {
    // Read receipts are best-effort; never surface a failure here.
  });
};
