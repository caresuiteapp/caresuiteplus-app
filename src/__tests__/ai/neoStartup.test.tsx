// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartIntro } from '@/components/brand/AppStartIntro.web';
import { appStartIntroSession, AppStartIntroReadyContext } from '@/components/brand/appStartIntroSession';
import { RobotNavigationAssistant } from '@/ai/robot/RobotNavigationAssistant.web';

const model = vi.hoisted(() => ({ authenticated: true, pathname: '/office', createSpeech: vi.fn(), dispose: vi.fn() }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ authReady: true, isAuthenticated: model.authenticated, profile: { roleKey: 'admin' }, user: { id: 'test-user' } }) }));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => 'test-tenant' }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true, hasModuleGate: () => true }) }));
vi.mock('expo-router', () => ({ usePathname: () => model.pathname, useRouter: () => ({ push: vi.fn(), back: vi.fn(), canGoBack: () => false }) }));
vi.mock('@/lib/office/clientListService', () => ({ fetchClientList: vi.fn() }));
vi.mock('@/components/brand/brandassets', () => ({ CARESUITE_ROBOT_LOGO: '/robot.png' }));
vi.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ uri: '/intro.mp4' }) } }));
vi.mock('@/components/brand/appStartIntroAssets', () => ({ appStartIntroAssets: {} }));
vi.mock('@/ai/robot/neoSpeech.web', () => ({ createNeoSpeech: () => { model.createSpeech(); return { loadVoice: vi.fn(), prepare: vi.fn(), dispose: model.dispose }; } }));

let root: Root, host: HTMLDivElement;
const render = () => act(async () => root.render(<AppStartIntro><RobotNavigationAssistant /></AppStartIntro>));
const robot = () => document.body.querySelector('.cs-robot');
const emit = (event: string) => act(async () => host.querySelector('video')!.dispatchEvent(new Event(event)));
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); appStartIntroSession.completed = false;
  model.authenticated = true; model.pathname = '/office'; model.createSpeech.mockClear(); model.dispose.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers();
});

describe('Neo and the startup video', () => {
  it('creates no floating robot or speech engine until the video finishes, including an already signed-in session', async () => {
    await render(); await emit('playing');
    expect(robot()).toBeNull(); expect(model.createSpeech).not.toHaveBeenCalled();
    await emit('ended');
    expect(robot()).not.toBeNull(); expect(model.createSpeech).toHaveBeenCalledOnce();
    model.pathname = '/office/clients'; await render();
    expect(robot()).not.toBeNull(); expect(model.createSpeech).toHaveBeenCalledOnce();
  });
  it('stays absent during an autoplay block and a retry', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    await render();
    expect(robot()).toBeNull(); expect(model.createSpeech).not.toHaveBeenCalled();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Intro mit Musik starten"]')!.click());
    await emit('playing'); expect(robot()).toBeNull();
    await emit('ended'); expect(robot()).not.toBeNull();
  });
  it('waits for error recovery to release the app and stays absent for signed-out users', async () => {
    await render(); await emit('error');
    expect(robot()).toBeNull(); expect(model.createSpeech).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(robot()).not.toBeNull();
    model.authenticated = false; await render();
    expect(robot()).toBeNull(); expect(model.dispose).toHaveBeenCalledOnce();
  });
  it('disposes active speech and the body overlay whenever startup becomes blocked again', async () => {
    await act(async () => root.render(<AppStartIntroReadyContext.Provider value={true}><RobotNavigationAssistant /></AppStartIntroReadyContext.Provider>));
    expect(robot()).not.toBeNull();
    await act(async () => root.render(<AppStartIntroReadyContext.Provider value={false}><RobotNavigationAssistant /></AppStartIntroReadyContext.Provider>));
    expect(robot()).toBeNull(); expect(model.dispose).toHaveBeenCalledOnce();
  });
});
