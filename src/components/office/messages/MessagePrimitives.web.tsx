import { WebActionIcon } from '@/components/icons/WebActionIcon.web';
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { messageInitials } from '@/lib/office/messageWorkspace.web';
import { messageWorkspaceCss } from './messageWorkspaceCss.web';

const paths = {
  chat: 'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z M8 10h.01 M12 10h.01 M16 10h.01',
  plus: 'M12 5v14 M5 12h14', search: 'm21 21-5-5 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  send: 'm21 3-7 18-4-7-7-4Z M10 14 21 3', close: 'm6 6 12 12 M6 18 18 6',
  back: 'M19 12H5 m6-6-6 6 6 6', check: 'm5 12 4 4L19 6', chevron: 'm9 5 7 7-7 7',
  file: 'M14 3H5v18h14V8zm0 0v5h5 M8 12h8 M8 16h6',
  people: 'M16 21v-2a6 6 0 0 0-12 0v2 M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M18 4a4 4 0 0 1 0 7 M20 15a5 5 0 0 1 2 4v2',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3 M4 10h16v11H4Z M12 14v3',
  archive: 'M3 3h18v5H3Z M5 8v13h14V8 M10 12h4',
  refresh: 'M20 7v5h-5 M20 12a8 8 0 1 0-2 5 M20 7l-3-3',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7h.01',
  clip: 'm8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2 M6 15l9-9',
  mic: 'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0Z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8',
  stop: 'M5 5h14v14H5Z', smile: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M8 9h.01 M16 9h.01 M8 14q4 5 8 0',
  broadcast: 'M3 9h5l12-5v16L8 15H3Z M8 15l2 6H6l-2-6 M8 9v6',
  settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  edit: 'm15 5 4 4 M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15Z',
} as const;
export function MessageIcon({ name }: { name: keyof typeof paths }) {
  return <WebActionIcon><path d={paths[name]} /></WebActionIcon>;
}
export function MessageButton({ children, icon, tone = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: keyof typeof paths; tone?: 'primary' | 'secondary' | 'danger' | 'quiet' }) {
  return <button type="button" {...props} className={`mw-button mw-button--${tone} ${className}`}>{icon && <MessageIcon name={icon} />}{children}</button>;
}
export function MessageAvatar({ name, group = false, large = false }: { name: string; group?: boolean; large?: boolean }) {
  return <span className={`mw-avatar${large ? ' mw-avatar--large' : ''}${group ? ' mw-avatar--group' : ''}`} aria-hidden="true">{group ? <MessageIcon name="people" /> : messageInitials(name)}</span>;
}
export function MessageNotice({ children, error = false, onRetry }: { children: ReactNode; error?: boolean; onRetry?: () => void }) {
  return <div className={`mw-notice${error ? ' mw-notice--error' : ''}`} role={error ? 'alert' : 'status'}><span>{children}</span>{onRetry && <MessageButton onClick={onRetry} icon="refresh">Erneut versuchen</MessageButton>}</div>;
}
export function MessageEmpty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="mw-empty"><span className="mw-empty-art" aria-hidden="true"><i /><b><MessageIcon name="chat" /></b><i /></span><h2>{title}</h2><p>{children}</p>{action}</div>;
}
export function MessageDialog({ title, children, onClose, busy = false, wide = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(<><style>{messageWorkspaceCss}</style><dialog ref={ref} className={`mw-dialog${wide ? ' mw-dialog--wide' : ''}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><header className="mw-dialog-header"><div><small>CARESUITE HEALTHOS · NACHRICHTEN</small><h2 id={titleId}>{title}</h2></div><MessageButton aria-label={`${title} schließen`} title="Schließen" disabled={busy} onClick={onClose} icon="close" /></header>{children}</dialog></>, document.body);
}
