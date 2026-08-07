import {
  type CatalogKind,
  type OrderItemSnapshot,
  type StepTemplate,
  parseJsonArray,
} from './domain';

/**
 * Order-building rules shared by the public booking Lambda and the staff
 * "create order" wizard, so a booked order and a staff-entered order always
 * produce an identical roadmap.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 — read aloud over the phone

/** e.g. "STR-260807-K4QP". Sorts by day and is short enough to quote verbally. */
export const makeOrderNumber = (now: Date = new Date(), random: () => number = Math.random): string => {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return `STR-${yy}${mm}${dd}-${suffix}`;
};

export type CatalogEntry = {
  id: string;
  name: string;
  nameAr?: string | null;
  price?: number | null;
  imageKey?: string | null;
  steps?: unknown;
};

export type BuiltStep = {
  sortOrder: number;
  name: string;
  nameAr: string | null;
  description: string | null;
  sourceKind: CatalogKind;
  sourceId: string;
  sourceName: string;
};

/**
 * Expands the chosen services/packages into a single ordered roadmap.
 *
 * Steps are laid end to end in selection order, which is how the work actually
 * happens: wash the car, then polish it, then apply protection. An entry with no
 * configured steps still contributes one node so it stays visible on the roadmap.
 */
export const buildSteps = (
  selections: { kind: CatalogKind; entry: CatalogEntry }[],
): BuiltStep[] => {
  const steps: BuiltStep[] = [];

  for (const { kind, entry } of selections) {
    const templates = parseJsonArray<StepTemplate>(entry.steps);

    if (templates.length === 0) {
      steps.push({
        sortOrder: steps.length,
        name: entry.name,
        nameAr: entry.nameAr ?? null,
        description: null,
        sourceKind: kind,
        sourceId: entry.id,
        sourceName: entry.name,
      });
      continue;
    }

    for (const template of templates) {
      const label = String(template?.name ?? '').trim();
      if (!label) continue;
      steps.push({
        sortOrder: steps.length,
        name: label,
        nameAr: template.nameAr ?? null,
        description: template.description ?? null,
        sourceKind: kind,
        sourceId: entry.id,
        sourceName: entry.name,
      });
    }
  }

  return steps;
};

export const buildItemSnapshots = (
  selections: { kind: CatalogKind; entry: CatalogEntry }[],
): OrderItemSnapshot[] =>
  selections.map(({ kind, entry }) => ({
    kind,
    refId: entry.id,
    name: entry.name,
    nameAr: entry.nameAr ?? null,
    price: entry.price ?? null,
    imageKey: entry.imageKey ?? null,
  }));

export const sumSelections = (selections: { entry: CatalogEntry }[]): number =>
  selections.reduce((total, { entry }) => total + (Number(entry.price) || 0), 0);
