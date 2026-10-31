// Generated native presentation from src/screens/office/OfficeDocumentDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeURL as URL,nativeBlob as Blob} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeButton,NativeStyle,NativeDiv,NativeSection,NativeDl,NativeDt,NativeDd,NativeSpan,NativeH2,NativeP,NativeIframe,NativeImg,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { DocumentsWorkspaceShell, DocumentWorkspaceIcon } from "../../components/documents/DocumentsWorkspaceShell.native.tsx";
import { officeDocumentWorkspaceCss, documentDate, documentSize, saveDocumentBlob } from "../../components/office/officeDocumentWorkspace.native.ts";
import { fetchOfficeDocumentDetail, fetchOfficeDocumentBlob, type OfficeDocumentFile } from "../../lib/office/officeDocumentsService.ts";
import { PORTAL_DOCUMENT_CATEGORY_LABELS } from '@/types/portal/documents';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
export function OfficeDocumentDetailScreen() {
    const params = useLocalSearchParams<{
        id: string | string[];
    }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const router = useRouter();
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const { can } = usePermissions();
    const [doc, setDoc] = useState<OfficeDocumentFile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [file, setFile] = useState<{
        url: string;
        blob: Blob;
        filename: string;
    } | null>(null);
    const [fileLoading, setFileLoading] = useState(false);
    const [reload, setReload] = useState(0);
    const generation = useRef(0);
    const canView = can('office.documents.view');
    useEffect(() => { let url: string | null = null; let live = true; const run = ++generation.current; setDoc(null); setFile(null); setError(null); setFileError(null); setLoading(true); setFileLoading(false); if (!id || !tenantId || !canView) {
        setLoading(false);
        setError(!id ? 'Die Dokumentadresse ist unvollständig.' : !canView ? 'Ihre Rolle hat keine Berechtigung für dieses Dokument.' : 'Es ist kein Unternehmen ausgewählt.');
        return;
    } void (async () => { try {
        const result = await fetchOfficeDocumentDetail(tenantId, id, profile?.roleKey, profile);
        if (!live || run !== generation.current)
            return;
        if (!result.ok) {
            setError(result.error);
            return;
        }
        setDoc(result.data);
        setLoading(false);
        if (result.data.storagePath && !/\.pending$/i.test(result.data.fileName) && result.data.status !== 'gesperrt') {
            setFileLoading(true);
            const opened = await fetchOfficeDocumentBlob(tenantId, id, profile?.roleKey, profile);
            if (!live || run !== generation.current)
                return;
            if (opened.ok) {
                url = URL.createObjectURL(new Blob([opened.data.blob], { type: result.data.mimeType }));
                setFile({ ...opened.data, url });
            }
            else
                setFileError(opened.error);
        }
    }
    catch {
        if (live)
            setError('Das Dokument konnte nicht geladen werden.');
    }
    finally {
        if (live) {
            setLoading(false);
            setFileLoading(false);
        }
    } })(); return () => { live = false; generation.current += 1; if (url)
        URL.revokeObjectURL(url); }; }, [id, tenantId, profile, canView, reload]);
    const pending = Boolean(doc?.signaturePending && doc.status !== 'gesperrt');
    const download = async () => { if (file)
        await saveDocumentBlob(file.blob, file.filename);
    else if (doc?.previewHtml)
        await saveDocumentBlob(new Blob([doc.previewHtml], { type: 'text/html;charset=utf-8' }), `${doc.title.replace(/[^\p{L}\p{N}._-]+/gu, '-')}.html`); };
    return <NativeWorkspaceStyleScope css={[officeDocumentWorkspaceCss, officeDocumentWorkspaceCss]}>{<DocumentsWorkspaceShell active="library" title={doc?.title || 'Dokument'} description={doc?.clientName ? `Klientenakte · ${doc.clientName}` : 'Datei, Zuordnung und Bearbeitungsstand'} back={{ label: 'Zur Ablage', onClick: () => router.push('/business/office/documents' as never) }} actions={doc ? <>{file || doc.previewHtml ? <NativeButton type="button" className="dw-button dw-button--primary" onClick={download}><DocumentWorkspaceIcon name="download"/>{file ? 'Herunterladen' : 'HTML herunterladen'}</NativeButton> : null}{doc.clientId ? <NativeButton type="button" className="dw-button" onClick={() => router.push(`/business/office/clients/${doc.clientId}/documents` as never)}>Zur Klientenakte<DocumentWorkspaceIcon name="arrow"/></NativeButton> : null}</> : undefined}>
    <NativeStyle>{officeDocumentWorkspaceCss}</NativeStyle>
    {loading ? <NativeDiv className="dw-empty" role="status">Dokument wird geladen…</NativeDiv> : error ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{error}<NativeButton type="button" className="dw-button" onClick={() => setReload(value => value + 1)}>Erneut laden</NativeButton></NativeDiv> : doc ? <>
      <NativeSection className="dw-panel"><NativeDl className="dw-doc-meta"><NativeDiv><NativeDt>Kategorie</NativeDt><NativeDd>{PORTAL_DOCUMENT_CATEGORY_LABELS[doc.category]}</NativeDd></NativeDiv><NativeDiv><NativeDt>Status</NativeDt><NativeDd><NativeSpan className="dw-status" data-tone={pending ? 'warning' : doc.status === 'fehlerhaft' ? 'danger' : 'neutral'}>{pending ? 'Unterschrift ausstehend' : WORKFLOW_STATUS_LABELS[doc.status]}</NativeSpan></NativeDd></NativeDiv><NativeDiv><NativeDt>Aktualisiert</NativeDt><NativeDd>{documentDate(doc.updatedAt)}</NativeDd></NativeDiv><NativeDiv><NativeDt>Freigabe</NativeDt><NativeDd>{doc.visibility === 'shared' ? 'Für das Portal freigegeben' : 'Intern'}</NativeDd></NativeDiv>{doc.displayFileName ? <NativeDiv><NativeDt>Datei</NativeDt><NativeDd>{doc.displayFileName}</NativeDd></NativeDiv> : null}{!pending ? <NativeDiv><NativeDt>Umfang</NativeDt><NativeDd>{doc.previewHtml ? 'HTML-Dokument' : documentSize(doc.fileSizeBytes)}</NativeDd></NativeDiv> : null}</NativeDl></NativeSection>
      {pending ? <NativeSection className="dw-panel"><NativeH2>Unterschrift steht noch aus</NativeH2><NativeP>Dieser Eintrag dokumentiert eine angeforderte Unterschrift. Die fertige Datei wird nach Abschluss des Vorgangs bereitgestellt.</NativeP><NativeP className="dw-muted">Den aktuellen Vorgang und seine Unterschriften finden Sie in der zugehörigen Klientenakte.</NativeP></NativeSection> : null}
      <NativeSection className="dw-panel"><NativeDiv className="dw-library-heading"><NativeH2>Dokumentvorschau</NativeH2>{file ? <NativeButton type="button" className="dw-button" onClick={download}>Datei herunterladen</NativeButton> : null}</NativeDiv>{fileError ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{fileError}<NativeButton type="button" className="dw-button" onClick={() => setReload(value => value + 1)}>Datei erneut laden</NativeButton></NativeDiv> : null}{fileLoading ? <NativeP role="status">Datei wird geladen…</NativeP> : doc.previewHtml ? <NativeIframe className="dw-doc-preview" title={`Vorschau ${doc.title}`} srcDoc={doc.previewHtml} sandbox="" referrerPolicy="no-referrer"/> : file && doc.mimeType === 'application/pdf' ? <NativeIframe className="dw-doc-preview" title={`Vorschau ${doc.title}`} src={file.url}/> : file && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(doc.mimeType) ? <NativeImg className="dw-doc-image" src={file.url} alt={doc.title}/> : file ? <NativeDiv className="dw-empty">Dieser Dateityp kann heruntergeladen und mit einem passenden Programm geöffnet werden.</NativeDiv> : !fileError ? <NativeDiv className="dw-empty">{pending ? 'Noch keine fertige Datei vorhanden.' : doc.status === 'fehlerhaft' ? 'Für diesen Eintrag fehlt der Dokumentinhalt. Prüfen Sie die Unterlage in der Klientenakte.' : 'Für diesen Eintrag ist noch keine Vorschau oder Datei hinterlegt.'}</NativeDiv> : null}</NativeSection>
    </> : null}
  </DocumentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
}
