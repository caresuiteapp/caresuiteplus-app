/** Share the actual operation, including while a caller's timeout has elapsed. */
export function createSingleFlight() {
  const pending = new Map<string, Promise<unknown>>();
  return function run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing as Promise<T>;
    const result = Promise.resolve().then(operation);
    pending.set(key, result);
    const release = () => { if (pending.get(key) === result) pending.delete(key); };
    void result.then(release, release);
    return result;
  };
}
