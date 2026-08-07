import { useCallback, useEffect, useRef } from 'react';
import { client, guestClient, must, type Order, type OrderStep } from '../lib/amplify';
import { useAsync } from './useAsync';
import { useAuth, type SignedInUser } from '../auth/AuthProvider';
import {
  ACTIVE_ORDER_STATUSES,
  DEFAULT_CURRENCY,
  toJsonField,
  type CatalogKind,
  type OrderStatus,
} from '../../shared/domain';
import { buildItemSnapshots, buildSteps, makeOrderNumber, sumSelections, type CatalogEntry } from '../../shared/orders';

export type OrderBucket = 'new' | 'pending' | 'completed' | 'history';

const BUCKET_STATUSES: Record<Exclude<OrderBucket, 'history'>, OrderStatus[]> = {
  new: ['NEW'],
  pending: ACTIVE_ORDER_STATUSES,
  completed: ['COMPLETED'],
};

const newestFirst = (a: Order, b: Order) => (b.createdAtIso ?? '').localeCompare(a.createdAtIso ?? '');

const dedupeById = (orders: Order[]): Order[] => {
  const seen = new Map<string, Order>();
  for (const order of orders) seen.set(order.id, order);
  return [...seen.values()];
};

/**
 * Staff order list for one bucket.
 *
 * Queries the `status` secondary index rather than scanning the table, so the
 * Pending tab stays fast once there are thousands of historical orders.
 */
export const useStaffOrders = (bucket: OrderBucket) => {
  const load = useCallback(async () => {
    if (bucket === 'history') {
      const all = must(
        await client.models.Order.list({ limit: 300 }),
        'list orders',
      );
      return dedupeById([...all]).sort(newestFirst);
    }

    const results = await Promise.all(
      BUCKET_STATUSES[bucket].map((status) =>
        client.models.Order.ordersByStatus({ status }, { sortDirection: 'DESC', limit: 200 }),
      ),
    );
    const orders = results.flatMap((result, index) =>
      must(result, `list ${BUCKET_STATUSES[bucket][index]} orders`),
    );
    return dedupeById(orders).sort(newestFirst);
  }, [bucket]);

  const state = useAsync<Order[]>(load, [bucket]);
  useOrderChangeRefresh(state.refresh, true);
  return state;
};

/** Orders belonging to the signed-in customer, via the `customerOwner` index. */
export const useMyOrders = () => {
  const { user, status } = useAuth();
  const sub = user?.sub ?? null;

  const load = useCallback(async () => {
    if (!sub) return [];
    const result = must(
      await client.models.Order.ordersByCustomerOwner(
        { customerOwner: sub },
        { sortDirection: 'DESC', limit: 100 },
      ),
      'list my orders',
    );
    return [...result].sort(newestFirst);
  }, [sub]);

  const signedIn = status === 'signedIn' && !!sub;
  const state = useAsync<Order[]>(load, [sub], { enabled: signedIn });
  // The Track tab renders its sign-in gate for signed-out visitors too, and an
  // unauthenticated AppSync subscription would just fail in a loop.
  useOrderChangeRefresh(state.refresh, signedIn);
  return state;
};

/**
 * Refreshes a list whenever any order changes anywhere.
 *
 * Debounced: a supervisor completing five steps in a row would otherwise trigger
 * five full refetches within a second.
 */
const useOrderChangeRefresh = (refresh: () => Promise<void>, enabled: boolean) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void refreshRef.current(), 600);
    };

    const subscriptions = [
      client.models.Order.onCreate().subscribe({ next: schedule, error: () => {} }),
      client.models.Order.onUpdate().subscribe({ next: schedule, error: () => {} }),
      client.models.Order.onDelete().subscribe({ next: schedule, error: () => {} }),
    ];

    return () => {
      if (timer.current) clearTimeout(timer.current);
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  }, [enabled]);
};

/** One order plus its roadmap, kept live while the screen is open. */
export const useOrderDetail = (orderId: string | undefined) => {
  const load = useCallback(async () => {
    if (!orderId) return null;
    const [order, steps] = await Promise.all([
      client.models.Order.get({ id: orderId }),
      client.models.OrderStep.stepsByOrder({ orderId }, { sortDirection: 'ASC', limit: 100 }),
    ]);
    return {
      order: must(order, 'read order'),
      steps: [...must(steps, 'read steps')].sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }, [orderId]);

  const state = useAsync(load, [orderId], { enabled: !!orderId });

  const refreshRef = useRef(state.refresh);
  refreshRef.current = state.refresh;

  useEffect(() => {
    if (!orderId) return;
    const filter = { orderId: { eq: orderId } };
    const bump = () => void refreshRef.current();

    const subscriptions = [
      client.models.OrderStep.onUpdate({ filter }).subscribe({ next: bump, error: () => {} }),
      client.models.OrderStep.onCreate({ filter }).subscribe({ next: bump, error: () => {} }),
      client.models.Order.onUpdate({ filter: { id: { eq: orderId } } }).subscribe({
        next: bump,
        error: () => {},
      }),
    ];

    return () => subscriptions.forEach((sub) => sub.unsubscribe());
  }, [orderId]);

  return state;
};

/* -------------------------------------------------------------------------- *
 * Writes
 * -------------------------------------------------------------------------- */

export type NewOrderInput = {
  customer: { name: string; phone: string; email: string; ownerSub: string; profileId: string | null };
  vehicle: {
    make: string;
    model: string;
    year: string;
    plate: string;
    color: string;
    vin: string;
    imageKeys: string[];
  };
  selections: { kind: CatalogKind; entry: CatalogEntry }[];
  notes: string;
  scheduledAt: string | null;
};

/**
 * Creates an order and its roadmap. Steps are written after the order so that a
 * partial failure leaves a visible order to fix rather than orphaned steps.
 */
export const createOrder = async (input: NewOrderInput, actor: SignedInUser) => {
  const steps = buildSteps(input.selections);

  const order = must(
    await client.models.Order.create({
      orderNumber: makeOrderNumber(),
      status: 'SCHEDULED',
      source: 'STAFF',
      createdAtIso: new Date().toISOString(),
      customerOwner: input.customer.ownerSub,
      customerProfileId: input.customer.profileId,
      customerName: input.customer.name.trim(),
      customerPhone: input.customer.phone,
      customerEmail: input.customer.email.trim() || null,
      vehicleMake: input.vehicle.make.trim() || null,
      vehicleModel: input.vehicle.model.trim() || null,
      vehicleYear: input.vehicle.year.trim() || null,
      vehiclePlate: input.vehicle.plate.trim() || null,
      vehicleColor: input.vehicle.color.trim() || null,
      vehicleVin: input.vehicle.vin.trim() || null,
      vehicleImageKeys: input.vehicle.imageKeys,
      items: toJsonField(buildItemSnapshots(input.selections)),
      totalAmount: sumSelections(input.selections),
      currency: DEFAULT_CURRENCY,
      notes: input.notes.trim() || null,
      currentStepOrder: 0,
      totalStepCount: steps.length,
      completedStepCount: 0,
      assignedSupervisorSub: actor.sub,
      assignedSupervisorName: actor.name,
      assignedSupervisorPhone: actor.phone,
      createdBySub: actor.sub,
      createdByName: actor.name,
      createdByRole: actor.role,
      scheduledAt: input.scheduledAt,
      unreadForCustomer: 0,
      unreadForStaff: 0,
    }),
    'create order',
  );

  await Promise.all(
    steps.map((step) =>
      client.models.OrderStep.create({
        orderId: order.id,
        customerOwner: input.customer.ownerSub,
        sortOrder: step.sortOrder,
        name: step.name,
        nameAr: step.nameAr,
        description: step.description,
        sourceKind: step.sourceKind,
        sourceId: step.sourceId,
        sourceName: step.sourceName,
        status: 'PENDING',
        imageKeys: [],
      }).then((result) => must(result, 'create order step')),
    ),
  );

  return order;
};

/** Recomputes the counters the list rows and progress bars read. */
const rollUp = (steps: OrderStep[]) => {
  const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
  const completed = sorted.filter((step) => step.status === 'COMPLETED').length;
  const current = sorted.find((step) => step.status === 'IN_PROGRESS')
    ?? sorted.find((step) => step.status === 'PENDING');
  return {
    completedStepCount: completed,
    totalStepCount: sorted.length,
    currentStepOrder: current?.sortOrder ?? sorted.length,
    allDone: sorted.length > 0 && completed === sorted.length,
  };
};

export const setStepStatus = async (
  order: Order,
  steps: OrderStep[],
  stepId: string,
  status: OrderStep['status'],
  actor: SignedInUser,
) => {
  const now = new Date().toISOString();
  const updated = must(
    await client.models.OrderStep.update({
      id: stepId,
      status,
      startedAt: status === 'IN_PROGRESS' ? now : undefined,
      completedAt: status === 'COMPLETED' ? now : null,
      completedBySub: status === 'COMPLETED' ? actor.sub : null,
      completedByName: status === 'COMPLETED' ? actor.name : null,
    }),
    'update step',
  );

  const next = steps.map((step) => (step.id === stepId ? { ...step, ...updated } : step));
  const roll = rollUp(next);

  // Starting or finishing any step implies the order itself is under way; an
  // order left in SCHEDULED while steps progress would confuse the customer.
  const orderStatus: OrderStatus =
    order.status === 'ON_HOLD' || order.status === 'CANCELLED'
      ? (order.status as OrderStatus)
      : roll.allDone
        ? 'COMPLETED'
        : 'IN_PROGRESS';

  await client.models.Order.update({
    id: order.id,
    status: orderStatus,
    completedStepCount: roll.completedStepCount,
    totalStepCount: roll.totalStepCount,
    currentStepOrder: roll.currentStepOrder,
    startedAt: order.startedAt ?? now,
    completedAt: orderStatus === 'COMPLETED' ? now : null,
  });

  return updated;
};

export const renameStep = async (stepId: string, name: string, nameAr: string | null) =>
  must(
    await client.models.OrderStep.update({ id: stepId, name: name.trim(), nameAr: nameAr?.trim() || null }),
    'rename step',
  );

export const setStepImages = async (stepId: string, imageKeys: string[]) =>
  must(await client.models.OrderStep.update({ id: stepId, imageKeys }), 'update step images');

export const setStepNote = async (stepId: string, note: string) =>
  must(await client.models.OrderStep.update({ id: stepId, note: note.trim() || null }), 'update step note');

export const addStepToOrder = async (order: Order, steps: OrderStep[], name: string, nameAr: string) =>
  must(
    await client.models.OrderStep.create({
      orderId: order.id,
      customerOwner: order.customerOwner,
      sortOrder: steps.length,
      name: name.trim(),
      nameAr: nameAr.trim() || null,
      status: 'PENDING',
      imageKeys: [],
    }),
    'add step',
  );

export const holdOrder = async (orderId: string, reason: string) =>
  must(
    await client.models.Order.update({
      id: orderId,
      status: 'ON_HOLD',
      holdReason: reason.trim(),
      holdAt: new Date().toISOString(),
    }),
    'hold order',
  );

export const resumeOrder = async (orderId: string) =>
  must(
    await client.models.Order.update({
      id: orderId,
      status: 'IN_PROGRESS',
      holdReason: null,
      holdAt: null,
    }),
    'resume order',
  );

export const acceptOrder = async (orderId: string, actor: SignedInUser) =>
  must(
    await client.models.Order.update({
      id: orderId,
      status: 'SCHEDULED',
      assignedSupervisorSub: actor.sub,
      assignedSupervisorName: actor.name,
      assignedSupervisorPhone: actor.phone,
    }),
    'accept order',
  );

export const completeOrder = async (orderId: string, steps: OrderStep[], actor: SignedInUser) => {
  const now = new Date().toISOString();
  // Everything still open is marked done, otherwise a completed order would show
  // a half-empty roadmap to the customer.
  await Promise.all(
    steps
      .filter((step) => step.status !== 'COMPLETED' && step.status !== 'SKIPPED')
      .map((step) =>
        client.models.OrderStep.update({
          id: step.id,
          status: 'COMPLETED',
          completedAt: now,
          completedBySub: actor.sub,
          completedByName: actor.name,
        }),
      ),
  );

  return must(
    await client.models.Order.update({
      id: orderId,
      status: 'COMPLETED',
      completedAt: now,
      completedStepCount: steps.length,
      totalStepCount: steps.length,
      currentStepOrder: steps.length,
      holdReason: null,
    }),
    'complete order',
  );
};

export const cancelOrder = async (orderId: string, reason: string) =>
  must(
    await client.models.Order.update({
      id: orderId,
      status: 'CANCELLED',
      cancelReason: reason.trim() || null,
    }),
    'cancel order',
  );

/** Public booking — runs through the Lambda so a guest can be provisioned. */
export const submitPublicBooking = async (input: {
  name: string;
  phone: string;
  email: string;
  notes: string;
  preferredDate: string | null;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  selections: { kind: CatalogKind; refId: string }[];
  signedIn: boolean;
}) => {
  const api = input.signedIn ? client : guestClient;
  const result = await api.mutations.submitPublicBooking({
    name: input.name.trim(),
    phone: input.phone,
    email: input.email.trim() || undefined,
    notes: input.notes.trim() || undefined,
    preferredDate: input.preferredDate ?? undefined,
    vehicleMake: input.vehicleMake.trim() || undefined,
    vehicleModel: input.vehicleModel.trim() || undefined,
    vehiclePlate: input.vehiclePlate.trim() || undefined,
    // AWSJSON arguments travel as strings; the Lambda parses them back.
    selections: toJsonField(input.selections) ?? '[]',
  });

  return must(result, 'submit booking');
};

/** Creates (or refreshes) the customer's Cognito account before an order. */
export const ensureCustomerAccount = async (input: {
  name: string;
  phone: string;
  email: string;
}) => {
  const result = await client.mutations.ensureCustomerAccount({
    name: input.name.trim(),
    phone: input.phone,
    email: input.email.trim() || undefined,
  });
  return must(result, 'create customer account');
};
