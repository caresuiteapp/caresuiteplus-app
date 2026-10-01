import { CARESUITE_FONT_STACK } from '@/design/tokens/fontFamily';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Asset } from 'expo-asset';
import { appStartIntroAssets } from './appStartIntroAssets';
import { appStartIntroSession, AppStartIntroReadyContext } from './appStartIntroSession';
import { selectAppStartIntroFormat } from './selectAppStartIntroFormat';

// Memory only: route changes keep the result; each new document plays again.
const MAX_STARTUP_MS = 20_000;

export function AppStartIntro({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => appStartIntroSession.completed);
  const [source, setSource] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const active = useRef(false);
  const attempt = useRef(0);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useLayoutEffect(() => {
    // The static document loader sits above the React root. Hand off as soon as
    // the intro mounts, without waiting for fonts, authentication or RootShell.
    document.getElementById('caresuite-web-boot')?.remove();
  }, []);

  const finish = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    attempt.current += 1;
    clearTimeout(deadline.current);
    videoRef.current?.pause();
    appStartIntroSession.completed = true;
    setReady(true);
  }, []);

  const recover = useCallback(() => {
    if (!active.current) return;
    attempt.current += 1;
    videoRef.current?.pause();
    setPlaying(false);
    setPlaybackError(true);
    setNeedsGesture(true);
    clearTimeout(deadline.current);
    // Offer recovery first, while still guaranteeing access if media never loads.
    deadline.current = setTimeout(finish, MAX_STARTUP_MS);
  }, [finish]);

  const armWatchdog = useCallback(() => {
    clearTimeout(deadline.current);
    deadline.current = setTimeout(recover, MAX_STARTUP_MS);
  }, [recover]);

  const requestGesture = useCallback(() => {
    if (!active.current) return;
    attempt.current += 1;
    videoRef.current?.pause();
    setPlaying(false);
    setNeedsGesture(true);
    clearTimeout(deadline.current);
    // No silent fallback. Wait for a genuine tap, but never block login forever.
    deadline.current = setTimeout(finish, MAX_STARTUP_MS);
  }, [finish]);

  useEffect(() => {
    if (ready) return;
    active.current = true;
    armWatchdog();
    try {
      // Choose once, after hydration. Resizing must not restart a playing clip.
      const format = selectAppStartIntroFormat(window.innerWidth, window.innerHeight);
      setSource(Asset.fromModule(appStartIntroAssets[format]).uri);
    } catch {
      recover();
    }
    return () => {
      active.current = false;
      attempt.current += 1;
      clearTimeout(deadline.current);
    };
  }, [armWatchdog, recover, ready]);

  const play = useCallback(async (restart = false) => {
    const video = videoRef.current;
    if (!video || !active.current) return;
    const currentAttempt = ++attempt.current;
    const current = () => active.current && currentAttempt === attempt.current;
    armWatchdog();
    setNeedsGesture(false);
    setPlaybackError(false);
    try {
      if (video.error) video.load();
      if (restart) video.currentTime = 0;
      video.muted = false;
      video.volume = 1;
      // Keep play() inside the click call stack for Safari's activation policy.
      await video.play();
    } catch (error) {
      if (!current()) return;
      const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
      if (name === 'NotAllowedError' || name === 'AbortError') requestGesture();
      else recover();
    }
  }, [armWatchdog, recover, requestGesture]);

  useEffect(() => {
    const video = videoRef.current;
    if (source && !ready) void play();
    return () => video?.pause();
  }, [source, ready, play]);

  useEffect(() => {
    if (ready || !needsGesture) return;
    // A visible native button gives keyboard and TV remotes the same activation
    // path as touch, preserving the browser's user-gesture requirement for sound.
    (startButtonRef.current ?? continueButtonRef.current)?.focus({ preventScroll: true });
  }, [needsGesture, playbackError, ready, source]);

  return <AppStartIntroReadyContext.Provider value={ready}>
    <div data-caresuite-intro-content="" inert={!ready} aria-hidden={!ready || undefined}
      style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0, width: '100%', visibility: ready ? 'visible' : 'hidden' }}>
      {children}
    </div>
    {!ready && <div data-caresuite-start-intro="" role="region" aria-label="CareSuite Startvideo"
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: playing ? '#040b19' : '#F3F8FF', color: playing ? '#fff' : '#123251', display: 'flex', alignItems: 'center', justifyContent: 'center', isolation: 'isolate', boxSizing: 'border-box', padding: 'max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))' }}>
      <style>{`
        [data-caresuite-intro-panel] {
          position: relative; width: min(100%, 860px); max-height: 100%; overflow-y: auto;
          box-sizing: border-box; padding: clamp(24px, 4vw, 56px); text-align: center;
          border: 1px solid rgba(22, 131, 255, .2); border-radius: 28px;
          background: rgba(255, 255, 255, .9); box-shadow: 0 24px 80px rgba(18, 50, 81, .1);
          font-family: ${CARESUITE_FONT_STACK};
        }
        [data-caresuite-intro-brand] { margin: 0 0 20px; color: #0876E8; font-size: clamp(28px, 3vw, 56px); line-height: 1.2; font-weight: 700; }
        [data-caresuite-intro-message] { margin: 0; font-size: clamp(18px, 1.5vw, 28px); line-height: 1.5; font-weight: 600; }
        [data-caresuite-intro-hint] { margin: 12px 0 0; color: #496580; font-size: clamp(15px, 1.2vw, 22px); line-height: 1.5; }
        [data-caresuite-intro-actions] { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 28px; }
        [data-caresuite-intro-actions] button {
          min-height: 56px; max-width: 100%; padding: 14px 28px; border: 2px solid #0876E8;
          border-radius: 14px; background: #0876E8; color: #fff; cursor: pointer;
          font: 700 clamp(17px, 1.3vw, 26px)/1.35 ${CARESUITE_FONT_STACK};
        }
        [data-caresuite-intro-actions] button:hover { background: #0560C4; border-color: #0560C4; }
        [data-caresuite-intro-actions] button:focus-visible { outline: 4px solid #123251; outline-offset: 5px; }
        [data-caresuite-intro-actions] button[data-caresuite-intro-continue] { background: #fff; color: #123251; border-color: #A8BED3; }
        @media (min-width: 1800px) and (min-height: 950px) {
          [data-caresuite-intro-panel] { width: min(90%, 1120px); padding: 64px; border-radius: 36px; }
          [data-caresuite-intro-actions] button { min-height: 72px; padding: 18px 36px; }
        }
        @media (max-height: 520px) {
          [data-caresuite-intro-panel] { padding: 20px; }
          [data-caresuite-intro-brand] { margin-bottom: 12px; }
          [data-caresuite-intro-actions] { margin-top: 18px; }
        }
      `}</style>
      {source ? <video ref={videoRef} src={source} playsInline preload="auto" loop={false} muted={false} controls={false}
        aria-label="CareSuite HealthOS" disablePictureInPicture
        onPlaying={() => {
          if (!active.current) return;
          if (videoRef.current?.muted || videoRef.current?.volume === 0) { requestGesture(); return; }
          setPlaying(true); setNeedsGesture(false); setPlaybackError(false); armWatchdog();
        }}
        onPause={() => {
          const video = videoRef.current;
          if (active.current && video?.paused && !video.ended && !video.error) requestGesture();
        }}
        onVolumeChange={() => { if (videoRef.current?.muted || videoRef.current?.volume === 0) requestGesture(); }}
        onEnded={finish} onError={recover}
        style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: playing ? 1 : 0 }} />
        : null}
      {!playing && <div data-caresuite-intro-panel="">
        <h1 data-caresuite-intro-brand="">CareSuite HealthOS</h1>
        <div role="status">
          <p data-caresuite-intro-message="">{playbackError ? 'Das Startvideo konnte nicht abgespielt werden.'
            : needsGesture ? 'Starten Sie das Intro mit Musik.'
              : 'Startvideo wird vorbereitet…'}</p>
          {needsGesture && <p id="caresuite-intro-activation-hint" data-caresuite-intro-hint="">
            {playbackError ? 'Erneut versuchen oder direkt zur Anmeldung weitergehen.' : 'Mit Maus, Touch oder OK auf Ihrer Fernbedienung. Die Eingabetaste funktioniert ebenfalls.'}
          </p>}
        </div>
        {needsGesture && <div data-caresuite-intro-actions="">
          {source && <button ref={startButtonRef} type="button" aria-label="Intro mit Musik starten"
            aria-describedby="caresuite-intro-activation-hint" onClick={() => void play(true)}>
            {playbackError ? 'Intro erneut starten' : 'Intro mit Musik starten'}
          </button>}
          {playbackError && <button ref={continueButtonRef} type="button" data-caresuite-intro-continue="" onClick={finish}>
            Weiter zur Anmeldung
          </button>}
        </div>}
      </div>}
    </div>}
  </AppStartIntroReadyContext.Provider>;
}
