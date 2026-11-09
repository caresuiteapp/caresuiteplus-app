import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DocumentationActor, DocumentationEntry } from '@/lib/office/documentation/model';
import { DOCUMENTATION_CATEGORIES, documentationDateTime } from '@/lib/office/documentation/model';
import { DocumentationFiles } from './DocumentationFiles.web';
import { documentationCss } from './documentationCss.web';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';

export function DocumentationReader({ actor, entry, onClose, onAdd, onAttachmentTypesLoaded }: {
  actor: DocumentationActor; entry: DocumentationEntry; onClose: () => void; onAdd: () => void;
  onAttachmentTypesLoaded?: (mimeTypes: string[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  const [size, setSize] = useState(17);
  const [fileState, setFileState] = useState({ dirty: false, busy: false });
  const confirmLeave = useUnsavedWebChanges(fileState.dirty, fileState.busy);
  const close = async () => { if (!fileState.busy && await confirmLeave()) onClose(); };
  const add = async () => { if (!fileState.busy && await confirmLeave()) onAdd(); };
  useEffect(() => { const d = ref.current; if (!d) return; d.showModal(); return () => { if (d.open) d.close(); }; }, []);
  if (typeof document === 'undefined') return null;
  const category = DOCUMENTATION_CATEGORIES.find(c => c.value === entry.category)!;
  return createPortal(<><style>{documentationCss}</style><dialog ref={ref} className="cs-doc cs-doc-reader" aria-labelledby={id} onCancel={e => { e.preventDefault(); void close(); }}><header className="cs-doc-reader-head"><div><p className="cs-doc-eyebrow">Dokumentation · Leseansicht</p><h2 id={id}>{entry.title}</h2></div><button type="button" autoFocus className="cs-doc-btn icon" aria-label="Leseansicht schließen" disabled={fileState.busy} onClick={() => void close()}>×</button></header>
    <div className="cs-doc-reader-scroll" tabIndex={0} aria-label="Vollständige Dokumentation"><div className="cs-doc-reading-width"><div className="cs-doc-reader-meta"><span className={`cs-doc-badge cs-doc-category-${category.value}`}>{category.label}</span><span>{documentationDateTime(entry.occurred_at)}</span><span>{entry.author_name}</span></div>
    <p className="cs-doc-reader-person">{entry.client_name || entry.employee_name || 'Verwaltung'}</p><div className="cs-doc-copy" style={{ fontSize: size }}>{entry.body}</div>
    <DocumentationFiles key={`${entry.source}:${entry.id}`} actor={actor} entry={entry} onState={setFileState} onAttachmentTypesLoaded={onAttachmentTypesLoaded} /><p className="cs-doc-hint">Erfasst am {documentationDateTime(entry.created_at)} · {entry.source === 'visit' ? 'Original aus abgeschlossenem Einsatz' : 'Freier Eintrag'}</p></div></div>
    <footer className="cs-doc-reader-footer"><div className="cs-doc-actions" aria-label="Schriftgröße"><button type="button" className="cs-doc-btn" aria-label="Schrift verkleinern" disabled={size <= 15} onClick={() => setSize(s => s - 1)}>A−</button><span>{size} px</span><button type="button" className="cs-doc-btn" aria-label="Schrift vergrößern" disabled={size >= 25} onClick={() => setSize(s => s + 1)}>A＋</button></div><div className="cs-doc-actions"><button type="button" className="cs-doc-btn" disabled={fileState.busy} onClick={() => void close()}>Schließen</button><button type="button" className="cs-doc-btn primary" disabled={fileState.busy} onClick={() => void add()}>Ergänzung erfassen</button></div></footer>
  </dialog></>, document.body);
}
