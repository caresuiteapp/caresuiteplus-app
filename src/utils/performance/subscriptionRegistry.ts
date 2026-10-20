/** Dev-only Supabase/realtime subscription registry — zero production overhead. */
const IS_DEV =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

const active = new Map<string, { source: string; createdAt: number }>();

export function registerDevSubscription(key: string, source: string): void {
  if (!IS_DEV) return;
  active.set(key, { source, createdAt: Date.now() });
}

export function unregisterDevSubscription(key: string): void {
  if (!IS_DEV) return;
  active.delete(key);
}

export function getDevSubscriptionRegistry(): ReadonlyMap<string, { source: string; createdAt: number }> {
  if (!IS_DEV) return new Map();
  return active;
}

export function logDevSubscriptions(): void {
  if (!IS_DEV || typeof console === 'undefined') return;
  if (active.size === 0) {
    console.info('[CareSuite perf] no tracked subscriptions');
    return;
  }
  console.info(
    '[CareSuite perf] subscriptions:',
    Object.fromEntries([...active.entries()].map(([k, v]) => [k, v.source])),
  );
}
