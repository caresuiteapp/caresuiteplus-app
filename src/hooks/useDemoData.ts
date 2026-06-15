import { useAsyncQuery } from './core';

export function useDemoData<T>(loader: () => T, deps: unknown[] = []) {
  return useAsyncQuery(
    () => Promise.resolve({ ok: true as const, data: loader() }),
    deps,
  );
}
