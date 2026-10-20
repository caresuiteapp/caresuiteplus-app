import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Native browser modal: the rest of the portal is inert until navigation to signing. */
export function ClientSignatureRequiredDialog({ count, onOpen }: { count: number; onOpen: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    action.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<>
    <style>{`
      .cs-signature-required { box-sizing: border-box; width: min(580px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); margin: auto; padding: 0; overflow: auto; border: 1px solid #9ccbee; border-radius: 24px; background: #f8fbff; color: #102d4b; font-family: inherit; box-shadow: 0 24px 80px #05183155; }
      .cs-signature-required::backdrop { background: #06192ec7; backdrop-filter: blur(5px); }
      .cs-signature-required header { padding: 24px 28px 20px; background: #eaf4ff; border-bottom: 1px solid #c8dcec; }
      .cs-signature-required h2 { margin: 10px 0 0; font-size: calc(24px * var(--app-font-scale, 1)); line-height: 1.3; overflow-wrap: anywhere; }
      .cs-signature-required .cs-signature-count { display: inline-block; padding: 6px 11px; border-radius: 99px; background: #ffefcc; color: #724300; font-size: calc(14px * var(--app-font-scale, 1)); font-weight: 700; }
      .cs-signature-required .cs-signature-body { padding: 24px 28px 28px; }
      .cs-signature-required p { margin: 0 0 16px; font-size: calc(17px * var(--app-font-scale, 1)); line-height: 1.55; }
      .cs-signature-required .cs-signature-note { color: #486078; font-size: calc(15px * var(--app-font-scale, 1)); }
      .cs-signature-required button { box-sizing: border-box; width: 100%; min-height: 52px; padding: 14px 18px; border: 0; border-radius: 14px; background: #096cda; color: white; font-family: inherit; font-size: calc(17px * var(--app-font-scale, 1)); font-weight: 700; line-height: 1.4; cursor: pointer; }
      .cs-signature-required button:hover { background: #075bb8; }
      .cs-signature-required button:focus-visible { outline: 3px solid #f1ad36; outline-offset: 3px; }
      @media (max-width: 500px) { .cs-signature-required header, .cs-signature-required .cs-signature-body { padding: 20px; } }
    `}</style>
    <dialog ref={dialog} className="cs-signature-required" aria-labelledby="cs-signature-required-title" aria-describedby="cs-signature-required-description" onCancel={(event) => event.preventDefault()}>
      <header>
        <span className="cs-signature-count">{count} {count === 1 ? 'Unterschrift offen' : 'Unterschriften offen'}</span>
        <h2 id="cs-signature-required-title">Ihre Unterschrift wird benötigt</h2>
      </header>
      <div className="cs-signature-body">
        <p id="cs-signature-required-description">Bitte prüfen und unterschreiben Sie Ihre offenen Leistungsnachweise und Dokumente.</p>
        <p className="cs-signature-note">Im Bereich „Unterschriften“ können Sie alles in Ruhe lesen und bearbeiten. Auf den anderen Portalseiten erscheint dieser Hinweis, bis alle Ihre Unterschriften gespeichert sind.</p>
        <button ref={action} type="button" onClick={onOpen}>Zu den offenen Unterschriften</button>
      </div>
    </dialog>
  </>, document.body);
}
