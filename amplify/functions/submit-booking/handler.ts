import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { env } from '$amplify/env/submit-booking';
import type { Schema } from '../../data/resource';
import { normalizePhone } from '../../shared/phone';
import { ensureUserInGroup } from '../../shared/cognito';
import { DEFAULT_CURRENCY, toJsonField, type CatalogKind } from '../../../shared/domain';
import { buildItemSnapshots, buildSteps, makeOrderNumber, sumSelections, type CatalogEntry } from '../../../shared/orders';
import type { AmplifyResolverEvent } from '../../shared/appsync';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>({ authMode: 'iam' });

const USER_POOL_ID = env.AMPLIFY_AUTH_USERPOOL_ID;
const DEFAULT_DIAL_CODE = process.env.DEFAULT_DIAL_CODE || '974';
const CURRENCY = process.env.DEFAULT_CURRENCY || DEFAULT_CURRENCY;
const MAX_PER_DAY = Number(process.env.MAX_BOOKINGS_PER_PHONE_PER_DAY ?? 5);

type Result = {
  ok: boolean;
  code?: string | null;
  message?: string | null;
  userId?: string | null;
  phone?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
};

const fail = (code: string, message: string): Result => ({ ok: false, code, message });

const unwrap = <T>(res: { data?: T | null; errors?: { message: string }[] | null }, what: string): T => {
  if (res.errors?.length) throw new Error(`${what}: ${res.errors.map((e) => e.message).join('; ')}`);
  if (res.data === null || res.data === undefined) throw new Error(`${what}: no data returned`);
  return res.data;
};

type Selection = { kind: CatalogKind; refId: string };

/** The `selections` argument arrives as JSON and is fully untrusted. */
const parseSelections = (raw: unknown): Selection[] => {
  const list = typeof raw === 'string' ? safeParse(raw) : raw;
  if (!Array.isArray(list)) return [];
  const out: Selection[] = [];
  for (const item of list.slice(0, 20)) {
    const kind = (item as { kind?: unknown })?.kind;
    const refId = (item as { refId?: unknown })?.refId;
    if ((kind === 'SERVICE' || kind === 'PACKAGE') && typeof refId === 'string' && refId) {
      out.push({ kind, refId });
    }
  }
  return out;
};

const safeParse = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const handler = async (event: AmplifyResolverEvent): Promise<Result> => {
  try {
    const name = String(event.arguments.name ?? '').trim().slice(0, 120);
    const phone = normalizePhone(String(event.arguments.phone ?? ''), DEFAULT_DIAL_CODE);
    const email = String(event.arguments.email ?? '').trim().slice(0, 160) || null;
    const notes = String(event.arguments.notes ?? '').trim().slice(0, 1000) || null;
    const selections = parseSelections(event.arguments.selections);

    if (!name) return fail('NAME_REQUIRED', 'Please enter your name');
    if (!phone) return fail('INVALID_PHONE', 'Please enter a valid phone number');
    if (selections.length === 0) return fail('NO_SELECTION', 'Choose at least one service or package');

    // Cheap abuse guard: a public form that provisions Cognito accounts must not
    // be usable to mint unlimited users (or unlimited SMS at first sign-in).
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = unwrap(
      await client.models.Order.ordersByCustomerPhone(
        { customerPhone: phone, createdAtIso: { ge: since } },
        { limit: MAX_PER_DAY + 1, selectionSet: ['id'] },
      ),
      'count recent bookings',
    );
    if (recent.length >= MAX_PER_DAY) {
      return fail('RATE_LIMITED', 'Too many bookings from this number today. Please call us instead.');
    }

    // Re-read every selected item server-side: names and prices must come from the
    // catalog, never from whatever the device posted.
    const resolved: { kind: CatalogKind; entry: CatalogEntry }[] = [];
    for (const selection of selections) {
      if (selection.kind === 'SERVICE') {
        const found = unwrap(await client.models.Service.get({ id: selection.refId }), 'read service');
        if (found && found.isActive !== false) resolved.push({ kind: 'SERVICE', entry: found as CatalogEntry });
      } else {
        const found = unwrap(await client.models.Package.get({ id: selection.refId }), 'read package');
        if (found && found.isActive !== false) resolved.push({ kind: 'PACKAGE', entry: found as CatalogEntry });
      }
    }
    if (resolved.length === 0) return fail('NO_SELECTION', 'The selected items are no longer available');

    const user = await ensureUserInGroup({
      userPoolId: USER_POOL_ID,
      phone,
      name,
      email,
      group: 'CUSTOMER',
    });

    // Keep a CustomerProfile in step with the Cognito account.
    const profiles = unwrap(
      await client.models.CustomerProfile.listCustomerProfileByPhone({ phone }),
      'lookup customer profile',
    );
    let customerProfileId = profiles[0]?.id ?? null;
    if (customerProfileId) {
      unwrap(
        await client.models.CustomerProfile.update({
          id: customerProfileId,
          name,
          email: email ?? profiles[0]?.email,
          ownerSub: user.sub,
          cognitoUsername: user.username,
          isActive: true,
        }),
        'update customer profile',
      );
    } else {
      const created = unwrap(
        await client.models.CustomerProfile.create({
          phone,
          name,
          email,
          isActive: true,
          ownerSub: user.sub,
          cognitoUsername: user.username,
          orderCount: 0,
          createdByName: 'Online booking',
        }),
        'create customer profile',
      );
      customerProfileId = created?.id ?? null;
    }

    const steps = buildSteps(resolved);
    const createdAtIso = new Date().toISOString();
    const order = unwrap(
      await client.models.Order.create({
        orderNumber: makeOrderNumber(),
        status: 'NEW',
        source: 'CUSTOMER_BOOKING',
        createdAtIso,
        customerOwner: user.sub,
        customerProfileId,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        vehicleMake: String(event.arguments.vehicleMake ?? '').trim().slice(0, 60) || null,
        vehicleModel: String(event.arguments.vehicleModel ?? '').trim().slice(0, 60) || null,
        vehiclePlate: String(event.arguments.vehiclePlate ?? '').trim().slice(0, 30) || null,
        items: toJsonField(buildItemSnapshots(resolved)),
        totalAmount: sumSelections(resolved),
        currency: CURRENCY,
        notes,
        scheduledAt: parseDate(event.arguments.preferredDate),
        currentStepOrder: 0,
        totalStepCount: steps.length,
        completedStepCount: 0,
        createdByName: name,
        createdByRole: 'CUSTOMER',
        unreadForCustomer: 0,
        unreadForStaff: 0,
      }),
      'create order',
    );

    if (!order) return fail('INTERNAL_ERROR', 'Could not create the order');

    for (const step of steps) {
      unwrap(
        await client.models.OrderStep.create({
          orderId: order.id,
          customerOwner: user.sub,
          sortOrder: step.sortOrder,
          name: step.name,
          nameAr: step.nameAr,
          description: step.description,
          sourceKind: step.sourceKind,
          sourceId: step.sourceId,
          sourceName: step.sourceName,
          status: 'PENDING',
          imageKeys: [],
        }),
        'create order step',
      );
    }

    console.log(
      JSON.stringify({ level: 'INFO', message: 'public_booking_created', orderNumber: order.orderNumber }),
    );

    return {
      ok: true,
      code: 'OK',
      userId: user.sub,
      phone,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  } catch (err) {
    console.error(JSON.stringify({ level: 'ERROR', message: 'public_booking_failed', error: String(err) }));
    return fail('INTERNAL_ERROR', 'We could not submit your booking. Please try again.');
  }
};

const parseDate = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
