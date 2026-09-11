import { CARESUITE_FONT_STACK } from '@/design/tokens/fontFamily';
import React, { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Asset } from 'expo-asset';
import { appStartIntroAssets } from './appStartIntroAssets';
import { appStartIntroSession, AppStartIntroReadyContext } from './appStartIntroSession';
import { selectAppStartIntroFormat } from './selectAppStartIntroFormat';

// Memory only: route changes keep the result; each new document plays again.
const MAX_STARTUP_MS = 20_000;
const controlStyle: CSSProperties = {
  minHeight: 48, padding: '12px 20px', borderRadius: 14, border: '1px solid #63cdf0',
  background: '#092940', color: '#fff', font: `600 16px/1.4 ${CARESUITE_FONT_STACK}`, cursor: 'pointer',
};

export function AppStartIntro({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => appStartIntroSession.completed);
  const [source, setSource] = useState<string>();
  const [muted, setMuted] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = useRef(false);
  const attempt = useRef(0);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const finish = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    attempt.current += 1;
    clearTimeout(deadline.current);
    videoRef.current?.pause();
    appStartIntroSession.completed = true;
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) return;
    active.current = true;
    deadline.current = setTimeout(finish, MAX_STARTUP_MS);
    try {
      // Choose once, after hydration. Resizing must not restart a playing clip.
      const format = selectAppStartIntroFormat(window.innerWidth, window.innerHeight);
      setSource(Asset.fromModule(appStartIntroAssets[format]).uri);
    } catch {
      finish();
    }
    return () => {
      active.current = false;
      attempt.current += 1;
      clearTimeout(deadline.current);
      videoRef.current?.pause();
    };
  }, [finish, ready]);

  const play = useCallback(async (withSound: boolean) => {
    const video = videoRef.current;
    if (!video || !active.current) return;
    const currentAttempt = ++attempt.current;
    const current = () => active.current && currentAttempt === attempt.current;
    video.muted = !withSound;
    setMuted(!withSound);
    setNeedsGesture(false);
    try {
      await video.play();
    } catch {
      if (!current()) return;
      // Browsers may block audible autoplay even though the file is ready.
      video.muted = true;
      setMuted(true);
      try {
        await video.play();
      } catch {
        if (current()) setNeedsGesture(true);
      }
    }
  }, []);

  useEffect(() => {
    if (source && !ready) void play(true);
  }, [source, ready, play]);

  return <AppStartIntroReadyContext.Provider value={ready}>
    <div data-caresuite-intro-content="" inert={!ready} aria-hidden={!ready || undefined}
      style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, minWidth: 0, width: '100%', visibility: ready ? 'visible' : 'hidden' }}>
      {children}
    </div>
    {!ready && <div data-caresuite-start-intro="" role="region" aria-label="CareSuite Startvideo"
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: '#040b19', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', isolation: 'isolate' }}>
      {source ? <video ref={videoRef} src={source} playsInline preload="auto" loop={false}
        aria-label="CareSuite HealthOS" disablePictureInPicture onEnded={finish} onError={finish}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
        : <span role="status" style={{ font: `600 20px/1.5 ${CARESUITE_FONT_STACK}` }}>CareSuite HealthOS</span>}
      {source && <div style={{ position: 'absolute', bottom: 'max(24px, env(safe-area-inset-bottom))', left: 16, right: 16, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {needsGesture ? <button type="button" style={controlStyle} onClick={() => void play(true)}>Startvideo abspielen</button>
          : <button type="button" style={controlStyle} onClick={() => {
            if (muted) void play(true);
            else { if (videoRef.current) videoRef.current.muted = true; setMuted(true); }
          }}>{muted ? 'Ton einschalten' : 'Ton ausschalten'}</button>}
      </div>}
    </div>}
  </AppStartIntroReadyContext.Provider>;
}
