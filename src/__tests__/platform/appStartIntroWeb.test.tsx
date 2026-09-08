// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartIntro } from '@/components/brand/AppStartIntro.web';
import { appStartIntroSession, useAppStartIntroReady } from '@/components/brand/appStartIntroSession';

vi.mock('expo-asset', () => ({ Asset: { fromModule: (uri: string) => ({ uri }) } }));
vi.mock('@/components/brand/appStartIntroAssets', () => ({ appStartIntroAssets: Object.fromEntries(
  ['phone', 'tablet43', 'tablet1610'].flatMap(family => ['portrait', 'landscape'].map(orientation => {
    const format = `${family}-${orientation}`; return [format, `/assets/${format}.mp4`];
  })),
)}));
let host: HTMLDivElement, root: Root;
const play = vi.fn(), pause = vi.fn();
function LoginProbe() { return <button>{useAppStartIntroReady() ? 'Anmelden' : 'Anmeldung wird vorbereitet'}</button>; }
const render = async (children = <LoginProbe />) => { await act(async () => root.render(<AppStartIntro>{children}</AppStartIntro>)); };
const video = () => host.querySelector('video')!;
const content = () => host.querySelector('[data-caresuite-intro-content]')!;
const emit = async (event: string) => { await act(async () => video().dispatchEvent(new Event(event))); };
const click = async (text: string) => {
  const button = [...host.querySelectorAll('button')].find(node => node.textContent === text);
  expect(button).toBeTruthy(); await act(async () => button!.click());
};
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); appStartIntroSession.completed = false;
  play.mockReset().mockResolvedValue(undefined); pause.mockReset();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);
  vi.stubGlobal('innerWidth', 1920); vi.stubGlobal('innerHeight', 1080);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers();
});

describe('Web startup intro', () => {
  it('mounts routing underneath but keeps login hidden and inert until the local video ends', async () => {
    await render();
    expect(content().hasAttribute('inert')).toBe(true);
    expect(content().getAttribute('aria-hidden')).toBe('true');
    expect(host.textContent).toContain('Anmeldung wird vorbereitet');
    expect(video().src).toContain('/assets/phone-landscape.mp4');
    expect(video().loop).toBe(false); expect(video().muted).toBe(false);
    expect(video().style.objectFit).toBe('contain'); expect(play).toHaveBeenCalledOnce();
    await emit('ended');
    expect(video()).toBeNull(); expect(content().hasAttribute('inert')).toBe(false);
    expect(host.textContent).toBe('Anmelden'); expect(pause).toHaveBeenCalled();
  });
  it('falls back to muted autoplay and lets a gesture enable sound', async () => {
    play.mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'));
    await render(); expect(play).toHaveBeenCalledTimes(2); expect(video().muted).toBe(true);
    await click('Ton einschalten'); expect(video().muted).toBe(false); expect(play).toHaveBeenCalledTimes(3);
    await click('Ton ausschalten'); expect(video().muted).toBe(true);
  });
  it('offers a manual start if both autoplay attempts are blocked', async () => {
    play.mockRejectedValueOnce(new Error('sound blocked')).mockRejectedValueOnce(new Error('autoplay blocked'));
    await render(); expect(content().hasAttribute('inert')).toBe(true);
    await click('Startvideo abspielen'); expect(play).toHaveBeenCalledTimes(3);
    expect(host.textContent).not.toContain('Startvideo abspielen'); await emit('ended');
    expect(host.textContent).toBe('Anmelden');
  });
  it('releases login on a broken video or after a stalled startup', async () => {
    await render(); await emit('error'); expect(host.textContent).toBe('Anmelden');
    await act(async () => root.render(<div />)); appStartIntroSession.completed = false;
    await render(); await act(async () => vi.advanceTimersByTime(20_000));
    expect(video()).toBeNull(); expect(host.textContent).toBe('Anmelden');
  });
  it('does not replay during navigation or root remount, but a new document session starts it again', async () => {
    await render(); await emit('ended'); await render(<span>Desktop</span>);
    await act(async () => root.render(<div />)); await render();
    expect(video()).toBeNull(); expect(play).toHaveBeenCalledOnce();
    await act(async () => root.render(<div />)); appStartIntroSession.completed = false;
    await render(); expect(video()).not.toBeNull(); expect(play).toHaveBeenCalledTimes(2);
  });
  it.each([[768, 1024, 'tablet43-portrait'], [1280, 800, 'tablet1610-landscape']])('chooses the app asset at %s × %s and keeps it when the window changes', async (width, height, format) => {
    vi.stubGlobal('innerWidth', width); vi.stubGlobal('innerHeight', height); await render();
    const originalSource = video().src; expect(originalSource).toContain(`${format}.mp4`);
    vi.stubGlobal('innerWidth', height); vi.stubGlobal('innerHeight', width); await render();
    expect(video().src).toBe(originalSource); expect(play).toHaveBeenCalledOnce();
  });
  it('ignores an autoplay rejection after the intro has already been released', async () => {
    let reject!: (reason: Error) => void;
    play.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    await render(); await emit('error'); await act(async () => reject(new Error('late')));
    expect(play).toHaveBeenCalledOnce(); expect(host.textContent).toBe('Anmelden');
  });
});
