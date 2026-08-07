import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** Re-runs the loader, showing the pull-to-refresh spinner instead of the skeleton. */
  refresh: () => Promise<void>;
  /** Replaces the cached value without a network round trip. */
  set: (updater: T | ((current: T | null) => T | null)) => void;
};

/**
 * Small data primitive used by every screen.
 *
 * Deliberately not a full query cache: each screen owns its data, refetches on
 * focus, and patches locally from GraphQL subscriptions. That keeps the mental
 * model simple and avoids stale rows after a status change.
 */
export const useAsync = <T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
  options?: { enabled?: boolean },
): AsyncState<T> => {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  /** Guards against an earlier slow request overwriting a newer result. */
  const runId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (mode: 'initial' | 'refresh') => {
    const id = ++runId.current;
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await loaderRef.current();
      if (!mounted.current || id !== runId.current) return;
      setData(result);
    } catch (err) {
      if (!mounted.current || id !== runId.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current && id === runId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    await run('refresh');
  }, [enabled, run]);

  const set = useCallback((updater: T | ((current: T | null) => T | null)) => {
    setData((current) =>
      typeof updater === 'function' ? (updater as (c: T | null) => T | null)(current) : updater,
    );
  }, []);

  return { data, loading, refreshing, error, refresh, set };
};
