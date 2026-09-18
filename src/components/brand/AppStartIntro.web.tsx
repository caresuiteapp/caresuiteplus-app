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

  return <AppStartIntroReadyContext.Provider value={ready}>
    <div data-caresuite-intro-content="" inert={!ready} aria-hidden={!ready || undefined}
      style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0, width: '100%', visibility: ready ? 'visible' : 'hidden' }}>
      {children}
    </div>
    {!ready && <div data-caresuite-start-intro="" role="region" aria-label="CareSuite Startvideo"
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: playing ? '#040b19' : '#F3F8FF', color: playing ? '#fff' : '#123251', display: 'flex', alignItems: 'center', justifyContent: 'center', isolation: 'isolate' }}>
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
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', opacity: playing ? 1 : 0 }} />
        : null}
      {!playing && <div role="status" style={{ position: 'absolute', padding: 24, textAlign: 'center', font: `600 20px/1.5 ${CARESUITE_FONT_STACK}` }}>
        <div style={{ color: '#0876E8', marginBottom: 16 }}>CareSuite HealthOS</div>
        <span style={{ fontSize: 16 }}>{playbackError ? 'Das Startvideo konnte nicht abgespielt werden. Zum erneuten Starten tippen.'
          : needsGesture ? 'Zum Starten mit Musik tippen'
            : 'Startvideo wird vorbereitet…'}</span>
      </div>}
      {needsGesture && source && <button type="button" aria-label="Intro mit Musik starten"
        onClick={() => void play(true)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0,
          border: 0, borderRadius: 0, background: 'transparent', cursor: 'pointer', outlineOffset: -8 }} />}
    </div>}
  </AppStartIntroReadyContext.Provider>;
}
