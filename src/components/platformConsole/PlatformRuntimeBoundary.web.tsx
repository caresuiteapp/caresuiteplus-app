import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { getPlatformRuntimeServerSnapshot, getPlatformRuntimeSnapshot, refreshPlatformRuntime, subscribePlatformRuntime } from '@/lib/platformConsole/platformRuntime.web';
import { PLATFORM_RUNTIME_WEB_RELEASE, platformRuntimeBlock } from '@/lib/platformConsole/platformRuntimePolicy';

export function usePlatformRuntime() {
  return useSyncExternalStore(subscribePlatformRuntime, getPlatformRuntimeSnapshot, getPlatformRuntimeServerSnapshot);
}

export function PlatformRuntimeBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const snapshot = usePlatformRuntime();
  const block = platformRuntimeBlock(pathname, snapshot);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.setAttribute('data-cs-platform-runtime', PLATFORM_RUNTIME_WEB_RELEASE);
    const check = () => { if (document.visibilityState !== 'hidden') void refreshPlatformRuntime(); };
    check();
    const timer = setInterval(check, 30_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(timer); window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check); document.documentElement.removeAttribute('data-cs-platform-runtime'); };
  }, []);
  useEffect(() => {
    if (!block) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [block]);
  const title = block === 'checking' ? 'Verfügbarkeit wird geprüft' : block === 'maintenance' ? 'CareSuite wird gerade gewartet'
    : block === 'registration' ? 'Firmenregistrierung derzeit pausiert' : 'Registrierung vorübergehend nicht verfügbar';
  const message = block === 'checking' ? 'Einen Moment bitte. Der aktuelle Betriebsstatus wird geladen.'
    : block === 'maintenance' ? 'Website und Websoftware stehen vorübergehend nicht zur Verfügung. Ihre Anmeldung bleibt erhalten. Nach der Freigabe können Sie hier weiterarbeiten.'
    : block === 'registration' ? 'Neue Unternehmen können sich aktuell nicht registrieren. Bereits registrierte Unternehmen können CareSuite weiterhin nutzen.'
    : 'Die Registrierungsfreigabe konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.';
  return <div className="cs-runtime-root">
    <style>{RUNTIME_STYLE}</style>
    {snapshot.settings?.notice && !block ? <aside className="cs-runtime-notice" role="status" tabIndex={0}><strong>CareSuite informiert</strong><span>{snapshot.settings.notice}</span></aside> : null}
    <div className="cs-runtime-content" aria-hidden={block ? true : undefined} ref={node => { node?.toggleAttribute('inert', Boolean(block)); }}>
      {children}
    </div>
    {block ? <div className="cs-runtime-overlay" role="dialog" aria-modal="true" aria-labelledby="cs-runtime-title" aria-describedby="cs-runtime-message"
      tabIndex={-1} ref={dialog} onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const nodes = dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)');
        if (!nodes?.length) { event.preventDefault(); return; }
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
      }}><section className="cs-runtime-card">
        <img src="/care-suite-brand/wordmark.png" alt="CareSuite HealthOS" className="cs-runtime-logo" />
        <p className="cs-runtime-eyebrow">CareSuite HealthOS</p><h1 id="cs-runtime-title">{title}</h1><p id="cs-runtime-message">{message}</p>
        {snapshot.settings?.notice ? <p className="cs-runtime-card-notice">{snapshot.settings.notice}</p> : null}
        {block !== 'checking' ? <div className="cs-runtime-actions"><button onClick={() => void refreshPlatformRuntime()}>Erneut prüfen</button>
          <a href="/support">Hilfe und Kontakt</a><a href="/datenschutz">Datenschutz</a><a href="/impressum">Impressum</a>
          {block === 'maintenance' ? <a href="/platform/login">Plattformverwaltung</a> : <a href="/auth">Zur Anmeldung</a>}
        </div> : null}
      </section></div> : null}
  </div>;
}

export function PlatformRuntimeStatus() {
  const snapshot = usePlatformRuntime();
  return <div className={`cs-notice${snapshot.status === 'failed' ? ' error' : ''}`} role="status">
    {snapshot.settings ? <>
      <strong>Aktueller Betriebsstatus: </strong>Wartung {snapshot.settings.maintenanceMode ? 'eingeschaltet' : 'ausgeschaltet'} · Firmenregistrierung {snapshot.settings.registrationEnabled ? 'freigegeben' : 'pausiert'} · Plattformhinweis {snapshot.settings.notice ? 'eingeblendet' : 'ausgeblendet'}.
      <p>Geöffnete Seiten der Website und Websoftware prüfen Änderungen alle 30 Sekunden. Die Plattformverwaltung, Hilfe und rechtliche Informationen bleiben bei Wartung erreichbar.</p>
      {snapshot.status === 'failed' ? <p>Die letzte erneute Abfrage ist fehlgeschlagen. Angezeigt wird der zuletzt bestätigte Betriebsstatus.</p> : null}
    </> : snapshot.status === 'checking' ? 'Die Anbindung der Betriebseinstellungen wird geprüft.' : 'Die Anbindung der Betriebseinstellungen konnte nicht bestätigt werden.'}
    <button className="cs-link" onClick={() => void refreshPlatformRuntime()}>Erneut prüfen</button>
  </div>;
}

const RUNTIME_STYLE = `
.cs-runtime-root{position:relative;display:flex;flex-direction:column;flex:1;min-height:0;height:100%;width:100%}
.cs-runtime-content{display:flex;flex-direction:column;flex:1;min-height:0}
.cs-runtime-notice{box-sizing:border-box;max-height:min(28vh,240px);overflow:auto;flex-shrink:0;display:flex;gap:12px;align-items:flex-start;background:#eaf4ff;color:#12385b;border-bottom:1px solid #b6d7f7;padding:12px clamp(16px,3vw,36px);line-height:1.5;font-family:CenturyGothic,Arial,sans-serif;overflow-wrap:anywhere}
.cs-runtime-notice strong{flex-shrink:0}.cs-runtime-notice span,.cs-runtime-card-notice{white-space:pre-wrap;overflow-wrap:anywhere}
.cs-runtime-overlay{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;align-items:safe center;overflow:auto;padding:clamp(16px,4vw,48px);background:radial-gradient(ellipse at 30% 0,#164c78,#06172b 65%);color:#eef8ff;font-family:CenturyGothic,Arial,sans-serif;line-height:1.65;box-sizing:border-box}
.cs-runtime-card{box-sizing:border-box;width:min(100%,680px);padding:clamp(24px,4vw,44px);border:1px solid #4f7aa0;border-radius:30px;background:#0c2640;box-shadow:0 20px 80px #0005;overflow-wrap:anywhere}
.cs-runtime-logo{display:block;width:min(100%,320px);height:auto;margin:0 0 32px}.cs-runtime-eyebrow{color:#a7dcff;font-size:.85rem;letter-spacing:.1em;text-transform:uppercase;margin:0 0 12px}
.cs-runtime-card h1{font-size:clamp(1.65rem,4vw,2.4rem);line-height:1.2;margin:0 0 20px;color:#fff}.cs-runtime-card p{margin:0 0 20px}.cs-runtime-card-notice{padding:16px 20px;border-radius:18px;border:1px solid #456b8c;background:#133650}
.cs-runtime-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.cs-runtime-actions a,.cs-runtime-actions button{box-sizing:border-box;display:inline-flex;justify-content:center;align-items:center;min-height:48px;border:1px solid #729aba;border-radius:14px;padding:10px 18px;background:#123955;color:#fff;font:inherit;text-decoration:none;cursor:pointer;text-align:center}
.cs-runtime-actions button{background:#086bea;border-color:#086bea}.cs-runtime-actions a:focus-visible,.cs-runtime-actions button:focus-visible{outline:3px solid #b8eaff;outline-offset:4px}
@media(max-width:560px){.cs-runtime-notice{flex-direction:column;gap:4px}.cs-runtime-card{border-radius:24px}.cs-runtime-actions{flex-direction:column}.cs-runtime-actions>*{width:100%}}
`;
