import type { ReactNode } from 'react';
import { CatalogIcon } from '@/components/catalog/CatalogWorkspace.web';
import { QM_DOCUMENT_STATUS_LABELS } from '@/lib/qm/qmDocumentWorkspace.web';

export function QmDocumentState({ title, message, error = false, children }: { title: string; message: string; error?: boolean; children?: ReactNode }) {
  return <div className={error ? 'qm-notice' : 'qm-empty'} data-tone={error ? 'error' : undefined} role={error ? 'alert' : 'status'}><div><strong>{title}</strong><p>{message}</p></div>{children ? <div className="qm-actions">{children}</div> : null}</div>;
}
export function QmDocumentRefresh({ busy, refresh }: { busy: boolean; refresh: () => Promise<unknown> }) {
  return <button type="button" className="qm-button" disabled={busy} onClick={() => void refresh()}><CatalogIcon kind="refresh"/>{busy ? 'Wird aktualisiert …' : 'Aktualisieren'}</button>;
}
export function QmDocumentBadge({ status }: { status: string }) {
  return <span className="qmd-status" data-status={status}>{QM_DOCUMENT_STATUS_LABELS[status] ?? 'Status ungeklärt'}</span>;
}
