import { useEffect, useId, useRef, type ReactNode } from 'react';

export function AcademyDialog({ title, children, busy = false, onClose }: {
  title: string; children: ReactNode; busy?: boolean; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal?.();
    return () => dialog?.close?.();
  }, []);
  return <dialog ref={ref} className="ac-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="ac-dialog-head"><h2 id={titleId} className="ac-section-title">{title}</h2><button type="button" className="ac-button subtle" disabled={busy} onClick={onClose}>Schließen</button></div>
    <div className="ac-dialog-body">{children}</div>
  </dialog>;
}
