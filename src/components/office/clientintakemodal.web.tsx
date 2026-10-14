import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { ClientIntakeWizardForm } from './clientintakewizardform.web';
import { clientIntakeExperienceCss } from './clientIntakeExperienceCss.web';
import type { ClientIntakeModalProps } from './clientintakemodal.tsx';

export type { ClientIntakeModalProps } from './clientintakemodal.tsx';

export function ClientIntakeModal(props: ClientIntakeModalProps) {
  if (!props.visible || typeof document === 'undefined') return null;
  return <IntakeDialog {...props} />;
}

function IntakeDialog({ onClose, mode = 'create', clientId, onCreated, onUpdated }: ClientIntakeModalProps) {
  const titleId = useId();
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRequest = useRef<() => void>(onClose);
  const setCloseRequest = useCallback((handler: (() => void) | null) => { closeRequest.current = handler ?? onClose; }, [onClose]);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus(); };
  }, [opener]);
  return createPortal(<div className="ci-modal-overlay"><style>{clientIntakeExperienceCss}</style><div className="ci-modal" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={event => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRequest.current(); }
    if (event.key !== 'Tab') return;
    const elements = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') ?? [])].filter(element => !element.closest('[inert]') && element.getClientRects().length > 0);
    const first = elements[0]; const last = elements.at(-1);
    if (!first) { event.preventDefault(); dialog.current?.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
  }}><header className="ci-modal-header"><span aria-hidden="true">▤</span><h1 id={titleId}>{mode === 'edit' ? 'Klientenakte bearbeiten' : 'Klient:in aufnehmen'}</h1><button className="ci-modal-close" type="button" aria-label="Aufnahme schließen" onClick={() => closeRequest.current()}>×</button></header><SurfaceContrastProvider tone="light"><ClientIntakeWizardForm mode={mode} clientId={clientId} onCancel={onClose} onCloseRequestChange={setCloseRequest} onCreated={id => { onCreated?.(id); onClose(); }} onUpdated={id => { onUpdated?.(id); onClose(); }} showHero={false} /></SurfaceContrastProvider></div></div>, document.body);
}
