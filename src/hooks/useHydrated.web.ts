import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * The server and first hydration render agree. Screens mounted after that
 * already run in the browser: do not restart hydration and replace a nested
 * navigator with a session loader on every page change.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
