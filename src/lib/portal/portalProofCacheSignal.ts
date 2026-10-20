/**
 * Lightweight event bus for portal proof cache invalidation.
 * Admin-side actions (release / revoke) emit; client portal views subscribe and refetch.
 */

type Listener = () => void;

let _version = 0;
const _listeners = new Set<Listener>();

export function getPortalProofCacheVersion(): number {
  return _version;
}

export function invalidatePortalProofCache(): void {
  _version += 1;
  for (const fn of _listeners) {
    try {
      fn();
    } catch {
      /* listener errors must not break the caller */
    }
  }
}

export function subscribePortalProofCache(listener: Listener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

export function resetPortalProofCacheSignal(): void {
  _version = 0;
  _listeners.clear();
}
