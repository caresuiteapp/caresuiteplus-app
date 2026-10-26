// Generated native presentation from src/components/office/ClientRecordDocumentsPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeFetch as fetch} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeSvgPath,NativeSvgCircle} from '@/components/layout/NativeSvgPresentation.native';
import {NativeLi,NativeButton,NativeSpan,NativeSmall,NativeStrong,NativeDiv,NativeStyle,NativeSection,NativeHeader,NativeH3,NativeP,NativeForm,NativeH4,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeUl,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { nativeWorkspaceNodes } from '@/lib/platform/nativeWorkspaceNodes.shared';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { DocumentRecommendations } from "../documents/DocumentRecommendations.native.tsx";
import { ClientDocumentPreview } from '@/components/office/ClientDocumentPreview';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { CLIENT_DOCUMENT_ALL_CATEGORY_KEY, buildClientDocumentCategoryOverview, filterClientDocumentsByCategory, getClientDocumentCategoryLabel, resolveClientDocumentCategoryKey, } from '@/lib/clients/clientDocumentCategories';
import { listClientDocuments, uploadClientDocument } from '@/lib/clients/clientDocumentsService';
import { isIntakeDocumentContentMissing } from '@/lib/documents/documentPdfLogic';
import { resolveOfficeDocumentDisplayFileName, resolveOfficeDocumentTitle } from '@/lib/office/officeDocumentDisplay';
import { getServiceMode } from '@/lib/services/mode';
import { CLIENT_DOCUMENT_STATUS_LABELS, type ClientDocumentRecord } from '@/types/modules/client';
import { clientDocumentsCss } from "./clientDocumentsCss.native.ts";
type Props = {
    clientId: string;
    clientLastName?: string | null;
    initialDocuments?: ClientDocumentRecord[];
    onRecordRefresh?: () => void;
};
type PickedFile = {
    name: string;
    mimeType: string;
    sizeBytes: number;
    contentBase64: string;
};
type WorkspaceProps = Props & {
    tenantId: string | null;
    actorId?: string;
    actorName: string | null;
    roleKey?: string | null;
    isReadOnly: boolean;
};
function Icon({ name }: {
    name: 'file' | 'upload' | 'search' | 'arrow' | 'refresh' | 'close';
}) {
    return <NativeWorkspaceStyleScope css={[clientDocumentsCss]}>{<WebActionIcon>{name === 'file' ? <><NativeSvgPath d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h5"/></> : name === 'upload' ? <><NativeSvgPath d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></> : name === 'search' ? <><NativeSvgCircle cx="10.5" cy="10.5" r="6.5"/><NativeSvgPath d="m16 16 5 5"/></> : name === 'refresh' ? <><NativeSvgPath d="M20 7a9 9 0 1 0 1 8M20 2v6h-6"/></> : name === 'close' ? <NativeSvgPath d="m6 6 12 12M6 18 18 6"/> : <NativeSvgPath d="m9 5 7 7-7 7"/>}</WebActionIcon>}</NativeWorkspaceStyleScope>;
}
function documentStatus(doc: ClientDocumentRecord) {
    if (isIntakeDocumentContentMissing(doc))
        return { label: 'Inhalt fehlt', tone: 'warning' };
    if (doc.intakeStatus === 'finalized')
        return { label: 'Finalisiert', tone: 'complete' };
    return {
        label: CLIENT_DOCUMENT_STATUS_LABELS[doc.status] ?? 'Status unbekannt',
        tone: doc.status === 'abgeschlossen' ? 'complete' : ['entwurf', 'in_bearbeitung', 'fehlerhaft'].includes(doc.status) ? 'warning' : 'neutral',
    };
}
function documentDate(doc: ClientDocumentRecord) {
    const date = new Date(doc.updatedAt || doc.createdAt);
    return Number.isNaN(date.getTime()) ? 'Datum nicht hinterlegt' : date.toLocaleDateString('de-DE');
}
function documentFormat(doc: ClientDocumentRecord) {
    if (doc.documentSource === 'intake' || doc.mimeType === 'text/html')
        return 'Akte';
    if (doc.mimeType === 'application/pdf')
        return 'PDF';
    if (doc.mimeType.startsWith('image/'))
        return 'Bild';
    if (doc.mimeType.includes('word'))
        return 'Word';
    return 'Datei';
}
function DocumentRow({ doc, onOpen }: {
    doc: ClientDocumentRecord;
    onOpen: () => void;
}) {
    const rowId = useId();
    const title = resolveOfficeDocumentTitle(doc);
    const status = documentStatus(doc);
    const fileName = resolveOfficeDocumentDisplayFileName(doc);
    const duplicateFileName = fileName?.replace(/\.[^.]+$/, '').trim().toLocaleLowerCase('de') === title.trim().toLocaleLowerCase('de');
    return <NativeWorkspaceStyleScope css={[clientDocumentsCss]}>{<NativeLi data-document-id={doc.id}>
    <NativeButton id={'native-client-document-' + JSON.stringify([doc.tenantId, doc.clientId, doc.id])} className="cr-docs-row" type="button" onClick={onOpen} aria-label={`${title} ansehen`} aria-describedby={`${rowId}-meta ${rowId}-status`}>
      <NativeSpan className="cr-docs-file" aria-hidden="true"><Icon name="file"/><NativeSmall>{documentFormat(doc)}</NativeSmall></NativeSpan>
      <NativeSpan className="cr-docs-row-copy"><NativeStrong>{title}</NativeStrong><NativeSpan id={`${rowId}-meta`} className="cr-docs-row-meta">{getClientDocumentCategoryLabel(resolveClientDocumentCategoryKey(doc))}<NativeSpan aria-hidden="true"> · </NativeSpan>{doc.documentSource === 'intake' ? 'Aus der Aufnahme' : doc.documentSource === 'upload' ? 'Hochgeladen' : 'Aktenunterlage'}</NativeSpan>{fileName && !duplicateFileName ? <NativeSmall>{fileName}</NativeSmall> : null}</NativeSpan>
      <NativeSpan id={`${rowId}-status`} className="cr-docs-row-status"><NativeSpan className={`cr-docs-status ${status.tone}`}>{status.label}</NativeSpan><NativeSmall>{documentDate(doc)}</NativeSmall></NativeSpan>
      <NativeSpan className="cr-docs-open">Ansehen <Icon name="arrow"/></NativeSpan>
    </NativeButton>
  </NativeLi>}</NativeWorkspaceStyleScope>;
}
/** Each identity receives a fresh workspace, including files and in-flight feedback. */
export function ClientRecordDocumentsPanel(props: Props) {
    const { profile } = useAuth();
    const { isReadOnly } = usePermissions();
    const tenantId = useServiceTenantId();
    return <NativeWorkspaceStyleScope key={`${tenantId}:${props.clientId}:${profile?.id}:${profile?.roleKey}:${isReadOnly}`} css={[clientDocumentsCss]}>{<DocumentWorkspace key={`${tenantId}:${props.clientId}:${profile?.id}:${profile?.roleKey}:${isReadOnly}`} {...props} tenantId={tenantId} actorId={profile?.id} actorName={profile?.displayName ?? profile?.email ?? null} roleKey={profile?.roleKey} isReadOnly={isReadOnly}/>}</NativeWorkspaceStyleScope>;
}
function DocumentWorkspace({ tenantId, clientId, clientLastName, initialDocuments, onRecordRefresh, actorId, actorName, roleKey, isReadOnly }: WorkspaceProps) {
    const id = useId();
    const [activeCategory, setActiveCategory] = useState(CLIENT_DOCUMENT_ALL_CATEGORY_KEY);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('newest');
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('sonstiges');
    const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
    const [working, setWorking] = useState(false);
    const [picking, setPicking] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const busy = useRef(false);
    const fileBusy = useRef(false);
    const mounted = useRef(true);
    const titleInput = useRef<HTMLInputElement>(null);
    const uploadToggle = useRef<HTMLButtonElement>(null);
    const previewBack = useRef<HTMLButtonElement>(null);
    const focusAfterUpload = useRef(false);
    const rowButtons = useRef<HTMLDivElement>(null);
    const lastOpened = useRef<string | null>(null);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { if (uploadOpen)
        titleInput.current?.focus(); }, [uploadOpen]);
    useEffect(() => { if (selectedDocId)
        previewBack.current?.focus(); }, [selectedDocId]);
    useEffect(() => {
        if (focusAfterUpload.current && !working && !uploadOpen) {
            focusAfterUpload.current = false;
            uploadToggle.current?.focus();
        }
    }, [working, uploadOpen]);
    const query = useAsyncQuery(() => tenantId && clientId ? listClientDocuments(tenantId, clientId) : Promise.resolve({ ok: false as const, error: 'Die Klientenakte ist keinem Unternehmen zugeordnet.' }), [tenantId, clientId], { enabled: !!tenantId && !!clientId, queryKey: `client-documents:${tenantId}:${clientId}:${actorId}:${roleKey}` });
    const documents = useMemo(() => (query.data ?? initialDocuments ?? []).filter(doc => doc.clientId === clientId && doc.tenantId === tenantId), [query.data, initialDocuments, clientId, tenantId]);
    const categories = useMemo(() => buildClientDocumentCategoryOverview(documents), [documents]);
    const usedCategories = categories.filter(item => item.count > 0);
    const visibleDocuments = useMemo(() => {
        const term = search.trim().toLocaleLowerCase('de');
        return filterClientDocumentsByCategory(documents, activeCategory)
            .filter(doc => !term || [resolveOfficeDocumentTitle(doc), resolveOfficeDocumentDisplayFileName(doc), getClientDocumentCategoryLabel(resolveClientDocumentCategoryKey(doc))].filter(Boolean).join(' ').toLocaleLowerCase('de').includes(term))
            .slice().sort((a, b) => sort === 'name' ? resolveOfficeDocumentTitle(a).localeCompare(resolveOfficeDocumentTitle(b), 'de') : (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0));
    }, [documents, activeCategory, search, sort]);
    const selectedDoc = selectedDocId ? documents.find(doc => doc.id === selectedDocId) : null;
    const queryError = query.error ?? query.refreshError;
    function selectCategory(value: string) { setActiveCategory(value); setSelectedDocId(null); }
    function showUpload() {
        if (isReadOnly || working)
            return;
        if (activeCategory !== CLIENT_DOCUMENT_ALL_CATEGORY_KEY)
            setCategory(activeCategory);
        setUploadOpen(true);
        setSelectedDocId(null);
    }
    function closeUpload() {
        if (busy.current || fileBusy.current)
            return;
        setUploadOpen(false);
        uploadToggle.current?.focus();
    }
    function backToList() {
        setSelectedDocId(null);
        requestAnimationFrame(() => nativeWorkspaceNodes.get('native-client-document-' + JSON.stringify([tenantId, clientId, lastOpened.current]))?.focus());
    }
    async function pickFile() {
        if (isReadOnly || busy.current || fileBusy.current)
            return;
        fileBusy.current = true;
        setPicking(true);
        setActionError(null);
        try {
            const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] });
            if (!mounted.current || result.canceled || !result.assets?.[0])
                return;
            const asset = result.assets[0];
            const name = asset.name || 'Dokument';
            let contentBase64 = 'demo';
            let sizeBytes = asset.size ?? 0;
            if (getServiceMode() === 'supabase') {
                const response = await fetch(asset.uri);
                if (!response.ok)
                    throw new Error('Datei konnte nicht gelesen werden.');
                const bytes = new Uint8Array(await response.arrayBuffer());
                let binary = '';
                for (let i = 0; i < bytes.length; i += 0x8000)
                    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
                contentBase64 = btoa(binary);
                sizeBytes = bytes.length;
            }
            if (!mounted.current)
                return;
            setPickedFile({ name, mimeType: asset.mimeType ?? 'application/octet-stream', sizeBytes, contentBase64 });
            setTitle(current => current.trim() ? current : name.replace(/\.[^.]+$/, ''));
        }
        catch {
            if (mounted.current)
                setActionError('Datei konnte nicht gelesen werden. Bitte wählen Sie sie erneut aus.');
        }
        finally {
            fileBusy.current = false;
            if (mounted.current)
                setPicking(false);
        }
    }
    async function upload(event: FormEvent) {
        event.preventDefault();
        if (!tenantId || isReadOnly || busy.current || fileBusy.current || !title.trim() || !pickedFile)
            return;
        busy.current = true;
        setWorking(true);
        setMessage(null);
        setActionError(null);
        try {
            const result = await uploadClientDocument(tenantId, clientId, { title: title.trim(), category, fileName: pickedFile.name, mimeType: pickedFile.mimeType, sizeBytes: pickedFile.sizeBytes, contentBase64: getServiceMode() === 'supabase' ? pickedFile.contentBase64 : undefined, uploadedBy: actorId ?? null });
            if (!mounted.current)
                return;
            if (!result.ok) {
                setActionError(result.error);
                return;
            }
            focusAfterUpload.current = true;
            setPickedFile(null);
            setTitle('');
            setUploadOpen(false);
            setActiveCategory(category);
            setSearch('');
            const refreshed = await query.refreshWithResult();
            if (!mounted.current)
                return;
            if (refreshed)
                setMessage('Dokument wurde in der Akte gespeichert.');
            else
                setActionError('Das Dokument wurde gespeichert. Die Liste konnte noch nicht aktualisiert werden. Bitte aktualisieren Sie die Ansicht; ein erneuter Upload ist nicht nötig.');
            onRecordRefresh?.();
        }
        catch {
            if (mounted.current)
                setActionError('Der Upload konnte nicht vollständig bestätigt werden. Aktualisieren Sie zunächst die Liste, bevor Sie die Datei erneut hochladen.');
        }
        finally {
            busy.current = false;
            if (mounted.current)
                setWorking(false);
        }
    }
    if (!tenantId || !clientId)
        return <NativeWorkspaceStyleScope css={[clientDocumentsCss]}>{<NativeDiv role="alert">Die Dokumente benötigen eine zugeordnete Klientenakte. Öffnen Sie die Akte erneut.</NativeDiv>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[clientDocumentsCss, clientDocumentsCss]}>{<NativeDiv className="cr-docs">
    <NativeStyle>{clientDocumentsCss}</NativeStyle>
    <NativeSection className="cr-docs-surface" aria-label="Dokumente dieser Akte">
      <NativeHeader className="cr-docs-heading"><NativeDiv className="cr-docs-heading-icon"><Icon name="file"/></NativeDiv><NativeDiv className="cr-docs-heading-copy"><NativeSpan className="cr-docs-eyebrow">Unterlagen dieser Akte</NativeSpan><NativeH3>Alles an einem Ort.</NativeH3><NativeP>Verträge, Nachweise und hochgeladene Dateien.</NativeP></NativeDiv><NativeDiv className="cr-docs-actions"><NativeButton type="button" className="cr-docs-button subtle" onClick={() => void query.refresh()} disabled={query.loading || query.refreshing || working} aria-label="Dokumentenliste aktualisieren"><Icon name="refresh"/><NativeSpan>{query.refreshing ? 'Aktualisiert…' : 'Aktualisieren'}</NativeSpan></NativeButton>{!isReadOnly ? <NativeButton ref={uploadToggle} type="button" className="cr-docs-button primary" onClick={showUpload} aria-expanded={uploadOpen} aria-controls={`${id}-upload`} disabled={working}><Icon name="upload"/>Dokument hochladen</NativeButton> : null}</NativeDiv></NativeHeader>

      {queryError ? <NativeDiv className="cr-docs-notice error" role="alert"><NativeSpan>Die Dokumentenliste konnte nicht aktualisiert werden. {queryError}</NativeSpan><NativeButton type="button" className="cr-docs-button" disabled={query.refreshing || working} onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}
      {message ? <NativeDiv className="cr-docs-notice success" role="status">{message}</NativeDiv> : null}
      {actionError ? <NativeDiv className="cr-docs-notice error" role="alert">{actionError}</NativeDiv> : null}

      {uploadOpen && !isReadOnly ? <NativeForm id={`${id}-upload`} className="cr-docs-upload" onSubmit={event => void upload(event)} aria-label="Dokument hochladen">
        <NativeDiv className="cr-docs-upload-heading"><NativeDiv><NativeH4>Neue Unterlage hinzufügen</NativeH4><NativeP>PDF, Bild oder Word-Datei auswählen und in der Akte ablegen.</NativeP></NativeDiv><NativeButton type="button" className="cr-docs-icon-button" onClick={closeUpload} disabled={working || picking} aria-label="Upload schließen"><Icon name="close"/></NativeButton></NativeDiv>
        <NativeDiv className="cr-docs-upload-fields"><NativeLabel><NativeSpan>Dokumenttitel</NativeSpan><NativeInput ref={titleInput} value={title} onChange={event => setTitle(event.target.value)} placeholder="Zum Beispiel: Pflegegradbescheid" required disabled={working}/></NativeLabel><NativeLabel><NativeSpan>Kategorie</NativeSpan><NativeSelect value={category} onChange={event => setCategory(event.target.value)} disabled={working}>{categories.map(item => <NativeOption key={item.key} value={item.key}>{item.label}</NativeOption>)}</NativeSelect></NativeLabel></NativeDiv>
        <NativeDiv className="cr-docs-upload-footer"><NativeButton type="button" className={`cr-docs-pick${pickedFile ? ' has-file' : ''}`} onClick={() => void pickFile()} disabled={working || picking}><Icon name={pickedFile ? 'file' : 'upload'}/><NativeSpan><NativeStrong>{picking ? 'Datei wird gelesen…' : pickedFile?.name ?? 'Datei auswählen'}</NativeStrong><NativeSmall>{pickedFile ? 'Andere Datei auswählen' : 'PDF · Bilder · DOC / DOCX'}</NativeSmall></NativeSpan></NativeButton><NativeButton type="submit" className="cr-docs-button primary" disabled={working || picking || !title.trim() || !pickedFile}>{working ? 'Wird gespeichert…' : 'In Akte speichern'}</NativeButton></NativeDiv>
      </NativeForm> : null}

      {selectedDocId ? <NativeDiv className="cr-docs-preview"><NativeButton ref={previewBack} type="button" className="cr-docs-button" onClick={backToList}>← Zur Dokumentenliste</NativeButton>{selectedDoc ? <><NativeDiv className="cr-docs-preview-title"><NativeSpan>{getClientDocumentCategoryLabel(resolveClientDocumentCategoryKey(selectedDoc))}</NativeSpan><NativeH4>{resolveOfficeDocumentTitle(selectedDoc)}</NativeH4></NativeDiv><ClientDocumentPreview key={`${tenantId}:${clientId}:${selectedDoc.id}`} tenantId={tenantId} clientId={clientId} document={selectedDoc} clientLastName={clientLastName} actorName={actorName} onDeliveryComplete={onRecordRefresh}/></> : <NativeDiv className="cr-docs-empty" role="status"><NativeStrong>Dokument nicht mehr in dieser Liste</NativeStrong><NativeP>Die Unterlagen wurden aktualisiert. Kehren Sie zur Dokumentenliste zurück.</NativeP></NativeDiv>}</NativeDiv> : <>
        <NativeDiv className="cr-docs-filters"><NativeLabel className="cr-docs-search"><NativeSpan>Dokument suchen</NativeSpan><NativeSpan className="cr-docs-search-input"><Icon name="search"/><NativeInput type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Titel, Dateiname oder Kategorie"/></NativeSpan></NativeLabel><NativeLabel><NativeSpan>Kategorie</NativeSpan><NativeSelect value={activeCategory} onChange={event => selectCategory(event.target.value)}><NativeOption value={CLIENT_DOCUMENT_ALL_CATEGORY_KEY}>Alle Kategorien ({documents.length})</NativeOption>{categories.map(item => <NativeOption key={item.key} value={item.key}>{item.label} ({item.count})</NativeOption>)}</NativeSelect></NativeLabel><NativeLabel><NativeSpan>Sortieren</NativeSpan><NativeSelect value={sort} onChange={event => setSort(event.target.value)}><NativeOption value="newest">Zuletzt aktualisiert</NativeOption><NativeOption value="name">Titel A–Z</NativeOption></NativeSelect></NativeLabel></NativeDiv>
        {usedCategories.length ? <NativeDiv className="cr-docs-categories" aria-label="Vorhandene Dokumentkategorien"><NativeButton type="button" aria-pressed={activeCategory === CLIENT_DOCUMENT_ALL_CATEGORY_KEY} onClick={() => selectCategory(CLIENT_DOCUMENT_ALL_CATEGORY_KEY)}><NativeSpan className="cr-docs-category-label">Alle Dokumente </NativeSpan><NativeSpan className="cr-docs-category-count">{documents.length}</NativeSpan></NativeButton>{usedCategories.map(item => <NativeButton type="button" key={item.key} aria-pressed={activeCategory === item.key} onClick={() => selectCategory(item.key)}><NativeSpan className="cr-docs-category-label">{item.label}</NativeSpan><NativeSpan className="cr-docs-category-count">{item.count}</NativeSpan></NativeButton>)}</NativeDiv> : null}
        <NativeDiv className="cr-docs-list-heading"><NativeSpan role="status">{query.loading && !documents.length ? 'Dokumente werden geladen…' : `${visibleDocuments.length} ${visibleDocuments.length === 1 ? 'Dokument' : 'Dokumente'}${activeCategory === CLIENT_DOCUMENT_ALL_CATEGORY_KEY ? ' in der Akte' : ` · ${getClientDocumentCategoryLabel(activeCategory)}`}`}</NativeSpan>{search || activeCategory !== CLIENT_DOCUMENT_ALL_CATEGORY_KEY ? <NativeButton type="button" onClick={() => { setSearch(''); selectCategory(CLIENT_DOCUMENT_ALL_CATEGORY_KEY); }}>Filter zurücksetzen</NativeButton> : <NativeSpan>Stand · zuletzt geändert</NativeSpan>}</NativeDiv>
        <NativeDiv ref={rowButtons} className="cr-docs-results" aria-busy={query.loading || query.refreshing}>
          {visibleDocuments.length ? <NativeUl className="cr-docs-list">{visibleDocuments.map(doc => <DocumentRow key={doc.id} doc={doc} onOpen={() => { lastOpened.current = doc.id; setSelectedDocId(doc.id); }}/>)}</NativeUl> : query.loading ? <NativeDiv className="cr-docs-empty" role="status"><Icon name="file"/><NativeP>Die Unterlagen werden zusammengestellt.</NativeP></NativeDiv> : queryError && !documents.length ? <NativeDiv className="cr-docs-empty"><NativeStrong>Dokumente derzeit nicht verfügbar</NativeStrong><NativeP>Versuchen Sie, die Liste erneut zu laden.</NativeP></NativeDiv> : <NativeDiv className="cr-docs-empty"><Icon name={documents.length ? 'search' : 'file'}/><NativeStrong>{documents.length ? 'Keine passenden Dokumente' : 'Hier entsteht die Dokumentenakte.'}</NativeStrong><NativeP>{documents.length ? 'Ändern Sie die Suche oder wählen Sie eine andere Kategorie.' : 'Unterlagen aus der Aufnahme und hochgeladene Dateien werden hier gesammelt.'}</NativeP>{!documents.length && !isReadOnly ? <NativeButton type="button" className="cr-docs-button" onClick={showUpload}>Erstes Dokument hinzufügen</NativeButton> : null}</NativeDiv>}
        </NativeDiv>
      </>}
    </NativeSection>
    <DocumentRecommendations module="office" workflow="client_documents" clientId={clientId} compact/>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
