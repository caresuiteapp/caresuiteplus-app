/** Coalesce simultaneous reads only. No cached credentials or cross-account fallback. */
const flights = new Map<string, Promise<unknown>>();
export function sharedPortalRead<T>(key: string, read: () => Promise<T>): Promise<T> {
  const existing = flights.get(key);
  if (existing) return existing as Promise<T>;
  const pending = Promise.resolve().then(read).finally(() => {
    if (flights.get(key) === pending) flights.delete(key);
  });
  flights.set(key, pending);
  return pending;
}
