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
const tapIntro = async () => {
  const button = host.querySelector<HTMLButtonElement>('[aria-label="Intro mit Musik starten"]');
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
  document.getElementById('caresuite-web-boot')?.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers();
});

describe('Web startup intro', () => {
  it('plays audibly with no mute or skip controls over the video', async () => {
    await render(); await emit('playing');
    expect(video().muted).toBe(false); expect(video().volume).toBe(1);
    expect(host.querySelector('[data-caresuite-start-intro] button')).toBeNull();
    expect(video().controls).toBe(false);
  });
  it('does not substitute silent playback when audible autoplay is blocked', async () => {
    play.mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'));
    await render();
    expect(play).toHaveBeenCalledOnce();
    expect(video().muted).toBe(false);
    expect(host.textContent).toContain('Zum Starten mit Musik tippen');
  });
  it('takes over the document loader before playback even while routing is still loading', async () => {
    const boot = document.createElement('div');
    boot.id = 'caresuite-web-boot';
    boot.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
    boot.textContent = 'Anwendung wird sicher geladen';
    document.body.prepend(boot);
    play.mockImplementation(() => {
      expect(document.getElementById('caresuite-web-boot')).toBeNull();
      return Promise.resolve();
    });
    await render(<span>Sitzung lädt noch</span>);
    expect(boot.isConnected).toBe(false);
    expect(video()).not.toBeNull();
    expect(host.textContent).toContain('Sitzung lädt noch');
    expect(content().hasAttribute('inert')).toBe(true);
    await emit('ended');
    expect(content().hasAttribute('inert')).toBe(false);
  });
  it('keeps video preparation light until an actual frame is playing', async () => {
    await render();
    const overlay = host.querySelector<HTMLElement>('[data-caresuite-start-intro]')!;
    expect(overlay.style.background).toBe('#F3F8FF');
    expect(video().style.opacity).toBe('0');
    expect(host.textContent).toContain('Startvideo wird vorbereitet');
    await emit('playing');
    expect(video().style.opacity).toBe('1');
    expect(host.textContent).not.toContain('Startvideo wird vorbereitet');
  });
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
  it('starts with sound from a tap on the whole intro and removes the activation surface', async () => {
    play.mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'));
    await render(); expect(play).toHaveBeenCalledOnce(); expect(video().muted).toBe(false);
    expect(host.textContent).not.toContain('Weiter zur Anmeldung');
    const activation = host.querySelector<HTMLButtonElement>('[aria-label="Intro mit Musik starten"]')!;
    expect(activation.tagName).toBe('BUTTON'); expect(activation.tabIndex).toBe(0);
    video().currentTime = 3;
    await tapIntro(); expect(video().muted).toBe(false); expect(play).toHaveBeenCalledTimes(2);
    expect(video().currentTime).toBe(0);
    await emit('playing');
    expect(host.querySelector('[data-caresuite-start-intro] button')).toBeNull();
    expect(host.textContent).not.toContain('Zum Starten mit Musik tippen');
  });
  it('keeps waiting for an audible start if the browser also rejects the first tap', async () => {
    play.mockRejectedValue(new DOMException('Sound blocked', 'NotAllowedError'));
    await render(); expect(content().hasAttribute('inert')).toBe(true);
    await tapIntro(); expect(play).toHaveBeenCalledTimes(2);
    expect(video().muted).toBe(false);
    expect(host.textContent).toContain('Zum Starten mit Musik tippen');
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(video()).toBeNull(); expect(host.textContent).toBe('Anmelden');
    expect(play).toHaveBeenCalledTimes(2);
  });
  it('allows a tap to retry a media error with sound', async () => {
    await render(); await emit('error');
    expect(host.textContent).toContain('Zum erneuten Starten tippen');
    await tapIntro(); await emit('playing');
    expect(play).toHaveBeenCalledTimes(2); expect(video().muted).toBe(false);
    expect(host.querySelector('[data-caresuite-start-intro] button')).toBeNull();
    await emit('ended'); expect(host.textContent).toBe('Anmelden');
  });
  it('releases login automatically if media stalls and recovery is unused', async () => {
    await render(); await act(async () => vi.advanceTimersByTime(20_000));
    expect(host.textContent).toContain('Zum erneuten Starten tippen');
    await act(async () => vi.advanceTimersByTime(20_000));
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
    await render(); await act(async () => vi.advanceTimersByTime(40_000));
    await act(async () => reject(new DOMException('late', 'NotAllowedError')));
    expect(play).toHaveBeenCalledOnce(); expect(host.textContent).toBe('Anmelden');
  });
  it('gives a late manual start a full playback window instead of the original deadline', async () => {
    play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    await render(); await act(async () => vi.advanceTimersByTime(19_000));
    await tapIntro(); await emit('playing');
    await act(async () => vi.advanceTimersByTime(8_000));
    expect(video()).not.toBeNull();
    expect(host.textContent).not.toContain('Zum erneuten Starten tippen');
    await emit('ended'); expect(host.textContent).toBe('Anmelden');
  });
  it('offers a gesture when Safari pauses a previously started video', async () => {
    await render(); await emit('playing'); await emit('pause');
    expect(host.textContent).toContain('Zum Starten mit Musik tippen');
    await tapIntro(); await emit('playing');
    expect(host.textContent).not.toContain('Zum Starten mit Musik tippen');
  });
  it('pauses instead of continuing silently if the media element becomes muted', async () => {
    await render(); await emit('playing');
    video().muted = true; await emit('volumechange');
    expect(pause).toHaveBeenCalled();
    expect(host.textContent).toContain('Zum Starten mit Musik tippen');
    await tapIntro(); await emit('playing');
    expect(video().muted).toBe(false); expect(video().volume).toBe(1);
    expect(host.querySelector('[data-caresuite-start-intro] button')).toBeNull();
  });
  it('ignores an old pause event after a gesture has already resumed playback', async () => {
    await render(); await emit('playing');
    Object.defineProperty(video(), 'paused', { configurable: true, value: false });
    await emit('pause');
    expect(host.textContent).not.toContain('Zum Starten mit Musik tippen');
    expect(video().style.opacity).toBe('1');
  });
  it('treats unsupported media as an error rather than an autoplay permission request', async () => {
    play.mockRejectedValueOnce(new DOMException('Unsupported source', 'NotSupportedError'));
    await render();
    expect(host.textContent).toContain('Zum erneuten Starten tippen');
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(host.textContent).toBe('Anmelden');
  });
});
