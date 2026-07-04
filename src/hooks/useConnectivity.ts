import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

export type ConnectivitySource = 'web' | 'native' | 'unknown';

export type ConnectionType =
  | 'wifi'
  | 'cellular'
  | 'ethernet'
  | 'bluetooth'
  | 'none'
  | 'unknown';

export type ConnectivityState = {
  /** Device reports active network link (navigator.onLine / NetInfo). */
  isConnected: boolean;
  /** Inverse of isConnected — for OfflineNotice wiring. */
  isOffline: boolean;
  /** Best-effort internet reachability; null when not determinable on web. */
  isInternetReachable: boolean | null;
  connectionType: ConnectionType;
  source: ConnectivitySource;
};

type NetInfoModule = {
  fetch: () => Promise<{
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    type: string;
  }>;
  addEventListener: (
    listener: (state: {
      isConnected: boolean | null;
      isInternetReachable: boolean | null;
      type: string;
    }) => void,
  ) => () => void;
};

function readWebConnected(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

function mapConnectionType(raw: string | undefined | null): ConnectionType {
  switch (raw) {
    case 'wifi':
      return 'wifi';
    case 'cellular':
      return 'cellular';
    case 'ethernet':
      return 'ethernet';
    case 'bluetooth':
      return 'bluetooth';
    case 'none':
      return 'none';
    default:
      return 'unknown';
  }
}

function buildState(
  isConnected: boolean,
  isInternetReachable: boolean | null,
  connectionType: ConnectionType,
  source: ConnectivitySource,
): ConnectivityState {
  return {
    isConnected,
    isOffline: !isConnected,
    isInternetReachable,
    connectionType,
    source,
  };
}

function readWebState(): ConnectivityState {
  const isConnected = readWebConnected();
  return buildState(isConnected, isConnected ? null : false, 'unknown', 'web');
}

/** SSR-safe initial snapshot before effects run. */
export function readInitialConnectivityState(): ConnectivityState {
  if (Platform.OS === 'web') {
    // Always assume online for SSR and the hydration pass — sync in useEffect.
    return buildState(true, null, 'unknown', 'web');
  }

  // Native without NetInfo — assume online until listener updates.
  return buildState(true, null, 'unknown', 'unknown');
}

let netInfoModule: NetInfoModule | null | undefined;

function loadNetInfoModule(): NetInfoModule | null {
  if (netInfoModule !== undefined) return netInfoModule;
  if (Platform.OS === 'web') {
    netInfoModule = null;
    return null;
  }

  try {
    // Optional dependency — not installed in this repo; web/unknown fallback only.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-community/netinfo') as {
      default?: NetInfoModule;
    } & NetInfoModule;
    netInfoModule = mod.default ?? mod;
  } catch {
    netInfoModule = null;
  }
  return netInfoModule;
}

/**
 * Tracks online/offline connectivity for MP offline-first foundation (OFFLINE.1).
 * Web: navigator.onLine + online/offline events. Native: NetInfo when installed.
 */
export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>(() => readInitialConnectivityState());

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;

      const sync = () => setState(readWebState());
      sync();
      window.addEventListener('online', sync);
      window.addEventListener('offline', sync);
      return () => {
        window.removeEventListener('online', sync);
        window.removeEventListener('offline', sync);
      };
    }

    const netInfo = loadNetInfoModule();
    if (!netInfo) {
      setState(buildState(true, null, 'unknown', 'unknown'));
      return;
    }

    let active = true;

    const applyNetInfo = (snapshot: {
      isConnected: boolean | null;
      isInternetReachable: boolean | null;
      type: string;
    }) => {
      if (!active) return;
      const isConnected = snapshot.isConnected !== false;
      setState(
        buildState(
          isConnected,
          snapshot.isInternetReachable ?? null,
          mapConnectionType(snapshot.type),
          'native',
        ),
      );
    };

    netInfo.fetch().then(applyNetInfo).catch(() => {
      if (active) setState(buildState(true, null, 'unknown', 'native'));
    });

    const unsubscribe = netInfo.addEventListener(applyNetInfo);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return useMemo(() => state, [state]);
}
