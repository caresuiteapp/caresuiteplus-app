import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PersonnelLeaveGuardContext } from '@/hooks/usePersonnelUnsavedChanges.web';
import { PersonnelIcon } from './PersonnelPrimitives.web';
import { personnelCss } from './personnelCss.web';

/** Native dialog provides focus trapping and restores focus without changing body styles. */
export function PersonnelDialog({ visible, title, form = false, onClose, children }: { visible: boolean; title: string; form?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const leaveGuard = useRef<(() => boolean) | null>(null);
  const registerGuard = useCallback((guard: (() => boolean) | null) => { leaveGuard.current = guard; }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !visible) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [visible]);
  function close() {
    if (ref.current?.querySelector('form[aria-busy="true"]')) return;
    if (leaveGuard.current && !leaveGuard.current()) return;
    onClose();
  }
  if (!visible || typeof document === 'undefined') return null;
  return createPortal(<PersonnelLeaveGuardContext.Provider value={registerGuard}><style>{personnelCss}</style><dialog ref={ref} className={`pe-dialog${form ? ' pe-dialog--form' : ''}`} aria-labelledby={id} onCancel={event => { event.preventDefault(); close(); }}><header className="pe-dialog-header"><div><small>CARESUITE HEALTHOS · PERSONAL</small><strong id={id}>{title}</strong></div><button type="button" onClick={close} aria-label={`${title} schließen`}><PersonnelIcon name="close" /></button></header><div className="pe-dialog-body">{children}</div></dialog></PersonnelLeaveGuardContext.Provider>, document.body);
}
