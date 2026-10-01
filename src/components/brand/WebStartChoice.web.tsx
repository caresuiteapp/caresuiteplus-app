import React, { useEffect, useRef, useState } from 'react';
import { webStartChoiceStyles } from './webStartChoiceStyles.web';

type Props = { onSoftware: () => void; active: boolean };

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Presentation only: the parent owns the intro and destination state. */
export function WebStartChoice({ onSoftware, active }: Props) {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [openingComplete, setOpeningComplete] = useState(false);
  const websiteRef = useRef<HTMLAnchorElement>(null);
  const softwareRef = useRef<HTMLButtonElement>(null);
  const motion = active && !paused && !reducedMotion;

  useEffect(() => {
    if (!active) return;
    // The intro's focused control has unmounted; make remote/keyboard navigation immediate.
    websiteRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => setOpeningComplete(true), 1900);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const move = (event: React.PointerEvent<HTMLElement>) => {
    if (!motion || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    event.currentTarget.style.setProperty('--cs-start-rx', `${(0.5 - y) * 3}deg`);
    event.currentTarget.style.setProperty('--cs-start-ry', `${(x - 0.5) * 4}deg`);
    event.currentTarget.style.setProperty('--cs-start-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--cs-start-y', `${y * 100}%`);
  };
  const reset = (event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--cs-start-rx', '0deg');
    event.currentTarget.style.setProperty('--cs-start-ry', '0deg');
  };
  const navigate = (event: React.KeyboardEvent<HTMLElement>, destination: 'website' | 'software') => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (destination === 'website' && event.key === 'ArrowRight') {
      event.preventDefault(); softwareRef.current?.focus();
    } else if (destination === 'software' && event.key === 'ArrowLeft') {
      event.preventDefault(); websiteRef.current?.focus();
    }
  };

  return (
    <main className="cs-start-screen" data-active={active} data-motion={motion} data-opening={active && !openingComplete} aria-labelledby="cs-start-title">
      <style>{webStartChoiceStyles}</style>
      <div className="cs-start-atmosphere" aria-hidden="true">
        <div className="cs-start-halo cs-start-halo-one" />
        <div className="cs-start-halo cs-start-halo-two" />
        <div className="cs-start-grid" />
        <div className="cs-start-stars" />
        <div className="cs-start-horizon" />
        <div className="cs-start-opening"><span className="cs-start-opening-left" /><span className="cs-start-opening-right" /><span className="cs-start-opening-flare" /><span className="cs-start-opening-ring" /></div>
      </div>
      <div className="cs-start-inner">
        <header className="cs-start-topbar">
          <img className="cs-start-brand" src="/landingpage/media/brand.png" alt="CareSuite HealthOS" width="2048" height="256" />
          <button className="cs-start-motion" type="button" onClick={() => { setOpeningComplete(true); setPaused(value => !value); }} aria-pressed={paused} disabled={reducedMotion}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">{paused || reducedMotion ? <path d="m7 4 9 6-9 6V4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /> : <path d="M7 4v12m6-12v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}</svg>
            <span>{reducedMotion ? 'Bewegung reduziert' : paused ? 'Animationen fortsetzen' : 'Animationen pausieren'}</span>
          </button>
        </header>

        <section className="cs-start-heading">
          <p className="cs-start-eyebrow"><span /> Willkommen bei CareSuite</p>
          <h1 id="cs-start-title">Entdecken. <span>Oder direkt loslegen.</span></h1>
          <p className="cs-start-introduction">Lerne HealthOS kennen oder starte in deinen persönlichen Arbeitsbereich.</p>
        </section>

        <nav className="cs-start-choices" aria-label="Webseite oder Software auswählen">
          <a ref={websiteRef} className="cs-start-card cs-start-website" href="/landingpage" onPointerMove={move} onPointerLeave={reset} onKeyDown={event => navigate(event, 'website')} aria-labelledby="cs-start-website-title" aria-describedby="cs-start-website-description">
            <span className="cs-start-card-media">
              <img className="cs-start-orbit-image" src="/landingpage/media/healthos-orbit.webp" alt="" width="1536" height="1024" />
              <span className="cs-start-media-shade" />
              <span className="cs-start-media-label">Die Welt von HealthOS</span>
              <span className="cs-start-media-word" aria-hidden="true">Mehr<br /><em>möglich.</em></span>
            </span>
            <span className="cs-start-card-content">
              <span className="cs-start-card-kicker">01 / Entdecken</span>
              <span className="cs-start-card-title" id="cs-start-website-title">Zur Webseite</span>
              <span className="cs-start-card-description" id="cs-start-website-description">Die Idee, die Möglichkeiten und echte Einblicke in CareSuite HealthOS.</span>
              <span className="cs-start-card-action"><span>HealthOS entdecken</span><span className="cs-start-arrow"><ArrowIcon /></span></span>
            </span>
            <span className="cs-start-card-sheen" aria-hidden="true" />
          </a>

          <button ref={softwareRef} className="cs-start-card cs-start-software" type="button" onClick={onSoftware} onPointerMove={move} onPointerLeave={reset} onKeyDown={event => navigate(event, 'software')} aria-labelledby="cs-start-software-title" aria-describedby="cs-start-software-description">
            <span className="cs-start-card-media">
              <span className="cs-start-software-glow" />
              <img className="cs-start-desktop-image" src="/landingpage/media/admin-desktop.jpg" alt="CareSuite-Verwaltungsoberfläche aus dem Demo-Zugang" width="1363" height="936" />
              <span className="cs-start-media-shade" />
              <span className="cs-start-media-label">Originalansicht · Verwaltung</span>
            </span>
            <span className="cs-start-card-content">
              <span className="cs-start-card-kicker">02 / Anmelden</span>
              <span className="cs-start-card-title" id="cs-start-software-title">Zur Software</span>
              <span className="cs-start-card-description" id="cs-start-software-description">Zu den Zugängen für Verwaltung, Mitarbeitende und Klient:innen.</span>
              <span className="cs-start-card-action"><span>Login-Übersicht öffnen</span><span className="cs-start-arrow"><ArrowIcon /></span></span>
            </span>
            <span className="cs-start-card-sheen" aria-hidden="true" />
          </button>
        </nav>

        <footer className="cs-start-footer"><span>CareSuite <strong>HealthOS</strong></span><span>Ein System. Menschen im Mittelpunkt.</span></footer>
      </div>
    </main>
  );
}

export default WebStartChoice;
