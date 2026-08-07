import { useCallback, useSyncExternalStore } from 'react';
import type { CatalogKind } from '../../shared/domain';

export type BookingSelection = {
  kind: CatalogKind;
  refId: string;
  name: string;
  nameAr: string | null;
  price: number | null;
};

/**
 * The Book tab and the checkout screen are separate routes, so the chosen
 * services live in a module-level store rather than screen state. Kept out of
 * React context deliberately: nothing above needs to re-render when it changes.
 */
let selections: BookingSelection[] = [];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => selections;

export const useBookingDraft = () => {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toggle = useCallback((selection: BookingSelection) => {
    selections = selections.some((item) => item.refId === selection.refId)
      ? selections.filter((item) => item.refId !== selection.refId)
      : [...selections, selection];
    emit();
  }, []);

  const clear = useCallback(() => {
    selections = [];
    emit();
  }, []);

  return { selections: current, toggle, clear };
};
