import { useEffect, useState } from 'react';
import { useAppStartIntroReady } from '@/components/brand/appStartIntroSession';
import { latestWebEntryScript, webEntryScript } from '@/lib/platform/webRelease';

/** An open SPA keeps its bundle after deployment; offer a deliberate refresh. */
export function WebReleaseNotice() {
  const introReady = useAppStartIntroReady();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!introReady) return;
    const origin = window.location.origin;
    const loaded = webEntryScript(Array.from(document.scripts, script => script.src), origin);
    if (!loaded) return; // Development and non-Expo documents do not have a release marker.
    let active = true;
    let pending: AbortController | null = null;
    let lastCheck = 0;
    const check = async () => {
      if (!active || document.visibilityState === 'hidden' || pending || Date.now() - lastCheck < 10_000) return;
      lastCheck = Date.now();
      const controller = new AbortController();
      pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 8_000);
      try {
        const latest = await latestWebEntryScript(origin, controller.signal);
        if (active && latest) setAvailable(latest !== loaded);
      } finally {
        window.clearTimeout(timeout);
        if (pending === controller) pending = null;
      }
    };
    const onResume = () => { void check(); };
    onResume();
    const interval = window.setInterval(onResume, 60_000);
    window.addEventListener('focus', onResume);
    window.addEventListener('online', onResume);
    document.addEventListener('visibilitychange', onResume);
    return () => {
      active = false;
      pending?.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', onResume);
      window.removeEventListener('online', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [introReady]);

  if (!available) return null;
  return <aside className="cs-web-release-notice" aria-label="CareSuite aktualisieren">
    <style>{NOTICE_CSS}</style>
    <div role="status" aria-live="polite">
      <strong>Eine neue CareSuite-Version ist verfügbar.</strong>
      <p>Speichern Sie offene Eingaben und laden Sie anschließend neu.</p>
    </div>
    <button type="button" onClick={() => window.location.reload()}>Jetzt aktualisieren</button>
  </aside>;
}

const NOTICE_CSS = `
.cs-web-release-notice{position:fixed;z-index:9800;bottom:max(16px,env(safe-area-inset-bottom));right:max(16px,env(safe-area-inset-right));box-sizing:border-box;max-width:min(560px,calc(100vw - 32px));display:flex;align-items:center;gap:16px;padding:16px 20px;border:1px solid #5486a8;border-radius:18px;background:#0b243c;color:#eaf6ff;font:inherit;box-shadow:0 8px 28px #0006}
.cs-web-release-notice div{min-width:0}.cs-web-release-notice strong{font-weight:700}.cs-web-release-notice p{margin:6px 0 0;color:#c4dced;line-height:1.5}
.cs-web-release-notice button{flex-shrink:0;min-height:44px;padding:10px 14px;border:1px solid #81dcff;border-radius:12px;background:#124868;color:#fff;font:inherit;cursor:pointer}
.cs-web-release-notice button:focus-visible{outline:3px solid #b8eaff;outline-offset:3px}
@media(max-width:600px){.cs-web-release-notice{left:max(16px,env(safe-area-inset-left));right:max(16px,env(safe-area-inset-right));max-width:none;flex-direction:column;align-items:stretch}.cs-web-release-notice button{width:100%}}
`;
