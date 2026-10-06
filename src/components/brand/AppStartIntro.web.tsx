import { CARESUITE_FONT_STACK } from '@/design/tokens/fontFamily';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Asset } from 'expo-asset';
import { appStartIntroAssets } from './appStartIntroAssets';
import { appStartIntroSession, AppStartIntroReadyContext } from './appStartIntroSession';
import { selectAppStartIntroFormat } from './selectAppStartIntroFormat';

// Memory only: navigation keeps the result; reloading the start address plays again.
const MAX_STARTUP_MS = 20_000;

export function AppStartIntro({ children }: { children: ReactNode }) {
  // Snapshot during the first render: child layout effects may redirect before ours.
  const [entryAddress] = useState(() => typeof window === 'undefined' ? undefined : window.location.href);
  const [ready, setReady] = useState(() => appStartIntroSession.completed);
  const [source, setSource] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const eligible = useRef<boolean | undefined>(undefined);
  const active = useRef(false);
  const pending = useRef(false);
  const started = useRef(false);
  const attempt = useRef(0);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useLayoutEffect(() => {
    // Decide from the original entry, even if routing/auth already redirected it.
    // Query/hash links (including auth callbacks) also bypass the intro.
    if (eligible.current === undefined) {
      eligible.current = !appStartIntroSession.completed && entryAddress === 'https://www.caresuiteplus.app/';
    }
    if (!eligible.current) {
      appStartIntroSession.completed = true;
      setReady(true);
    }
    // Hand off the static loader before fonts/auth finish. Deciding in a layout
    // effect keeps server/client markup consistent and skips deep links before paint.
    document.getElementById('caresuite-web-boot')?.remove();
  }, [entryAddress]);

  const finish = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    pending.current = false;
    attempt.current += 1;
    clearTimeout(deadline.current);
    videoRef.current?.pause();
    appStartIntroSession.completed = true;
    setReady(true);
  }, []);

  const armWatchdog = useCallback(() => {
    clearTimeout(deadline.current);
    // No recovery prompt: a broken or stalled clip must release the application.
    deadline.current = setTimeout(finish, MAX_STARTUP_MS);
  }, [finish]);

  useEffect(() => {
    if (ready || !eligible.current) return;
    active.current = true;
    armWatchdog();
    try {
      // Choose once, after hydration. Resizing must not restart a playing clip.
      const format = selectAppStartIntroFormat(window.innerWidth, window.innerHeight);
      setSource(Asset.fromModule(appStartIntroAssets[format]).uri);
    } catch {
      finish();
    }
    return () => {
      active.current = false;
      pending.current = false;
      attempt.current += 1;
      clearTimeout(deadline.current);
      // An interrupted mount is handled too: remounting in this document must not replay it.
      appStartIntroSession.completed = true;
    };
  }, [armWatchdog, finish, ready]);

  const play = useCallback(async (withSound = true) => {
    const video = videoRef.current;
    if (!video || !active.current || video.ended) return;
    const currentAttempt = ++attempt.current;
    const current = () => active.current && currentAttempt === attempt.current;
    pending.current = true;
    // Try music first. Browser policy can only be bypassed by a real user
    // activation; muted playback still starts automatically without asking.
    for (const muted of withSound ? [false, true] : [true]) {
      try {
        video.muted = muted;
        video.volume = 1;
        // Called synchronously from a trusted click/touch/key event when retrying sound.
        await video.play();
        if (current()) pending.current = false;
        return;
      } catch (error) {
        if (!current()) return;
        const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
        if (!muted && (name === 'NotAllowedError' || name === 'AbortError')) continue;
        finish();
        return;
      }
    }
  }, [finish]);

  useEffect(() => {
    const video = videoRef.current;
    if (!source || ready) return;
    void play();
    const enableSound = (event: Event) => {
      if (!event.isTrusted || !active.current || pending.current) return;
      if (video && (video.muted || video.volume === 0)) void play();
    };
    // No start button or confirmation. Ordinary interaction enables music when
    // the browser permits it, without rewinding the already running video.
    const events = ['click', 'touchend', 'keydown'] as const;
    for (const event of events) document.addEventListener(event, enableSound, true);
    return () => {
      for (const event of events) document.removeEventListener(event, enableSound, true);
      video?.pause();
    };
  }, [source, ready, play]);

  return <AppStartIntroReadyContext.Provider value={ready}>
    <div data-caresuite-intro-content="" inert={!ready} aria-hidden={!ready || undefined}
      style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0, width: '100%', visibility: ready ? 'visible' : 'hidden' }}>
      {children}
    </div>
    {!ready && <div data-caresuite-start-intro="" role="region" aria-label="CareSuite Startvideo"
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: playing ? '#040b19' : '#F3F8FF', color: playing ? '#fff' : '#123251', display: 'flex', alignItems: 'center', justifyContent: 'center', isolation: 'isolate', boxSizing: 'border-box', padding: 'max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))' }}>
      <style>{`
        [data-caresuite-intro-panel] {
          position: relative; width: min(100%, 780px); max-height: 100%; overflow-y: auto;
          box-sizing: border-box; padding: clamp(24px, 4vw, 48px); text-align: center;
          border: 1px solid rgba(22, 131, 255, .2); border-radius: 28px;
          background: rgba(255, 255, 255, .9); box-shadow: 0 24px 80px rgba(18, 50, 81, .1);
          font-family: ${CARESUITE_FONT_STACK};
        }
        [data-caresuite-intro-brand] { margin: 0 0 16px; color: #0876E8; font-size: clamp(28px, 3vw, 44px); line-height: 1.2; font-weight: 700; }
        [data-caresuite-intro-message] { margin: 0; font-size: clamp(18px, 1.5vw, 22px); line-height: 1.5; font-weight: 600; }
        @media (max-height: 520px) { [data-caresuite-intro-panel] { padding: 20px; } }
      `}</style>
      {source ? <video ref={videoRef} src={source} playsInline preload="auto" loop={false} muted={false} controls={false}
        aria-label="CareSuite HealthOS" disablePictureInPicture
        onPlaying={() => {
          if (!active.current) return;
          started.current = true;
          setPlaying(true);
          armWatchdog();
        }}
        onPause={() => {
          const video = videoRef.current;
          // Safari can pause when sound is blocked. Resume silently, without a prompt.
          if (active.current && started.current && !pending.current && video?.paused && !video.ended && !video.error) void play(false);
        }}
        onEnded={finish} onError={finish}
        style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: playing ? 1 : 0 }} />
        : null}
      {!playing && <div data-caresuite-intro-panel="">
        <h1 data-caresuite-intro-brand="">CareSuite HealthOS</h1>
        <p role="status" data-caresuite-intro-message="">Startvideo wird vorbereitet…</p>
      </div>}
    </div>}
  </AppStartIntroReadyContext.Provider>;
}
