// Generated native presentation from src/components/office/PortalUploadsOfficePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeURL as URL,nativeBlob as Blob} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDetails,NativeSummary,NativeSpan,NativeStyle,NativeP,NativeDiv,NativeButton,NativeArticle,NativeStrong,NativeSmall,NativeIframe,NativeImg,NativeLabel,NativeTextarea,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { loadOfficePortalUploads, openOfficePortalUpload, reviewOfficePortalUpload, type OfficePortalUpload } from "../../lib/office/officePortalUploadReview.ts";
import { documentsWorkspaceCss } from "../documents/documentsWorkspaceCss.native.ts";
import { DocumentWorkspaceIcon } from "../documents/DocumentsWorkspaceShell.native.tsx";
import { officeDocumentWorkspaceCss, documentDate, documentSize, saveDocumentBlob } from "./officeDocumentWorkspace.native.ts";
type Props = {
    tenantId: string;
    clientId?: string;
    onReviewed?: () => void;
};
export function PortalUploadsOfficePanel({ tenantId, clientId, onReviewed }: Props) {
    const { profile } = useAuth();
    const { can } = usePermissions();
    const scope = useMemo(() => ({ tenantId, role: profile?.roleKey, profile }), [tenantId, profile]);
    const [uploads, setUploads] = useState<OfficePortalUpload[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [working, setWorking] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [mode, setMode] = useState<'approve' | 'reject'>('approve');
    const [preview, setPreview] = useState<{
        id: string;
        url: string;
        blob: Blob;
        mime: string;
        filename: string;
    } | null>(null);
    const generation = useRef(0);
    const mounted = useRef(true);
    const previewRef = useRef<string | null>(null);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (previewRef.current)
        URL.revokeObjectURL(previewRef.current); }; }, []);
    const refresh = useCallback(async () => { const run = ++generation.current; setLoading(true); setError(null); try {
        const result = await loadOfficePortalUploads(scope, clientId);
        if (!mounted.current || run !== generation.current)
            return;
        if (result.ok)
            setUploads(result.data);
        else
            setError(result.error);
    }
    catch {
        if (mounted.current)
            setError('Der Eingang konnte nicht geladen werden.');
    }
    finally {
        if (mounted.current && run === generation.current)
            setLoading(false);
    } }, [scope, clientId]);
    useEffect(() => { setUploads([]); setSelected(null); setPreview(null); setWorking(null); if (previewRef.current)
        URL.revokeObjectURL(previewRef.current); previewRef.current = null; void refresh(); return () => { generation.current += 1; }; }, [refresh]);
    async function show(upload: OfficePortalUpload) {
        const run = generation.current;
        setSelected(upload.id);
        setMode('approve');
        setNote('');
        setWorking(upload.id);
        setError(null);
        try {
            const result = await openOfficePortalUpload(scope, upload.id);
            if (!mounted.current || run !== generation.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            if (previewRef.current)
                URL.revokeObjectURL(previewRef.current);
            const url = URL.createObjectURL(new Blob([result.data.blob], { type: result.data.mimeType }));
            previewRef.current = url;
            setPreview({ id: upload.id, url, blob: result.data.blob, mime: result.data.mimeType, filename: result.data.filename });
        }
        finally {
            if (mounted.current && run === generation.current)
                setWorking(null);
        }
    }
    async function review(upload: OfficePortalUpload) {
        const run = generation.current;
        setWorking(upload.id);
        setError(null);
        setNotice(null);
        try {
            const result = await reviewOfficePortalUpload(scope, upload.id, mode, note);
            if (!mounted.current || run !== generation.current)
                return;
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setWorking(null);
            setSelected(null);
            setNotice(mode === 'approve' ? 'Dokument in die zugehörige Akte übernommen.' : 'Eingang mit Begründung abgelehnt.');
            setPreview(null);
            if (previewRef.current)
                URL.revokeObjectURL(previewRef.current);
            previewRef.current = null;
            await refresh();
            onReviewed?.();
        }
        finally {
            if (mounted.current && run === generation.current)
                setWorking(null);
        }
    }
    return <NativeWorkspaceStyleScope css={[documentsWorkspaceCss, officeDocumentWorkspaceCss, documentsWorkspaceCss, officeDocumentWorkspaceCss]}>{<NativeDetails className="dw-panel dw-portal-inbox" open={selected !== null ? true : undefined}>
    <NativeSummary className="dw-inbox-summary"><NativeSpan>Portal-Eingang <NativeSpan className="dw-status" data-tone={uploads.length ? 'warning' : 'neutral'}>{loading ? 'Lädt…' : `${uploads.length} offen`}</NativeSpan></NativeSpan><NativeSpan className="dw-muted">Prüfen und zuordnen <DocumentWorkspaceIcon name="arrow" size={16}/></NativeSpan></NativeSummary>
    <NativeStyle>{documentsWorkspaceCss}{officeDocumentWorkspaceCss}</NativeStyle>
    <NativeP className="dw-muted">Dateien aus dem Mitarbeiter- und Klientenportal. Die Übernahme erfolgt in die bereits zugeordnete Akte.</NativeP>
    {error ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{error} <NativeButton className="dw-button dw-button--quiet" onClick={() => void refresh()} disabled={loading || working !== null}>Erneut laden</NativeButton></NativeDiv> : null}
    {notice ? <NativeDiv className="dw-alert" data-tone="success" role="status">{notice}</NativeDiv> : null}
    {!loading && !error && uploads.length === 0 ? <NativeP className="dw-muted">Alle Eingänge sind bearbeitet.</NativeP> : null}
    {uploads.map(upload => {
            const employee = upload.uploadContext === 'mitarbeiter' || Boolean(upload.employeeId && !upload.clientId);
            const canReview = can(employee ? 'office.employees.edit' : 'office.clients.edit');
            const active = selected === upload.id;
            const file = preview?.id === upload.id ? preview : null;
            return <NativeWorkspaceStyleScope css={[documentsWorkspaceCss, officeDocumentWorkspaceCss]}>{<NativeArticle className="dw-inbox-item" key={upload.id}>
      <NativeDiv className="dw-library-title"><DocumentWorkspaceIcon name="document" size={25}/><NativeDiv><NativeStrong>{upload.fileName}</NativeStrong><NativeP>{employee ? 'Personalakte' : 'Klientenakte'} · {employee ? upload.employeeName || 'Zuordnung vorhanden' : upload.clientName || 'Zuordnung vorhanden'}</NativeP><NativeSmall>{documentDate(upload.createdAt)} · {documentSize(upload.sizeBytes)}</NativeSmall>{upload.message ? <NativeP>{upload.message}</NativeP> : null}</NativeDiv></NativeDiv>
      <NativeDiv className="dw-library-actions"><NativeButton type="button" className="dw-button" disabled={working !== null} onClick={() => void show(upload)}><DocumentWorkspaceIcon name="eye" size={16}/>{working === upload.id ? 'Datei wird geladen…' : 'Datei prüfen'}</NativeButton></NativeDiv>
      {active ? <NativeDiv className="dw-inbox-review">
        <NativeDiv className="dw-library-heading"><NativeStrong>{file ? 'Datei und Zuordnung prüfen' : 'Vorschau wird vorbereitet'}</NativeStrong><NativeButton type="button" className="dw-button dw-button--quiet" onClick={() => setSelected(null)} disabled={working !== null}>Schließen</NativeButton></NativeDiv>
        {file ? <><NativeDiv className="dw-library-actions"><NativeButton type="button" className="dw-button" onClick={async () => await saveDocumentBlob(file.blob, file.filename)}><DocumentWorkspaceIcon name="download" size={16}/>Herunterladen</NativeButton>{canReview ? <><NativeButton type="button" className="dw-button" onClick={() => setMode('approve')} aria-pressed={mode === 'approve'}>Übernehmen</NativeButton><NativeButton type="button" className="dw-button dw-button--quiet" onClick={() => setMode('reject')} aria-pressed={mode === 'reject'}>Ablehnen</NativeButton></> : null}</NativeDiv><NativeDiv className="dw-inbox-preview">{file.mime === 'application/pdf' ? <NativeIframe className="dw-doc-preview" title={`Vorschau ${upload.fileName}`} src={file.url}/> : ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mime) ? <NativeImg className="dw-doc-image" src={file.url} alt={upload.fileName}/> : <NativeP className="dw-muted">Für diesen Dateityp ist keine eingebettete Vorschau verfügbar. Laden Sie die Datei zur Prüfung herunter.</NativeP>}</NativeDiv></> : null}
        {canReview && file ? <NativeDiv style={{ marginTop: 16 }}>{mode === 'reject' ? <NativeLabel className="dw-field"><NativeSpan className="dw-label">Grund für die Ablehnung</NativeSpan><NativeTextarea className="dw-input" rows={3} value={note} onChange={event => setNote(event.target.value)} maxLength={1000} placeholder="Was muss korrigiert oder ergänzt werden?"/></NativeLabel> : <NativeP className="dw-muted">Die Datei wird der {employee ? 'Personalakte' : 'Klientenakte'} von {employee ? upload.employeeName || 'der zugeordneten Person' : upload.clientName || 'der zugeordneten Person'} zugeordnet.</NativeP>}<NativeButton type="button" className={`dw-button ${mode === 'reject' ? 'dw-button--danger' : 'dw-button--primary'}`} disabled={working !== null || (mode === 'reject' && !note.trim())} onClick={() => void review(upload)}>{working === upload.id ? 'Wird gespeichert…' : mode === 'reject' ? 'Mit Begründung ablehnen' : 'Übernahme bestätigen'}</NativeButton></NativeDiv> : !canReview ? <NativeP className="dw-muted">Ihre Rolle kann den Eingang ansehen. Die Übernahme und Ablehnung ist der Verwaltung vorbehalten.</NativeP> : null}
      </NativeDiv> : null}
    </NativeArticle>}</NativeWorkspaceStyleScope>;
        })}
  </NativeDetails>}</NativeWorkspaceStyleScope>;
}
