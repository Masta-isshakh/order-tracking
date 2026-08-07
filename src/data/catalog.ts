import { useCallback } from 'react';
import { client, guestClient, must, type Package, type Service } from '../lib/amplify';
import { useAsync } from './useAsync';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_CURRENCY, type StepTemplate, parseJsonArray, toJsonField } from '../../shared/domain';

export type CatalogItem = (Service | Package) & { kind: 'SERVICE' | 'PACKAGE' };

const bySortOrder = (a: { sortOrder?: number | null; name: string }, b: { sortOrder?: number | null; name: string }) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);

/**
 * Reads the catalog with whichever credentials are available.
 *
 * The Home and Book tabs must render for someone who has never signed in, so the
 * guest (identity-pool) client is used until a session exists.
 */
export const useCatalog = (options?: { includeHidden?: boolean }) => {
  const { status } = useAuth();
  const includeHidden = options?.includeHidden ?? false;
  const signedIn = status === 'signedIn';

  const load = useCallback(async () => {
    const api = signedIn ? client : guestClient;
    const [services, packages] = await Promise.all([
      api.models.Service.list({ limit: 200 }),
      api.models.Package.list({ limit: 200 }),
    ]);

    const serviceList = must(services, 'list services').filter(
      (item) => includeHidden || item.isActive !== false,
    );
    const packageList = must(packages, 'list packages').filter(
      (item) => includeHidden || item.isActive !== false,
    );

    return {
      services: [...serviceList].sort(bySortOrder),
      packages: [...packageList].sort(bySortOrder),
    };
  }, [signedIn, includeHidden]);

  // `status` is a dependency so the list re-loads with the right credentials the
  // moment a guest signs in (and vice versa after sign-out).
  return useAsync(load, [signedIn, includeHidden, status], { enabled: status !== 'loading' });
};

export type CatalogDraft = {
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: string;
  durationMinutes: string;
  category: string;
  imageKey: string | null;
  isActive: boolean;
  steps: StepTemplate[];
  includedServiceIds: string[];
};

export const emptyDraft = (): CatalogDraft => ({
  name: '',
  nameAr: '',
  description: '',
  descriptionAr: '',
  price: '',
  durationMinutes: '',
  category: '',
  imageKey: null,
  isActive: true,
  steps: [],
  includedServiceIds: [],
});

export const draftFromItem = (item: Service | Package): CatalogDraft => ({
  name: item.name ?? '',
  nameAr: item.nameAr ?? '',
  description: item.description ?? '',
  descriptionAr: item.descriptionAr ?? '',
  price: item.price === null || item.price === undefined ? '' : String(item.price),
  durationMinutes:
    item.durationMinutes === null || item.durationMinutes === undefined
      ? ''
      : String(item.durationMinutes),
  category: 'category' in item ? ((item as Service).category ?? '') : '',
  imageKey: item.imageKey ?? null,
  isActive: item.isActive !== false,
  steps: parseJsonArray<StepTemplate>(item.steps),
  includedServiceIds:
    'includedServiceIds' in item
      ? (((item as Package).includedServiceIds ?? []).filter(Boolean) as string[])
      : [],
});

const toNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Shared payload for Service and Package writes. */
const basePayload = (draft: CatalogDraft, actor: { sub: string; name: string }) => ({
  name: draft.name.trim(),
  nameAr: draft.nameAr.trim() || null,
  description: draft.description.trim() || null,
  descriptionAr: draft.descriptionAr.trim() || null,
  price: toNumber(draft.price),
  currency: DEFAULT_CURRENCY,
  imageKey: draft.imageKey,
  durationMinutes: toNumber(draft.durationMinutes),
  isActive: draft.isActive,
  // Steps are stored as JSON with stable keys so renaming a step in the catalog
  // never renames it on orders that were already created from it.
  steps: toJsonField(
    draft.steps.map((step, index) => ({
      key: step.key || `step-${index + 1}`,
      name: step.name.trim(),
      nameAr: step.nameAr?.trim() || null,
      description: step.description?.trim() || null,
    })),
  ),
  createdBySub: actor.sub,
  createdByName: actor.name,
});

export const createService = async (draft: CatalogDraft, actor: { sub: string; name: string }) =>
  must(
    await client.models.Service.create({
      ...basePayload(draft, actor),
      category: draft.category.trim() || null,
      sortOrder: 0,
    }),
    'create service',
  );

export const updateService = async (
  id: string,
  draft: CatalogDraft,
  actor: { sub: string; name: string },
) =>
  must(
    await client.models.Service.update({
      id,
      ...basePayload(draft, actor),
      category: draft.category.trim() || null,
    }),
    'update service',
  );

export const deleteService = async (id: string) =>
  must(await client.models.Service.delete({ id }), 'delete service');

export const createPackage = async (draft: CatalogDraft, actor: { sub: string; name: string }) =>
  must(
    await client.models.Package.create({
      ...basePayload(draft, actor),
      includedServiceIds: draft.includedServiceIds,
      sortOrder: 0,
    }),
    'create package',
  );

export const updatePackage = async (
  id: string,
  draft: CatalogDraft,
  actor: { sub: string; name: string },
) =>
  must(
    await client.models.Package.update({
      id,
      ...basePayload(draft, actor),
      includedServiceIds: draft.includedServiceIds,
    }),
    'update package',
  );

export const deletePackage = async (id: string) =>
  must(await client.models.Package.delete({ id }), 'delete package');
