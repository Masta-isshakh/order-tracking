/**
 * Domain vocabulary shared by the Amplify backend and the Expo app.
 *
 * These are stored as plain strings rather than GraphQL enums so that adding a
 * status later is a code change, not a schema migration — and so that any field
 * can be used as a DynamoDB secondary-index partition key.
 */

export const ORDER_STATUSES = [
  'NEW', // booked by a customer, not yet accepted by staff
  'SCHEDULED', // accepted, waiting for the vehicle / start date
  'IN_PROGRESS', // work has started on at least one step
  'ON_HOLD', // paused by staff, always carries a reason
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses that count as "live work" in the staff Pending tab. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'ON_HOLD'];

export const STEP_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const CATALOG_KINDS = ['SERVICE', 'PACKAGE'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export const ORDER_SOURCES = ['STAFF', 'CUSTOMER_BOOKING'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const ROLES = ['ADMIN', 'SUPERVISOR', 'CUSTOMER'] as const;
export type Role = (typeof ROLES)[number];

export const DEFAULT_CURRENCY = 'QAR';

/** One entry of `Order.items` (JSON column) — a snapshot taken at order time. */
export type OrderItemSnapshot = {
  kind: CatalogKind;
  refId: string;
  name: string;
  nameAr?: string | null;
  price?: number | null;
  imageKey?: string | null;
};

/** One entry of `Service.steps` / `Package.steps` (JSON column). */
export type StepTemplate = {
  key: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
};

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);

export const isStepStatus = (value: unknown): value is StepStatus =>
  typeof value === 'string' && (STEP_STATUSES as readonly string[]).includes(value);

/** Parses a JSON column that may arrive as a string, an array, or null. */
export const parseJsonArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Serialises a value for an `a.json()` (AWSJSON) field or argument.
 *
 * AppSync's AWSJSON scalar is a *string* on the wire, and the Amplify Data
 * client passes values through untouched. Sending a raw array or object is
 * rejected with "Variable '<field>' has an invalid value", so every write to a
 * JSON column has to go through here.
 */
export const toJsonField = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};
