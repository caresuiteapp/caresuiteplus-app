// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://www.caresuiteplus.app/"}
import React, { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStartIntro } from '@/components/brand/AppStartIntro.web';
import { appStartIntroSession, useAppStartIntroReady } from '@/components/brand/appStartIntroSession';

const model = vi.hoisted(() => ({ asset: vi.fn() }));
vi.mock('expo-asset', () => ({ Asset: { fromModule: model.asset } }));
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
const setUrl = (path: string) => {
  if (path.startsWith('http')) {
    (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(path);
  } else window.history.replaceState(null, '', path);
};
const interact = async (type = 'click', trusted = true) => {
  const event = new Event(type, { bubbles: true });
  // DOM-model simulation only; browser verification supplies real input events.
  Object.defineProperty(event, 'isTrusted', { value: trusted });
  await act(async () => document.dispatchEvent(event));
};
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); appStartIntroSession.completed = false;
  setUrl('https://www.caresuiteplus.app/');
  model.asset.mockReset().mockImplementation((uri: string) => ({ uri }));
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

describe('Web startup intro at the start address', () => {
  it('starts with music automatically, without start, mute or skip controls', async () => {
    await render(); await emit('playing');
    expect(video().muted).toBe(false); expect(video().volume).toBe(1);
    expect(play).toHaveBeenCalledOnce();
    expect(host.querySelector('[data-caresuite-start-intro] button')).toBeNull();
    expect(video().controls).toBe(false);
  });
  it('starts silently without asking when the browser blocks music', async () => {
    play.mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'));
    await render(); await emit('playing');
    expect(play).toHaveBeenCalledTimes(2);
    expect(video().muted).toBe(true);
    expect(video().style.opacity).toBe('1');
    expect(host.querySelector('[data-caresuite-start-intro] button')).toBeNull();
    expect(host.textContent).not.toContain('Starten Sie das Intro');
  });
  it.each(['click', 'touchend', 'keydown'])('enables music on an ordinary trusted %s without restarting the clip', async (type) => {
    play.mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'));
    await render(); await emit('playing');
    video().currentTime = 3;
    await interact(type);
    expect(play).toHaveBeenCalledTimes(3);
    expect(video().muted).toBe(false); expect(video().volume).toBe(1);
    expect(video().currentTime).toBe(3);
    expect(host.querySelector('[data-caresuite-start-intro] button')).toBeNull();
  });
  it('does not treat a scripted event as permission to enable music', async () => {
    play.mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'));
    await render(); await interact('click', false);
    expect(play).toHaveBeenCalledTimes(2); expect(video().muted).toBe(true);
  });
  it('continues silently if music remains blocked after interaction', async () => {
    play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    await render(); await emit('playing');
    play.mockRejectedValueOnce(new DOMException('still blocked', 'NotAllowedError'));
    video().currentTime = 4;
    await interact();
    expect(play).toHaveBeenCalledTimes(4); expect(video().muted).toBe(true);
    expect(video().currentTime).toBe(4);
    expect(host.querySelector('[data-caresuite-start-intro] button')).toBeNull();
    await emit('ended'); expect(host.textContent).toBe('Anmelden');
  });
  it('releases login immediately if even silent autoplay is blocked', async () => {
    play.mockRejectedValue(new DOMException('All autoplay blocked', 'NotAllowedError'));
    await render();
    expect(video()).toBeNull(); expect(host.textContent).toBe('Anmelden');
    expect(content().hasAttribute('inert')).toBe(false);
    expect(play).toHaveBeenCalledTimes(2);
  });
  it('takes over the document loader while authentication is still loading', async () => {
    const boot = document.createElement('div'); boot.id = 'caresuite-web-boot';
    document.body.prepend(boot);
    play.mockImplementation(() => {
      expect(document.getElementById('caresuite-web-boot')).toBeNull();
      return Promise.resolve();
    });
    await render(<span>Sitzung lädt noch</span>);
    expect(boot.isConnected).toBe(false); expect(video()).not.toBeNull();
    expect(content().hasAttribute('inert')).toBe(true);
    await emit('ended'); expect(content().hasAttribute('inert')).toBe(false);
  });
  it('shows the light preparation panel until an actual frame is playing', async () => {
    await render();
    const overlay = host.querySelector<HTMLElement>('[data-caresuite-start-intro]')!;
    expect(overlay.style.background).toBe('#F3F8FF'); expect(video().style.opacity).toBe('0');
    expect(host.textContent).toContain('Startvideo wird vorbereitet');
    await emit('playing');
    expect(video().style.opacity).toBe('1');
    expect(host.textContent).not.toContain('Startvideo wird vorbereitet');
  });
  it('keeps the mounted application hidden and inert until the full video ends', async () => {
    await render(); await emit('playing');
    expect(content().hasAttribute('inert')).toBe(true);
    expect(content().getAttribute('aria-hidden')).toBe('true');
    expect(host.textContent).toContain('Anmeldung wird vorbereitet');
    expect(video().src).toContain('/assets/phone-landscape.mp4');
    expect(video().loop).toBe(false); expect(video().style.objectFit).toBe('contain');
    await act(async () => vi.advanceTimersByTime(7_900));
    expect(video()).not.toBeNull();
    await emit('ended');
    expect(video()).toBeNull(); expect(content().hasAttribute('inert')).toBe(false);
    expect(host.textContent).toBe('Anmelden');
  });
  it.each([
    '/auth/forgot-password', '/auth/reset-password#access_token=token', '/support', '/landingpage',
    '/office/dashboard', '/assist/home', '/platform/dashboard', '/?code=auth-code', '/#access_token=token',
    'http://www.caresuiteplus.app/', 'https://caresuiteplus.app/', 'https://preview.caresuiteplus.app/', 'http://localhost:8766/',
  ])('never loads or plays the intro when opening or reloading %s', async (path) => {
    setUrl(path); await render();
    expect(video()).toBeNull(); expect(host.textContent).toBe('Anmelden');
    expect(content().hasAttribute('inert')).toBe(false);
    await act(async () => root.render(<div />));
    appStartIntroSession.completed = false; // A fresh document at the same address.
    await render();
    expect(video()).toBeNull(); expect(host.textContent).toBe('Anmelden');
    expect(model.asset).not.toHaveBeenCalled(); expect(play).not.toHaveBeenCalled();
  });
  it('does not start after internal navigation from a deep link to the start page, including a root remount', async () => {
    setUrl('/office/dashboard'); await render();
    setUrl('/'); await render(<span>Startseite</span>);
    await act(async () => root.render(<div />)); await render();
    expect(video()).toBeNull(); expect(play).not.toHaveBeenCalled();
  });
  it('finishes the root intro even if the router redirects while it is playing', async () => {
    await render(); setUrl('/office/dashboard'); await render(<span>Desktop</span>);
    expect(video()).not.toBeNull(); expect(play).toHaveBeenCalledOnce();
    await emit('ended'); expect(host.textContent).toBe('Desktop');
  });
  it.each([
    { entry: '/', destination: '/office/dashboard', plays: true },
    { entry: '/support', destination: '/', plays: false },
  ])('uses the initial $entry address even if a child immediately redirects to $destination', async ({ entry, destination, plays }) => {
    setUrl(entry);
    function RedirectingRoute() {
      React.useLayoutEffect(() => setUrl(destination), [destination]);
      return <span>Zielseite</span>;
    }
    await render(<RedirectingRoute />);
    expect(window.location.pathname).toBe(destination);
    expect(Boolean(video())).toBe(plays);
    expect(play).toHaveBeenCalledTimes(plays ? 1 : 0);
    expect(content().hasAttribute('inert')).toBe(plays);
  });
  it('never replays on internal navigation or remount, but plays again when the start address is reloaded', async () => {
    await render(); await emit('ended');
    setUrl('/support'); await render(<span>Support</span>);
    setUrl('/'); await act(async () => root.render(<div />)); await render();
    expect(video()).toBeNull(); expect(play).toHaveBeenCalledOnce();
    await act(async () => root.render(<div />)); appStartIntroSession.completed = false;
    await render(); expect(video()).not.toBeNull(); expect(play).toHaveBeenCalledTimes(2);
  });
  it('does not replay on a root remount even if the original intro was interrupted before its end', async () => {
    await render(); await emit('playing');
    await act(async () => root.render(<div />)); await render();
    expect(video()).toBeNull(); expect(host.textContent).toBe('Anmelden');
    expect(play).toHaveBeenCalledOnce();
  });
  it.each(['/', '/support'])('hydrates the static document consistently at %s', async (path) => {
    setUrl(path); await act(async () => root.unmount());
    const element = <AppStartIntro><LoginProbe /></AppStartIntro>;
    host.innerHTML = renderToString(element);
    const recoverableError = vi.fn();
    await act(async () => { root = hydrateRoot(host, element, { onRecoverableError: recoverableError }); });
    expect(recoverableError).not.toHaveBeenCalled();
    expect(Boolean(video())).toBe(path === '/');
    if (path !== '/') expect(host.textContent).toBe('Anmelden');
  });
  it.each([[768, 1024, 'tablet43-portrait'], [1280, 800, 'tablet1610-landscape']])('chooses the app asset at %s × %s without restarting on resize', async (width, height, format) => {
    vi.stubGlobal('innerWidth', width); vi.stubGlobal('innerHeight', height); await render();
    const originalSource = video().src; expect(originalSource).toContain(`${format}.mp4`);
    vi.stubGlobal('innerWidth', height); vi.stubGlobal('innerHeight', width); await render();
    expect(video().src).toBe(originalSource); expect(play).toHaveBeenCalledOnce();
  });
  it('releases the app immediately on a genuine media error', async () => {
    await render(); await emit('error');
    expect(video()).toBeNull(); expect(host.textContent).toBe('Anmelden');
    expect(content().hasAttribute('inert')).toBe(false);
    expect(appStartIntroSession.completed).toBe(true);
  });
  it('releases the app if the asset cannot be resolved', async () => {
    model.asset.mockImplementationOnce(() => { throw new Error('Missing asset'); });
    await render(); expect(video()).toBeNull(); expect(host.textContent).toBe('Anmelden');
    expect(play).not.toHaveBeenCalled();
  });
  it('releases login automatically if the video never starts or ends', async () => {
    await render(); await act(async () => vi.advanceTimersByTime(20_000));
    expect(video()).toBeNull(); expect(host.textContent).toBe('Anmelden');
  });
  it('allows a complete clip after a slow initial load', async () => {
    await render(); await act(async () => vi.advanceTimersByTime(19_000));
    await emit('playing'); await act(async () => vi.advanceTimersByTime(8_000));
    expect(video()).not.toBeNull();
    await emit('ended'); expect(host.textContent).toBe('Anmelden');
  });
  it('ignores a late autoplay rejection after login was released', async () => {
    let reject!: (reason: Error) => void;
    play.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    await render(); await act(async () => vi.advanceTimersByTime(20_000));
    await act(async () => reject(new DOMException('late', 'NotAllowedError')));
    expect(play).toHaveBeenCalledOnce(); expect(host.textContent).toBe('Anmelden');
  });
  it('resumes silently without asking if Safari pauses previously started media', async () => {
    await render(); await emit('playing'); video().currentTime = 3;
    await emit('pause');
    expect(play).toHaveBeenCalledTimes(2); expect(video().muted).toBe(true);
    expect(video().currentTime).toBe(3);
    expect(host.querySelector('[data-caresuite-start-intro] button')).toBeNull();
  });
  it('ignores an old pause event after playback has already resumed', async () => {
    await render(); await emit('playing');
    Object.defineProperty(video(), 'paused', { configurable: true, value: false });
    await emit('pause'); expect(play).toHaveBeenCalledOnce();
    expect(video().style.opacity).toBe('1');
  });
  it('does not replay or enable audio after the intro has finished', async () => {
    play.mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'));
    await render(); await emit('ended'); await interact();
    expect(play).toHaveBeenCalledTimes(2); expect(video()).toBeNull();
  });
  it('releases login immediately for unsupported media instead of requesting permission', async () => {
    play.mockRejectedValueOnce(new DOMException('Unsupported source', 'NotSupportedError'));
    await render(); expect(host.textContent).toBe('Anmelden'); expect(video()).toBeNull();
    expect(play).toHaveBeenCalledOnce();
  });
});
