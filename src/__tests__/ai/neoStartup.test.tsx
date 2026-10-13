// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://www.caresuiteplus.app/"}
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartIntro } from '@/components/brand/AppStartIntro.web';
import { appStartIntroSession, AppStartIntroReadyContext } from '@/components/brand/appStartIntroSession';
import { RobotNavigationAssistant } from '@/ai/robot/RobotNavigationAssistant.web';

const model = vi.hoisted(() => ({ authenticated: true, pathname: '/', createSpeech: vi.fn(), dispose: vi.fn() }));
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
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL('https://www.caresuiteplus.app/');
  model.authenticated = true; model.pathname = '/'; model.createSpeech.mockClear(); model.dispose.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers();
});

describe('Neo and the startup video', () => {
  it('waits for the startup video and keeps Neo on the central desktop across page changes', async () => {
    await render(); await emit('playing');
    expect(robot()).toBeNull(); expect(model.createSpeech).not.toHaveBeenCalled();
    await emit('ended');
    expect(robot()).not.toBeNull(); expect(model.createSpeech).toHaveBeenCalledOnce();
    for (const pathname of ['/office', '/office/clients', '/business/office/clients/test-client', '/business/office/document-catalog', '/assist/assignments', '/business/settings', '/portal/employee', '/portal/client', '/auth/login']) {
      model.pathname = pathname; await render();
      expect(robot()).toBeNull();
      expect(model.createSpeech).toHaveBeenCalledOnce();
      expect(model.dispose).toHaveBeenCalledOnce();
    }
    model.pathname = '/'; await render();
    expect(document.body.querySelectorAll('.cs-robot')).toHaveLength(1);
    expect(model.createSpeech).toHaveBeenCalledTimes(2);
    expect(model.dispose).toHaveBeenCalledOnce();
  });
  it('waits during silent playback and an ordinary interaction that retries sound', async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    await render();
    expect(robot()).toBeNull(); expect(model.createSpeech).not.toHaveBeenCalled();
    expect(host.querySelector('video')!.muted).toBe(true);
    expect(host.querySelector('[aria-label="Intro mit Musik starten"]')).toBeNull();
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'isTrusted', { value: true });
    await act(async () => document.dispatchEvent(event));
    expect(host.querySelector('video')!.muted).toBe(false);
    await emit('playing'); expect(robot()).toBeNull();
    await emit('ended'); expect(robot()).not.toBeNull();
  });
  it('releases the app after a media error and stays absent for signed-out users', async () => {
    await render(); await emit('error');
    expect(robot()).not.toBeNull();
    expect(model.createSpeech).toHaveBeenCalledOnce();
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
