// Generated native presentation from src/components/office/documentation/DocumentationReader.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeStyle,NativeDialog,NativeHeader,NativeDiv,NativeP,NativeH2,NativeButton,NativeSpan,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useId, useRef, useState } from 'react';
import type { DocumentationActor, DocumentationEntry } from '@/lib/office/documentation/model';
import { DOCUMENTATION_CATEGORIES, documentationDateTime } from '@/lib/office/documentation/model';
import { DocumentationFiles } from "./DocumentationFiles.native.tsx";
import { documentationCss } from "./documentationCss.native.ts";
import { useUnsavedWebChanges } from "../../../hooks/useUnsavedWebChanges.native.ts";
export function DocumentationReader({ actor, entry, onClose, onAdd }: {
    actor: DocumentationActor;
    entry: DocumentationEntry;
    onClose: () => void;
    onAdd: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null), id = useId();
    const [size, setSize] = useState(17);
    const [fileState, setFileState] = useState({ dirty: false, busy: false });
    const confirmLeave = useUnsavedWebChanges(fileState.dirty, fileState.busy);
    const close = async () => {
        if (!fileState.busy && await confirmLeave())
            onClose();
    };
    const add = async () => {
        if (!fileState.busy && await confirmLeave())
            onAdd();
    };
    useEffect(() => {
        const d = ref.current;
        if (!d)
            return;
        d.showModal();
        return () => {
            if (d.open)
                d.close();
        };
    }, []);
    if (typeof document === 'undefined')
        return null;
    const category = DOCUMENTATION_CATEGORIES.find(c => c.value === entry.category)!;
    return <NativeWorkspaceStyleScope css={[documentationCss, documentationCss]}>{<><NativeStyle>{documentationCss}</NativeStyle><NativeDialog ref={ref} className="cs-doc cs-doc-reader" aria-labelledby={id} onCancel={e => { e.preventDefault(); void close(); }}><NativeHeader className="cs-doc-reader-head"><NativeDiv><NativeP className="cs-doc-eyebrow">Dokumentation · Leseansicht</NativeP><NativeH2 id={id}>{entry.title}</NativeH2></NativeDiv><NativeButton type="button" autoFocus className="cs-doc-btn icon" aria-label="Leseansicht schließen" disabled={fileState.busy} onClick={() => void close()}>×</NativeButton></NativeHeader>
    <NativeDiv className="cs-doc-reader-scroll" tabIndex={0} aria-label="Vollständige Dokumentation"><NativeDiv className="cs-doc-reading-width"><NativeDiv className="cs-doc-reader-meta"><NativeSpan className={`cs-doc-badge cs-doc-category-${category.value}`}>{category.label}</NativeSpan><NativeSpan>{documentationDateTime(entry.occurred_at)}</NativeSpan><NativeSpan>{entry.author_name}</NativeSpan></NativeDiv>
    <NativeP className="cs-doc-reader-person">{entry.client_name || entry.employee_name || 'Verwaltung'}</NativeP><NativeDiv className="cs-doc-copy" style={{ fontSize: size }}>{entry.body}</NativeDiv>
    <DocumentationFiles key={`${entry.source}:${entry.id}`} actor={actor} entry={entry} onState={setFileState}/><NativeP className="cs-doc-hint">Erfasst am {documentationDateTime(entry.created_at)} · {entry.source === 'visit' ? 'Original aus abgeschlossenem Einsatz' : 'Freier Eintrag'}</NativeP></NativeDiv></NativeDiv>
    <NativeFooter className="cs-doc-reader-footer"><NativeDiv className="cs-doc-actions" aria-label="Schriftgröße"><NativeButton type="button" className="cs-doc-btn" aria-label="Schrift verkleinern" disabled={size <= 15} onClick={() => setSize(s => s - 1)}>A−</NativeButton><NativeSpan>{size} px</NativeSpan><NativeButton type="button" className="cs-doc-btn" aria-label="Schrift vergrößern" disabled={size >= 25} onClick={() => setSize(s => s + 1)}>A＋</NativeButton></NativeDiv><NativeDiv className="cs-doc-actions"><NativeButton type="button" className="cs-doc-btn" disabled={fileState.busy} onClick={() => void close()}>Schließen</NativeButton><NativeButton type="button" className="cs-doc-btn primary" disabled={fileState.busy} onClick={() => void add()}>Ergänzung erfassen</NativeButton></NativeDiv></NativeFooter>
  </NativeDialog></>}</NativeWorkspaceStyleScope>;
}
