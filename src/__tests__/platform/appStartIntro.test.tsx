// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartIntro } from '@/components/brand/AppStartIntro.native';
import { AppStartIntro as WebIntro } from '@/components/brand/AppStartIntro';
import { appStartIntroSession, useAppStartIntroReady } from '@/components/brand/appStartIntroSession';
import { PortalBiometricGate } from '@/components/auth/PortalBiometricGate';

const model = vi.hoisted(() => ({
  status: 'readyToPlay',
  size: { width: 390, height: 844 },
  stateListeners: new Set<(state: string) => void>(),
  backListeners: new Set<() => boolean>(),
  eventListeners: new Map<string, Set<(event?: unknown) => void>>(),
  play: vi.fn(), pause: vi.fn(), hideSplash: vi.fn().mockResolvedValue(undefined),
  sources: [] as number[],
  player: null as unknown as Record<string, unknown>,
  biometricPreference: vi.fn().mockResolvedValue(true),
  authenticate: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('@/components/ui', () => ({ PremiumButton: () => null }));
vi.mock('@/design/tokens/themeBridge', () => ({
  useLegacyTheme: () => ({ colors: {}, typography: {} }),
}));
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ authReady: true, portalSession: { accountId: 'intro-test-account' }, signOut: vi.fn() }),
}));
vi.mock('@/lib/auth/portalBiometricService', () => ({
  isPortalFaceUnlockEnabled: model.biometricPreference,
  authenticatePortalFace: model.authenticate,
  subscribePortalFacePreference: () => () => {},
}));
vi.mock('@/components/brand/appStartIntroAssets', () => ({
  appStartIntroAssets: { portrait: 101, landscape: 102 },
}));
vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: vi.fn().mockResolvedValue(true),
  hideAsync: model.hideSplash,
}));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('react-native', async () => {
  const React = await import('react');
  function View({ children, testID, onLayout }: {
    children?: React.ReactNode; testID?: string; onLayout?: () => void;
  }) {
    React.useLayoutEffect(() => { onLayout?.(); }, [onLayout]);
    return <div data-testid={testID}>{children}</div>;
  }
  return {
    View,
    Text: View, SafeAreaView: View, ActivityIndicator: () => null,
    Platform: { OS: 'android' },
    Animated: {
      View,
      Value: class { stopAnimation() {} },
      timing: (_value: unknown, { duration }: { duration: number }) => ({
        start: (callback: () => void) => setTimeout(callback, duration),
      }),
    },
    StyleSheet: { create: (v: unknown) => v, absoluteFill: {}, absoluteFillObject: {} },
    useWindowDimensions: () => model.size,
    AppState: {
      currentState: 'active',
      addEventListener: (_event: string, cb: (state: string) => void) => {
        model.stateListeners.add(cb);
        return { remove: () => model.stateListeners.delete(cb) };
      },
    },
    BackHandler: {
      addEventListener: (_event: string, cb: () => boolean) => {
        model.backListeners.add(cb);
        return { remove: () => model.backListeners.delete(cb) };
      },
    },
  };
});
vi.mock('expo-video', async () => {
  const React = await import('react');
  return {
    VideoView: () => <div data-testid="native-video" />,
    useVideoPlayer: (source: number, setup: (p: Record<string, unknown>) => void) => {
      const [player] = React.useState(() => {
        model.sources.push(source);
        const p = {
          get status() { return model.status; },
          play: model.play,
          pause: model.pause,
          addListener: (event: string, cb: (value?: unknown) => void) => {
            const listeners = model.eventListeners.get(event) ?? new Set();
            listeners.add(cb); model.eventListeners.set(event, listeners);
            return { remove: () => listeners.delete(cb) };
          },
        };
        setup(p); model.player = p;
        return p;
      });
      return player;
    },
  };
});

let host: HTMLDivElement;
let root: Root;
const emit = (event: string, value?: unknown) => {
  for (const callback of model.eventListeners.get(event) ?? []) callback(value);
};
function PortalProbe() {
  const ready = useAppStartIntroReady();
  return <span>{ready ? 'Portal bereit' : 'Sitzung lädt parallel'}</span>;
}
const render = async (element = <AppStartIntro><PortalProbe /></AppStartIntro>) => {
  await act(async () => root.render(element));
};
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); vi.clearAllMocks();
  model.status = 'readyToPlay'; model.size = { width: 390, height: 844 };
  model.sources.length = 0; model.stateListeners.clear(); model.backListeners.clear();
  model.eventListeners.clear(); appStartIntroSession.completed = false;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.clearAllTimers(); vi.useRealTimers();
});

describe('Native app startup intro', () => {
  it('loads the app underneath a local, audible, non-looping video and reveals it only after the end', async () => {
    await render();
    expect(host.textContent).toContain('Sitzung lädt parallel');
    expect(model.sources).toEqual([101]);
    expect(model.player).toMatchObject({ muted: false, loop: false, volume: 1, staysActiveInBackground: false });
    expect(model.play).toHaveBeenCalledOnce();
    expect(model.hideSplash).toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(5900));
    expect(host.querySelector('[data-testid="app-start-intro"]')).not.toBeNull();
    await act(async () => emit('playToEnd'));
    expect(host.textContent).toContain('Sitzung lädt parallel');
    await act(async () => vi.advanceTimersByTime(160));
    expect(host.querySelector('[data-testid="app-start-intro"]')).toBeNull();
    expect(host.textContent).toContain('Portal bereit');
    expect(model.pause).toHaveBeenCalled();
  });
  it('waits for a ready decoder and starts only once across repeated status events', async () => {
    model.status = 'loading'; await render();
    expect(model.play).not.toHaveBeenCalled();
    model.status = 'readyToPlay';
    await act(async () => { emit('statusChange', { status: 'readyToPlay' }); emit('statusChange', { status: 'readyToPlay' }); });
    expect(model.play).toHaveBeenCalledOnce();
  });
  it('defers the real biometric gate until the intro ends, then unlocks the portal', async () => {
    await render(<AppStartIntro><PortalBiometricGate><span>Geschütztes Portal</span></PortalBiometricGate></AppStartIntro>);
    expect(model.biometricPreference).not.toHaveBeenCalled();
    expect(model.authenticate).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Geschütztes Portal');
    await act(async () => emit('playToEnd'));
    await act(async () => vi.advanceTimersByTime(160));
    expect(model.biometricPreference).toHaveBeenCalledWith('intro-test-account');
    expect(model.authenticate).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Geschütztes Portal');
  });
  it('releases the intro on decoder failure without blocking login', async () => {
    await render();
    model.status = 'error';
    await act(async () => emit('statusChange', { status: 'error' }));
    expect(host.textContent).toContain('Portal bereit');
    expect(host.querySelector('[data-testid="native-video"]')).toBeNull();
  });
  it('fails open when no ready or completion event ever arrives', async () => {
    model.status = 'loading'; await render();
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(host.textContent).toContain('Portal bereit');
    expect(model.play).not.toHaveBeenCalled();
  });
  it('stops sound in the background and does not replay on an ordinary return', async () => {
    await render();
    await act(async () => { for (const cb of model.stateListeners) cb('background'); });
    expect(model.pause).toHaveBeenCalled();
    expect(host.textContent).toContain('Portal bereit');
    await act(async () => { for (const cb of model.stateListeners) cb('active'); });
    expect(model.play).toHaveBeenCalledOnce();
  });
  it('does not replay on root remount but plays again in a new application session', async () => {
    await render(); await act(async () => emit('playToEnd'));
    await act(async () => vi.advanceTimersByTime(160));
    await render(<div />); await render();
    expect(model.sources).toHaveLength(1);
    expect(host.textContent).toContain('Portal bereit');
    await render(<div />); appStartIntroSession.completed = false;
    await render(); expect(model.sources).toHaveLength(2);
  });
  it('selects landscape at launch and does not restart the clip on rotation', async () => {
    model.size = { width: 1024, height: 768 }; await render();
    expect(model.sources).toEqual([102]);
    model.size = { width: 768, height: 1024 }; await render();
    expect(model.sources).toEqual([102]);
    expect(model.play).toHaveBeenCalledOnce();
  });
  it('consumes Android back presses during playback and removes its listeners afterwards', async () => {
    await render(); expect([...model.backListeners][0]()).toBe(true);
    await act(async () => emit('playToEnd'));
    await act(async () => vi.advanceTimersByTime(160));
    expect(model.backListeners.size).toBe(0);
    expect(model.stateListeners.size).toBe(0);
  });
  it('opens the website without creating a player or delaying the page', async () => {
    await render(<WebIntro><PortalProbe /></WebIntro>);
    expect(host.textContent).toContain('Portal bereit');
    expect(model.sources).toHaveLength(0);
  });
});
