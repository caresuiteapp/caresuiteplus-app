// Generated native presentation from src/screens/office/OfficeDocumentUploadScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeStyle,NativeDiv,NativeSection,NativeButton,NativeForm,NativeStrong,NativeP,NativeInput,NativeLabel,NativeSpan,NativeSelect,NativeOption,NativeH2,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { nativeBlobDataUrl } from '@/lib/platform/nativeInvoiceLogo.native';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { DocumentsWorkspaceShell, DocumentWorkspaceIcon } from "../../components/documents/DocumentsWorkspaceShell.native.tsx";
import { officeDocumentWorkspaceCss, documentSize } from "../../components/office/officeDocumentWorkspace.native.ts";
import { loadOfficeUploadClients, uploadOfficeDocument, OFFICE_UPLOAD_MAX_BYTES } from "../../lib/office/officeDocumentsService.ts";
import { CLIENT_DOCUMENT_CATEGORY_LABELS } from '@/types/modules/client/clientDocuments';
export function OfficeDocumentUploadScreen() {
    const router = useRouter();
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const { can } = usePermissions();
    const [clients, setClients] = useState<{
        id: string;
        name: string;
    }[]>([]);
    const [clientsLoading, setClientsLoading] = useState(true);
    const [clientsError, setClientsError] = useState<string | null>(null);
    const [reload, setReload] = useState(0);
    const [clientId, setClientId] = useState('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const requestId = useRef<string | null>(null);
    const active = useRef(true);
    const uploadLock = useRef<symbol | null>(null);
    const canUpload = can('office.documents.view') && can('office.clients.edit');
    const scopeKey = `${tenantId ?? ''}:${profile?.id ?? ''}`;
    const currentScope = useRef({ key: scopeKey, generation: 0 });
    if (currentScope.current.key !== scopeKey)
        currentScope.current = { key: scopeKey, generation: currentScope.current.generation + 1 };
    useEffect(() => { setFile(null); setTitle(''); setCategory(''); setDone(null); setError(null); setWorking(false); requestId.current = null; uploadLock.current = null; }, [scopeKey]);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    useEffect(() => { let current = true; setClients([]); setClientsError(null); setClientId(''); setClientsLoading(true); if (!tenantId || !canUpload) {
        setClientsLoading(false);
        return;
    } void loadOfficeUploadClients(tenantId, profile?.roleKey, profile).then(result => { if (!current)
        return; if (result.ok)
        setClients(result.data);
    else
        setClientsError(result.error); setClientsLoading(false); }).catch(() => { if (current) {
        setClientsError('Die Klientenakten konnten nicht geladen werden.');
        setClientsLoading(false);
    } }); return () => { current = false; }; }, [tenantId, profile, canUpload, reload]);
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!tenantId || !file || !canUpload || working || uploadLock.current !== null)
            return;
        const operationScope = currentScope.current.generation;
        const operationToken = Symbol('upload');
        uploadLock.current = operationToken;
        setWorking(true);
        setError(null);
        try {
            const base64 = (await nativeBlobDataUrl(file)).split(',')[1];
            if (!active.current || currentScope.current.generation !== operationScope)
                return;
            requestId.current ??= crypto.randomUUID();
            const result = await uploadOfficeDocument(tenantId, { clientId, title, category, filename: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size, contentBase64: base64, requestId: requestId.current }, profile?.roleKey, profile);
            if (!active.current || currentScope.current.generation !== operationScope)
                return;
            if (result.ok)
                setDone(result.data.id);
            else
                setError(result.error);
        }
        catch {
            if (active.current && currentScope.current.generation === operationScope)
                setError('Die Datei konnte nicht verarbeitet werden. Bitte erneut auswählen.');
        }
        finally {
            if (uploadLock.current === operationToken)
                uploadLock.current = null;
            if (active.current && currentScope.current.generation === operationScope)
                setWorking(false);
        }
    }
    const navigate = (href: string) => { if (!working && uploadLock.current === null)
        router.push(href as never); };
    const back = () => navigate('/business/office/documents');
    return <NativeWorkspaceStyleScope css={[officeDocumentWorkspaceCss, officeDocumentWorkspaceCss]}>{<DocumentsWorkspaceShell active="library" title="In Klientenakte hochladen" description="Eine vorhandene Datei mit Titel und Kategorie der richtigen Akte zuordnen." back={{ label: 'Zur Ablage', onClick: back }} beforeNavigate={() => !working && uploadLock.current === null}>
    <NativeStyle>{officeDocumentWorkspaceCss}</NativeStyle>
    {!canUpload ? <NativeDiv className="dw-empty">Zum Hochladen benötigen Sie die Berechtigung zum Bearbeiten von Klientenakten.</NativeDiv> : done ? <NativeSection className="dw-panel"><NativeDiv className="dw-alert" data-tone="success" role="status">Das Dokument wurde gespeichert und der gewählten Klientenakte zugeordnet.</NativeDiv><NativeDiv className="dw-library-actions"><NativeButton type="button" className="dw-button dw-button--primary" onClick={() => router.push(`/business/office/documents/${done}` as never)}>Dokument öffnen</NativeButton><NativeButton type="button" className="dw-button" onClick={() => { setDone(null); setFile(null); setTitle(''); setCategory(''); requestId.current = null; }}>Weitere Datei hochladen</NativeButton><NativeButton type="button" className="dw-button dw-button--quiet" onClick={back}>Zur Ablage</NativeButton></NativeDiv></NativeSection> : <NativeSection className="dw-panel">
      <NativeForm className="dw-doc-form" onSubmit={event => void submit(event)} aria-busy={working}>
        <NativeDiv className="dw-doc-drop dw-span"><DocumentWorkspaceIcon name="upload" size={36}/><NativeDiv><NativeStrong>{file ? file.name : 'Datei auswählen'}</NativeStrong><NativeP className="dw-muted">{file ? documentSize(file.size) : 'Einzelne Datei bis 20 MB. PDF und Bilder können direkt angezeigt werden.'}</NativeP><NativeInput key={scopeKey} type="file" aria-label="Datei zum Hochladen auswählen" disabled={working} onChange={event => { const next = event.target.files?.[0] ?? null; setError(null); requestId.current = null; if (next && (!next.size || next.size > OFFICE_UPLOAD_MAX_BYTES)) {
            setError('Bitte eine nicht leere Datei mit höchstens 20 MB auswählen.');
            setFile(null);
            event.target.value = '';
            return;
        } setFile(next); if (next)
            setTitle(next.name.replace(/\.[^.]+$/, '')); }}/></NativeDiv></NativeDiv>
        <NativeLabel className="dw-field dw-span"><NativeSpan className="dw-label">Dokumenttitel</NativeSpan><NativeInput className="dw-input" value={title} onChange={event => { setTitle(event.target.value); requestId.current = null; }} maxLength={180} required disabled={working} placeholder="Zum Beispiel: Ärztliche Verordnung Oktober"/></NativeLabel>
        <NativeLabel className="dw-field"><NativeSpan className="dw-label">Klientenakte</NativeSpan><NativeSelect className="dw-select" value={clientId} onChange={event => { setClientId(event.target.value); requestId.current = null; }} required disabled={working || clientsLoading}><NativeOption value="">{clientsLoading ? 'Akten werden geladen…' : 'Person auswählen'}</NativeOption>{clients.map(client => <NativeOption key={client.id} value={client.id}>{client.name}</NativeOption>)}</NativeSelect></NativeLabel>
        <NativeLabel className="dw-field"><NativeSpan className="dw-label">Kategorie</NativeSpan><NativeSelect className="dw-select" value={category} onChange={event => { setCategory(event.target.value); requestId.current = null; }} required disabled={working}><NativeOption value="">Kategorie auswählen</NativeOption>{Object.entries(CLIENT_DOCUMENT_CATEGORY_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel>
        {clientsError ? <NativeDiv className="dw-alert dw-span" data-tone="danger" role="alert">{clientsError}<NativeButton type="button" className="dw-button" onClick={() => setReload(value => value + 1)}>Erneut laden</NativeButton></NativeDiv> : !clientsLoading && clients.length === 0 ? <NativeP className="dw-muted dw-span">Es sind keine zugänglichen Klientenakten vorhanden. Legen Sie zuerst die zugehörige Akte an.</NativeP> : null}
        <NativeP className="dw-muted dw-span">Die Datei wird zunächst intern gespeichert. Eine Freigabe für das Klientenportal erfolgt über die Klientenakte.</NativeP>
        {error ? <NativeDiv className="dw-alert dw-span" data-tone="danger" role="alert">{error}</NativeDiv> : null}
        <NativeDiv className="dw-library-actions dw-span"><NativeButton type="submit" className="dw-button dw-button--primary" disabled={working || !file || !clientId || !category || !title.trim() || !tenantId}>{working ? 'Dokument wird gespeichert…' : 'In Akte speichern'}</NativeButton><NativeButton type="button" className="dw-button" onClick={back} disabled={working}>Abbrechen</NativeButton></NativeDiv>
      </NativeForm>
    </NativeSection>}
    <NativeSection className="dw-panel"><NativeH2>Andere Unterlagen</NativeH2><NativeP className="dw-muted">Unternehmensdokumente erstellen und speichern Sie im zentralen Katalog. Vorhandene Mitarbeiterdateien gehören in die jeweilige Personalakte.</NativeP><NativeDiv className="dw-library-actions"><NativeButton type="button" className="dw-button" disabled={working} onClick={() => navigate('/business/office/document-catalog?tab=records')}>Katalogdokumente</NativeButton>{can('office.employees.view') ? <NativeButton type="button" className="dw-button" disabled={working} onClick={() => navigate('/business/office/employees')}>Personalakten</NativeButton> : null}</NativeDiv></NativeSection>
  </DocumentsWorkspaceShell>}</NativeWorkspaceStyleScope>;
}
