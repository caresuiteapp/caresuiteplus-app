import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  readInitialConnectivityState,
  type ConnectivityState,
} from '@/hooks/useConnectivity';

describe('readInitialConnectivityState', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns optimistic online state during SSR (no window)', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('navigator', { onLine: false });

    const state = readInitialConnectivityState();
    expect(state.isConnected).toBe(true);
    expect(state.isOffline).toBe(false);
    expect(state.source).toBe('web');
    expect(state.connectionType).toBe('unknown');
  });

  it('returns optimistic online on web hydration pass even when navigator is offline (HYDRATION.1)', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { onLine: false });

    const state = readInitialConnectivityState();
    expect(state.isConnected).toBe(true);
    expect(state.isOffline).toBe(false);
    expect(state.isInternetReachable).toBeNull();
  });

  it('marks online when navigator.onLine is true', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { onLine: true });

    const state = readInitialConnectivityState();
    expect(state.isConnected).toBe(true);
    expect(state.isOffline).toBe(false);
  });
});

describe('useConnectivity module', () => {
  const root = path.join(__dirname, '..', '..');

  it('exports ConnectivityState shape helpers via readInitialConnectivityState', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { onLine: true });

    const state: ConnectivityState = readInitialConnectivityState();
    expect(typeof state.isConnected).toBe('boolean');
    expect(typeof state.isOffline).toBe('boolean');
    expect(state.isOffline).toBe(!state.isConnected);
    expect(state.isInternetReachable === null || typeof state.isInternetReachable === 'boolean').toBe(
      true,
    );
    expect(typeof state.connectionType).toBe('string');
    expect(typeof state.source).toBe('string');
  });

  it('listens to online/offline window events on web', () => {
    const source = readFileSync(path.join(root, 'hooks/useConnectivity.ts'), 'utf8');
    expect(source).toContain("addEventListener('online'");
    expect(source).toContain("addEventListener('offline'");
    expect(source).toContain('navigator.onLine');
  });

  it('does not require @react-native-community/netinfo at build time', () => {
    const source = readFileSync(path.join(root, 'hooks/useConnectivity.ts'), 'utf8');
    expect(source).toContain('@react-native-community/netinfo');
    expect(source).toContain('catch');
  });
});
