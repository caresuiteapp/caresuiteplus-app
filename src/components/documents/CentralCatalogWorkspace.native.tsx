// Generated native presentation from src/components/documents/CentralCatalogWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {useNativeWorkflowWindow} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {nativeURL as URL,nativeWindow as window,nativeBlob as Blob} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeStyle,NativeNav,NativeButton,NativeSpan,NativeAside,NativeH2,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeStrong,NativeSmall,NativeEm,NativeH3,NativeP,NativeMain,NativeB,NativeSection,NativeArticle,NativeFieldset,NativeDetails,NativeSummary,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd,NativeIframe,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { shareNativeFile, printNativePdf } from '@/lib/platform/nativeFileDelivery.native';
import { prepareNativeInvoiceLogo } from '@/lib/platform/nativeInvoiceLogo.native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CENTRAL_DOCUMENT_CATALOG, filterCentralDocuments, findCentralDocument } from '@/data/seeds/documentCatalog/centralCatalog';
import { CENTRAL_CATALOG_GROUPS } from '@/data/seeds/documentCatalog/centralCatalogTitles';
import { centralFileName, centralMissingFields, createCentralSnapshot, newCentralDocumentId, refreshCentralSnapshot } from '@/lib/documents/centralCatalogModel';
import type { ServiceResult } from '@/types';
import type { CentralDocumentContext, CentralDocumentDefinition, CentralDocumentSnapshot, CentralDocumentStored, CentralDocumentTarget } from '@/types/documents/centralCatalog';
import { centralCatalogCss } from "./centralCatalogCss.native.ts";
import { CentralCatalogEntitySelect } from "./CentralCatalogEntitySelect.native.tsx";
import type { CentralCatalogEntityOption } from '@/lib/documents/centralCatalogEntities';
import { CentralCatalogQuickInput } from "./CentralCatalogQuickInput.native.tsx";
import { centralAdditionalQuickChoices, centralFieldQuickChoices, centralSectionQuickChoices, centralTableAllowsMultiple, centralTableQuickChoices } from '@/lib/documents/centralCatalogQuickChoices';
type Original = {
    bytes: Uint8Array;
    fileName: string;
};
type PdfResult = {
    bytes: Uint8Array;
    hash: string;
    pageCount: number;
};
export type CentralCatalogWorkspaceProps = {
    tenantId: string;
    author: string;
    demo: boolean;
    clients: CentralCatalogEntityOption[];
    employees: CentralCatalogEntityOption[];
    loadingEntities: boolean;
    entityError?: string;
    permissions: {
        create: boolean;
        preview: boolean;
        export: boolean;
        save: boolean;
    };
    module?: string;
    category?: string;
    clientId?: string;
    employeeId?: string;
    templateKey?: string;
    initialTab?: 'catalog' | 'records';
    records: CentralDocumentStored[];
    recordsError?: string;
    loadingRecords: boolean;
    recordsHasMore?: boolean;
    onLoadMore?: () => void;
    loadContext: (target: CentralDocumentTarget, id: string, definition?: CentralDocumentDefinition, references?: Record<string, string>) => Promise<ServiceResult<CentralDocumentContext>>;
    save: (snapshot: CentralDocumentSnapshot, bytes: Uint8Array, original?: Original) => Promise<ServiceResult<CentralDocumentStored>>;
    download: (record: CentralDocumentStored, original?: boolean) => Promise<ServiceResult<Uint8Array>>;
    onSaved: () => void;
    onRefresh: () => void;
    onRefreshEntities?: () => void;
    onNavigationGuardChange?: (guard: (() => boolean | Promise<boolean>) | null) => void;
};
const layoutNames = { letter: 'Fensterbrief', contract: 'Vertrag / Erklärung', form: 'Formular', table: 'Nachweistabelle', checklist: 'Checkliste' };
const targetNames = { client: 'Klientenakte', employee: 'Personalakte', company: 'Unternehmensakte' };
const moduleNames: Record<string, string> = { office: 'Office', assist: 'Assist', pflege: 'Pflege', stationaer: 'Stationär', beratung: 'Beratung' };
function downloadBytes(bytes: Uint8Array, fileName: string) { return shareNativeFile(bytes, fileName, 'application/pdf'); }
async function logoImage(url: string): Promise<string | undefined> { if (!url)
    return undefined; if (!url.startsWith('data:') && new URL(url).protocol !== 'https:')
    throw Error('Das Unternehmenslogo benötigt eine sichere HTTPS-Adresse.'); const logo = await prepareNativeInvoiceLogo(url); if (!logo)
    throw Error('Das Unternehmenslogo konnte nicht für die PDF-Ausgabe geladen werden.'); return logo.dataUrl; }
export function CentralCatalogWorkspace(props: CentralCatalogWorkspaceProps) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState(CENTRAL_CATALOG_GROUPS.some((group) => group.key === props.category) ? props.category! : '');
    const [module, setModule] = useState(props.module ?? '');
    const [selectedKey, setSelectedKey] = useState(props.templateKey ?? '');
    const [tab, setTab] = useState<'catalog' | 'records'>(props.initialTab ?? 'catalog');
    const [copy, setCopy] = useState<CentralDocumentStored | null>(null);
    const [recordBusy, setRecordBusy] = useState('');
    const [recordMessage, setRecordMessage] = useState('');
    const dirty = useRef(false);
    const working = useRef(false);
    const downloadLock = useRef(false);
    const [editorBusy, setEditorBusy] = useState(false);
    const reportDirty = useCallback((value: boolean) => { dirty.current = value; }, []);
    const reportWorking = useCallback((value: boolean) => { working.current = value; setEditorBusy(value); }, []);
    const allowSwitch = useCallback(async () => !working.current && (!dirty.current || await confirmNativeWorkspaceAction('Der bearbeitete Entwurf ist noch nicht in der Akte gespeichert. Änderungen verwerfen und wechseln?')), []);
    const registerNavigationGuard = props.onNavigationGuardChange;
    useEffect(() => runNativeWorkspaceEffect(async (confirmNativeWorkspaceAction) => {
        await registerNavigationGuard?.(allowSwitch);
        return async () => await registerNavigationGuard?.(null);
    }), [allowSwitch, registerNavigationGuard]);
    const visible = useMemo(() => filterCentralDocuments({ query, category, module }), [query, category, module]);
    const selected = copy?.snapshot.definition ?? findCentralDocument(selectedKey);
    const allModules = useMemo(() => [...new Set(CENTRAL_DOCUMENT_CATALOG.flatMap((d) => [...d.modules]))].sort(), []);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const openStored = async (record: CentralDocumentStored, original = false) => {
        if (downloadLock.current)
            return;
        downloadLock.current = true;
        setRecordBusy(record.id);
        setRecordMessage('');
        try {
            const result = await props.download(record, original);
            if (!mounted.current)
                return;
            if (result.ok) {
                await downloadBytes(result.data, original ? centralFileName(record.snapshot).replace('_ENTWURF.pdf', '_ORIGINAL.pdf') : centralFileName(record.snapshot));
                setRecordMessage('Gespeicherte Datei geprüft und an Android übergeben.');
            }
            else
                setRecordMessage(result.error);
        }
        catch {
            if (mounted.current)
                setRecordMessage('Die gespeicherte Datei konnte nicht geladen werden.');
        }
        finally {
            downloadLock.current = false;
            if (mounted.current)
                setRecordBusy('');
        }
    };
    return <NativeWorkspaceStyleScope css={[centralCatalogCss, centralCatalogCss]}>{<NativeDiv className="csdc">
    <NativeStyle>{centralCatalogCss}</NativeStyle>
    <NativeNav className="csdc-tabs" aria-label="Dokumentenkatalog"><NativeButton className={tab === 'catalog' ? 'active' : ''} aria-current={tab === 'catalog' ? 'page' : undefined} onClick={() => setTab('catalog')}>Vorlagenkatalog <NativeSpan>{CENTRAL_DOCUMENT_CATALOG.length}</NativeSpan></NativeButton><NativeButton className={tab === 'records' ? 'active' : ''} aria-current={tab === 'records' ? 'page' : undefined} disabled={editorBusy} onClick={async () => { if (tab === 'records' || await allowSwitch()) {
        dirty.current = false;
        setTab('records');
    } }}>Gespeicherte Fassungen <NativeSpan>{props.records.length}{props.recordsHasMore ? '+' : ''}</NativeSpan></NativeButton></NativeNav>
    {tab === 'catalog' ? <NativeDiv className="csdc-workspace">
      <NativeAside className="csdc-panel csdc-catalog">
        <NativeDiv className="csdc-panel-heading"><NativeH2>Vorlage auswählen</NativeH2><NativeSpan>{visible.length} Treffer</NativeSpan></NativeDiv>
        <NativeLabel className="csdc-field">Suche<NativeInput type="search" placeholder="z. B. Leistungsnachweis, Wunde, Vertrag" value={query} onChange={(e) => setQuery(e.target.value)}/></NativeLabel>
        <NativeLabel className="csdc-field">Fachbereich<NativeSelect value={category} onChange={(e) => setCategory(e.target.value)}><NativeOption value="">Alle {CENTRAL_CATALOG_GROUPS.length} Fachbereiche</NativeOption>{CENTRAL_CATALOG_GROUPS.map((g) => <NativeOption key={g.key} value={g.key}>{g.name}</NativeOption>)}</NativeSelect></NativeLabel>
        <NativeLabel className="csdc-field">Arbeitsbereich<NativeSelect value={module} onChange={(e) => setModule(e.target.value)}><NativeOption value="">Alle Arbeitsbereiche</NativeOption>{allModules.map((m) => <NativeOption key={m} value={m}>{moduleNames[m] ?? m}</NativeOption>)}</NativeSelect></NativeLabel>
        <NativeDiv className="csdc-catalog-list" aria-label="Vorlagen">
          {visible.length ? visible.map((d) => <NativeButton key={d.key} className={`csdc-template ${selectedKey === d.key ? 'selected' : ''}`} aria-pressed={selectedKey === d.key} disabled={editorBusy} onClick={async () => { if ((selectedKey === d.key && !copy) || !await allowSwitch())
                return; dirty.current = false; setSelectedKey(d.key); setCopy(null); }}>
            <NativeSpan className="csdc-template-icon">{d.sourceMode === 'original' ? '↳' : d.layout === 'table' ? '▦' : d.layout === 'contract' ? '§' : '▤'}</NativeSpan>
            <NativeSpan><NativeStrong>{d.title}</NativeStrong><NativeSmall>{d.categoryName}</NativeSmall><NativeEm>{d.sourceMode === 'original' ? 'Original + Begleitblatt' : layoutNames[d.layout]} · {d.orientation === 'landscape' ? 'Querformat' : 'Hochformat'}</NativeEm></NativeSpan>
          </NativeButton>) : <NativeDiv className="csdc-empty"><NativeH3>Keine passende Vorlage</NativeH3><NativeP>Ändern Sie die Suche oder setzen Sie die Filter zurück.</NativeP><NativeButton className="csdc-button secondary" onClick={() => { setQuery(''); setCategory(''); setModule(''); }}>Filter zurücksetzen</NativeButton></NativeDiv>}
        </NativeDiv>
      </NativeAside>
      <NativeMain className="csdc-editor-host">
        {selectedKey && !selected ? <NativeP className="csdc-alert" role="alert">Diese Vorlage ist nicht mehr im aktuellen Katalog verfügbar. Wählen Sie eine andere Vorlage. Gespeicherte Fassungen bleiben im gleichnamigen Bereich erhalten.</NativeP> : null}
        {selected ? <CentralCatalogEditor key={`${props.tenantId}:${selected.key}:${copy?.id ?? 'new'}`} definition={selected} {...props} copy={copy} onDraftChange={reportDirty} onWorkingChange={reportWorking}/> : <NativeDiv className="csdc-panel csdc-welcome"><NativeDiv className="csdc-welcome-symbol" aria-hidden="true">▤</NativeDiv><NativeSpan className="csdc-eyebrow">VORLAGEN UND AKTENABLAGE</NativeSpan><NativeH2>Welches Dokument benötigen Sie?</NativeH2><NativeP>Wählen Sie eine Vorlage und die passende Akte. Gespeicherte Angaben werden übernommen; eigene Ergänzungen bleiben bearbeitbar.</NativeP><NativeDiv className="csdc-steps"><NativeDiv><NativeB>01</NativeB><NativeStrong>Vorlage wählen</NativeStrong><NativeSpan>Suche und Fachbereiche führen zur passenden Unterlage.</NativeSpan></NativeDiv><NativeDiv><NativeB>02</NativeB><NativeStrong>Angaben ergänzen</NativeStrong><NativeSpan>Stammdaten übernehmen und Schnellauswahlen nutzen.</NativeSpan></NativeDiv><NativeDiv><NativeB>03</NativeB><NativeStrong>Dokument ablegen</NativeStrong><NativeSpan>PDF prüfen, drucken und in der zugehörigen Akte speichern.</NativeSpan></NativeDiv></NativeDiv></NativeDiv>}
      </NativeMain>
    </NativeDiv> : <NativeSection className="csdc-panel">
      <NativeDiv className="csdc-panel-heading"><NativeDiv><NativeH2>Gespeicherte Dokumentfassungen</NativeH2><NativeP>Jede Fassung hat eine eigene ID. Eine Bearbeitung erzeugt eine neue Fassung.</NativeP></NativeDiv><NativeButton className="csdc-button secondary" onClick={props.onRefresh}>Aktualisieren</NativeButton></NativeDiv>
      {props.recordsError ? <NativeP role="alert" className="csdc-alert">{props.recordsError}</NativeP> : null}
      {props.loadingRecords ? <NativeP role="status">Fassungen werden geladen …</NativeP> : null}
      {recordMessage ? <NativeP role="status" className="csdc-notice">{recordMessage}</NativeP> : null}
      {!props.records.length && !props.loadingRecords && !props.recordsError ? <NativeDiv className="csdc-empty"><NativeH3>Noch keine Katalogdokumente gespeichert</NativeH3><NativeP>Erstellte Entwürfe erscheinen nach erfolgreicher Aktenablage hier.</NativeP></NativeDiv> : props.records.map((r) => <NativeArticle key={r.id} className="csdc-record"><NativeDiv><NativeStrong>{r.title}</NativeStrong><NativeP>{r.snapshot.context.subject.name} · {targetNames[r.snapshot.context.target]} · Fassung {r.revision} · Entwurf{r.snapshot.definition.layout === 'letter' ? ` · Empfänger: ${r.snapshot.values.subjectName}` : ''}</NativeP><NativeSmall>{new Date(r.createdAt).toLocaleDateString('de-DE')} · ID {r.id}</NativeSmall>{r.pdfHash ? <NativeSmall className="csdc-hash">SHA-256 {r.pdfHash}</NativeSmall> : null}</NativeDiv><NativeDiv className="csdc-actions"><NativeButton className="csdc-button secondary" disabled={!!recordBusy} onClick={() => void openStored(r)}>{recordBusy === r.id ? 'Prüfen …' : 'PDF prüfen & laden'}</NativeButton>{r.originalHash ? <NativeButton className="csdc-button secondary" disabled={!!recordBusy} onClick={() => void openStored(r, true)}>Original prüfen &amp; laden</NativeButton> : null}<NativeButton className="csdc-button" disabled={!props.permissions.create} onClick={() => { setSelectedKey(r.templateKey); setCopy(r); setTab('catalog'); }}>Neue Fassung</NativeButton></NativeDiv></NativeArticle>)}
      {props.recordsHasMore && props.onLoadMore ? <NativeButton className="csdc-button secondary" disabled={props.loadingRecords} onClick={props.onLoadMore}>{props.loadingRecords ? 'Fassungen werden geladen …' : props.recordsError ? 'Weitere Fassungen erneut laden' : 'Weitere Fassungen laden'}</NativeButton> : null}
    </NativeSection>}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
function CentralCatalogEditor(props: CentralCatalogWorkspaceProps & {
    definition: CentralDocumentDefinition;
    copy: CentralDocumentStored | null;
    onDraftChange: (value: boolean) => void;
    onWorkingChange: (value: boolean) => void;
}) {
    const window = useNativeWorkflowWindow();
    const { loadContext, onDraftChange } = props;
    const sourceRequest = useRef({ loadContext, author: props.author, copy: props.copy });
    sourceRequest.current = { loadContext, author: props.author, copy: props.copy };
    const d = props.copy?.snapshot.definition ?? props.definition;
    const initialId = props.copy?.snapshot.context.entityId ?? (d.target === 'company' ? props.tenantId : d.target === 'client' ? props.clientId : props.employeeId) ?? '';
    const [entityId, setEntityId] = useState(initialId);
    const [snapshot, setSnapshot] = useState<CentralDocumentSnapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [sourceAttempt, setSourceAttempt] = useState(0);
    const [error, setError] = useState('');
    const [logo, setLogo] = useState<string>();
    const [logoWarning, setLogoWarning] = useState('');
    const [original, setOriginal] = useState<Original>();
    const [pdf, setPdf] = useState<PdfResult | null>(null);
    const [pdfUrl, setPdfUrl] = useState('');
    const [changeVersion, setChangeVersion] = useState(0);
    const [previewVersion, setPreviewVersion] = useState(-1);
    const [savedId, setSavedId] = useState('');
    const mounted = useRef(true);
    const actionLock = useRef(false);
    const uploadSequence = useRef(0);
    const activeSnapshot = useRef(snapshot);
    activeSnapshot.current = snapshot;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        const changed = changeVersion > 0 && !savedId;
        onDraftChange(changed);
        if (!changed && !busy)
            return;
        const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [changeVersion, savedId, onDraftChange, busy]);
    useEffect(() => {
        const { loadContext: fetchContext, author, copy: sourceCopy } = sourceRequest.current;
        let active = true;
        uploadSequence.current++;
        setLoading(false);
        setSnapshot(null);
        setPdf(null);
        setError('');
        setMessage('');
        setOriginal(undefined);
        setLogo(undefined);
        setLogoWarning('');
        setSavedId('');
        if (!entityId || !props.permissions.create)
            return;
        setLoading(true);
        void (async () => {
            try {
                const result = sourceCopy && entityId === sourceCopy.snapshot.context.entityId
                    ? { ok: true as const, data: sourceCopy.snapshot.context }
                    : await fetchContext(d.target, entityId, d);
                if (!active)
                    return;
                if (!result.ok) {
                    setError(result.error);
                    return;
                }
                const next = sourceCopy && entityId === sourceCopy.snapshot.context.entityId
                    ? { ...JSON.parse(JSON.stringify(sourceCopy.snapshot)) as CentralDocumentSnapshot, documentId: newCentralDocumentId(), revision: sourceCopy.revision + 1, parentDocumentId: sourceCopy.id, createdAt: new Date().toISOString() }
                    : createCentralSnapshot(d, result.data, author);
                if (next.definition.key !== d.key)
                    throw new Error('Die kopierte Fassung gehört zu einer anderen Vorlage.');
                setSnapshot(next);
                setChangeVersion(0);
                setPreviewVersion(-1);
                try {
                    const logoData = await logoImage(result.data.company.logoUrl);
                    if (active)
                        setLogo(logoData);
                }
                catch (cause) {
                    if (active)
                        setLogoWarning(cause instanceof Error ? cause.message : 'Unternehmenslogo nicht verfügbar.');
                }
            }
            catch (cause) {
                if (active)
                    setError(cause instanceof Error ? cause.message : 'Daten konnten nicht übernommen werden.');
            }
            finally {
                if (active)
                    setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [entityId, props.tenantId, props.permissions.create, d, sourceAttempt]);
    useEffect(() => {
        if (!pdf) {
            setPdfUrl('');
            return;
        }
        const url = URL.createObjectURL(new Blob([new Uint8Array(pdf.bytes)], { type: 'application/pdf' }));
        setPdfUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [pdf]);
    const missing = snapshot ? centralMissingFields(snapshot) : [];
    const choiceContext = snapshot?.context;
    const choiceDocumentId = snapshot?.documentId;
    const choiceOrigin = snapshot?.tableOrigin;
    const choiceRows = snapshot?.tableRows.length ?? 0;
    const quickChoices = useMemo(() => {
        if (!choiceContext || !choiceDocumentId)
            return null;
        const input = { definition: d, context: choiceContext, documentId: choiceDocumentId, tableOrigin: choiceOrigin };
        return {
            fields: Object.fromEntries(d.fields.map((field) => [field.key, centralFieldQuickChoices(input, field, props.author)])),
            sections: Object.fromEntries(d.sections.map((section) => [section.key, centralSectionQuickChoices(input, section)])),
            additional: centralAdditionalQuickChoices(input),
            cells: Array.from({ length: choiceRows }, (_, row) => d.columns.map((column) => centralTableQuickChoices(input, column, row, props.author))),
        };
    }, [d, choiceContext, choiceDocumentId, choiceOrigin, choiceRows, props.author]);
    const modify = (transform: (s: CentralDocumentSnapshot) => CentralDocumentSnapshot) => {
        setSnapshot((s) => {
            if (!s)
                return s;
            const next = savedId && s.parentDocumentId !== savedId ? { ...s, documentId: newCentralDocumentId(), parentDocumentId: savedId, revision: s.revision + 1, createdAt: new Date().toISOString() } : s;
            return transform(next);
        });
        setSavedId('');
        setChangeVersion((value) => value + 1);
        setMessage('');
    };
    const generate = async () => {
        if (!snapshot)
            throw new Error('Bitte zuerst eine Akte auswählen.');
        if (pdf && previewVersion === changeVersion)
            return pdf;
        const { renderCentralDocumentPdf } = await import('@/lib/documents/centralCatalogPdf');
        const result = renderCentralDocumentPdf(snapshot, { logoDataUrl: logo });
        if (mounted.current) {
            setPdf(result);
            setPreviewVersion(changeVersion);
        }
        return result;
    };
    const act = async (action: 'preview' | 'download' | 'print' | 'save') => {
        if (!snapshot || actionLock.current || loading)
            return;
        if (action === 'save' && (!props.permissions.save || missing.length || savedId || (d.sourceMode === 'original' && !original && !snapshot.parentDocumentId)))
            return;
        if (action === 'preview' ? !props.permissions.preview : action !== 'save' && !props.permissions.export)
            return;
        actionLock.current = true;
        props.onWorkingChange(true);
        setBusy(true);
        setError('');
        setMessage('');
        const chosen = snapshot;
        try {
            const result = await generate();
            if (!mounted.current || activeSnapshot.current !== chosen) {
                return;
            }
            if (action === 'download')
                await downloadBytes(result.bytes, centralFileName(chosen));
            if (action === 'print') {
                await printNativePdf(result.bytes, centralFileName(chosen));
                if (mounted.current)
                    setMessage('PDF an den Android-Druckdialog übergeben.');
            }
            if (action === 'save') {
                const saved = await props.save(chosen, result.bytes, original);
                if (!mounted.current)
                    return;
                if (!saved.ok)
                    throw new Error(saved.error);
                setSavedId(saved.data.id);
                setMessage(props.demo ? 'Entwurf in dieser Demo-Sitzung abgelegt.' : `Entwurf in der ${targetNames[d.target]} gespeichert.`);
                props.onSaved();
            }
        }
        catch (cause) {
            if (mounted.current)
                setError(cause instanceof Error ? cause.message : 'Die Aktion konnte nicht abgeschlossen werden.');
        }
        finally {
            actionLock.current = false;
            if (mounted.current) {
                props.onWorkingChange(false);
                setBusy(false);
            }
        }
    };
    const entities = d.target === 'client' ? props.clients : props.employees;
    const refreshSources = async () => {
        if (!snapshot || actionLock.current || loading)
            return;
        actionLock.current = true;
        props.onWorkingChange(true);
        const chosen = snapshot;
        setBusy(true);
        setError('');
        setMessage('');
        try {
            const result = await props.loadContext(d.target, entityId, d, chosen.context.procedure);
            if (!mounted.current || activeSnapshot.current !== chosen)
                return;
            if (!result.ok)
                throw new Error(result.error);
            const fresh = refreshCentralSnapshot(chosen, result.data, props.author);
            modify((next) => ({ ...fresh, documentId: next.documentId, parentDocumentId: next.parentDocumentId, revision: next.revision, createdAt: next.createdAt }));
            try {
                const data = await logoImage(result.data.company.logoUrl);
                if (mounted.current) {
                    setLogo(data);
                    setLogoWarning('');
                }
            }
            catch (cause) {
                if (mounted.current)
                    setLogoWarning(cause instanceof Error ? cause.message : 'Unternehmenslogo nicht verfügbar.');
            }
            if (mounted.current)
                setMessage('Gespeicherte Angaben aktualisiert. Individuelle Eingaben bleiben erhalten.');
        }
        catch (cause) {
            if (mounted.current)
                setError(cause instanceof Error ? cause.message : 'Stammdaten konnten nicht aktualisiert werden.');
        }
        finally {
            actionLock.current = false;
            if (mounted.current) {
                props.onWorkingChange(false);
                setBusy(false);
            }
        }
    };
    return <NativeWorkspaceStyleScope css={[centralCatalogCss]}>{<NativeSection className="csdc-panel csdc-editor">
    <NativeDiv className="csdc-panel-heading"><NativeDiv><NativeSpan className="csdc-eyebrow">{d.categoryName}</NativeSpan><NativeH2>{d.title}</NativeH2><NativeP>{layoutNames[d.layout]} · {d.orientation === 'landscape' ? 'A4 quer' : 'A4 hoch'} · {targetNames[d.target]}</NativeP></NativeDiv><NativeSpan className="csdc-badge">Entwurf · v{d.version}</NativeSpan></NativeDiv>
    <NativeP className="csdc-instructions">{d.instructions}</NativeP>
    {props.entityError ? <NativeDiv role="alert" className="csdc-alert"><NativeP>{props.entityError}</NativeP>{props.onRefreshEntities ? <NativeButton className="csdc-button secondary" disabled={props.loadingEntities} onClick={props.onRefreshEntities}>Aktenauswahl erneut laden</NativeButton> : null}</NativeDiv> : null}
    {d.target !== 'company' ? <CentralCatalogEntitySelect entities={entities} label={d.target === 'client' ? 'Klient:in / Patient:in auswählen' : 'Mitarbeiter:in auswählen'} selectedLabel={snapshot?.context.subject.name} disabled={busy || props.loadingEntities || !props.permissions.create} value={entityId} onChange={async (id) => {
                if (changeVersion > 0 && !savedId && !await confirmNativeWorkspaceAction('Ungespeicherte Änderungen verwerfen und eine andere Akte auswählen?'))
                    return false;
                uploadSequence.current++;
                setChangeVersion(0);
                setSnapshot(null);
                setPdf(null);
                setEntityId(id);
                return true;
            }}/> : null}
    {loading ? <NativeP role="status" className="csdc-notice">Gespeicherte Angaben werden übernommen …</NativeP> : null}
    {error ? <NativeP role="alert" className="csdc-alert">{error}</NativeP> : null}{message ? <NativeP role="status" className="csdc-success">{message}</NativeP> : null}
    {error && !snapshot && !loading && entityId && props.permissions.create ? <NativeButton className="csdc-button secondary" onClick={() => setSourceAttempt((value) => value + 1)}>Stammdaten erneut laden</NativeButton> : null}
    {logoWarning ? <NativeP className="csdc-notice">{logoWarning} Die Ausgabe verwendet die Unternehmensbezeichnung.</NativeP> : null}
    {!props.permissions.create ? <NativeDiv className="csdc-empty">Sie haben keine Berechtigung zum Erstellen von Dokumenten.</NativeDiv> : !snapshot && !loading ? <NativeDiv className="csdc-empty"><NativeH3>Die richtige Akte zuerst.</NativeH3><NativeP>Nach der Auswahl werden Unternehmens- und Personenangaben übernommen. Fehlende Angaben bleiben erkennbar.</NativeP></NativeDiv> : null}
    {snapshot ? <>
      <NativeDiv className="csdc-source"><NativeSpan>↳ Stammdaten übernommen</NativeSpan><NativeSmall>{new Date(snapshot.context.sourceFetchedAt).toLocaleString('de-DE')} · Änderungen gelten für diese Dokumentfassung.{snapshot.context.procedure?.invoiceNumber ? ` · Rechnung ${snapshot.context.procedure.invoiceNumber}` : ''}{snapshot.tableOrigin === 'stored' ? ' · Gespeicherte Vorgangsdaten in der Tabelle übernommen.' : ''}{snapshot.context.procedure?.sourceNote ? ` · ${snapshot.context.procedure.sourceNote}` : ''}</NativeSmall><NativeButton className="csdc-button secondary" disabled={busy || loading} onClick={() => void refreshSources()}>Stammdaten aktualisieren</NativeButton></NativeDiv>
      <NativeFieldset disabled={busy || loading} className="csdc-form">
        {d.layout === 'letter' ? <NativeLabel className="csdc-field">Empfängeranschrift übernehmen<NativeSelect value={snapshot.recipientSource ?? 'manual'} onChange={(event) => {
                    const source = event.target.value as NonNullable<CentralDocumentSnapshot['recipientSource']>;
                    modify((current) => {
                        if (source === 'manual')
                            return { ...current, recipientSource: source, fieldOrigins: { ...current.fieldOrigins, subjectName: 'manual', subjectAddress: 'manual' } };
                        const recipient = current.context[source];
                        return { ...current, recipientSource: source, values: { ...current.values, subjectName: recipient.name || '', subjectAddress: recipient.address || '' }, fieldOrigins: { ...current.fieldOrigins, subjectName: recipient.name ? 'stored' : 'empty', subjectAddress: recipient.address ? 'stored' : 'empty' } };
                    });
                }}><NativeOption value="manual">Individuelle Empfängeranschrift ergänzen</NativeOption><NativeOption value="subject">Zugeordnete Person / Organisation</NativeOption><NativeOption value="company">Eigenes Unternehmen</NativeOption><NativeOption value="representative" disabled={!snapshot.context.representative.name}>Gesetzliche Vertretung</NativeOption><NativeOption value="payor" disabled={!snapshot.context.payor.name}>Kostenträger – fehlende Anschrift ergänzen</NativeOption></NativeSelect><NativeSmall>Aktenzuordnung und Briefempfänger werden getrennt gewählt. Die Anschrift bleibt bearbeitbar.</NativeSmall></NativeLabel> : null}
        <NativeDiv className="csdc-field-grid">{d.fields.map((f) => <CentralCatalogQuickInput key={f.key} label={f.label} suffix={<>{f.required ? ' *' : ''}<NativeEm>{snapshot.fieldOrigins[f.key] === 'stored' ? 'Übernommen' : snapshot.fieldOrigins[f.key] === 'manual' ? 'Individuell' : snapshot.fieldOrigins[f.key] === 'default' ? 'Vorgabe' : 'Offen'}</NativeEm></>} type={f.type} rows={f.key.includes('Address') ? 2 : 3} className={f.type === 'multiline' ? 'wide' : ''} multiple={f.type === 'multiline' && !f.sourcePath} value={snapshot.values[f.key] ?? ''} choices={quickChoices?.fields[f.key] ?? []} onChange={(transform) => modify((s) => ({ ...s, values: { ...s.values, [f.key]: transform(s.values[f.key] ?? '') }, fieldOrigins: { ...s.fieldOrigins, [f.key]: 'manual' } }))}/>)}</NativeDiv>
        {d.sections.length ? <NativeDiv className="csdc-sections"><NativeH3>{d.layout === 'letter' ? 'Brieftext' : 'Bearbeitbare Textabschnitte'}</NativeH3>{d.sections.map((section) => <NativeDetails key={section.key} open={d.layout === 'letter' || undefined}><NativeSummary>{section.heading}</NativeSummary><CentralCatalogQuickInput hiddenLabel label={`${section.heading} bearbeiten`} rows={7} value={snapshot.sectionTexts[section.key] ?? section.text} choices={quickChoices?.sections[section.key] ?? []} onChange={(transform) => modify((s) => ({ ...s, sectionTexts: { ...s.sectionTexts, [section.key]: transform(s.sectionTexts[section.key] ?? section.text) } }))}/></NativeDetails>)}</NativeDiv> : null}
        {d.columns.length ? <NativeDiv className="csdc-table-section"><NativeDiv className="csdc-panel-heading"><NativeH3>{d.layout === 'checklist' ? 'Prüfpunkte' : 'Nachweistabelle'}</NativeH3><NativeButton className="csdc-button secondary" type="button" onClick={() => modify((s) => ({ ...s, tableOrigin: 'manual', tableRows: [...s.tableRows, d.columns.map(() => '')] }))}>Zeile hinzufügen</NativeButton></NativeDiv><NativeDiv className="csdc-table-scroll"><NativeTable><NativeThead><NativeTr>{d.columns.map((column) => <NativeTh key={column}>{column}</NativeTh>)}<NativeTh>Aktion</NativeTh></NativeTr></NativeThead><NativeTbody>{snapshot.tableRows.map((row, r) => <NativeTr key={r}>{d.columns.map((column, col) => <NativeTd key={column}><CentralCatalogQuickInput key={`${snapshot.tableRows.length}:${r}:${col}`} compact label={`${column}, Zeile ${r + 1}`} rows={2} value={row[col] ?? ''} choices={quickChoices?.cells[r]?.[col] ?? []} multiple={centralTableAllowsMultiple(column)} onChange={(transform) => modify((s) => ({ ...s, tableOrigin: 'manual', tableRows: s.tableRows.map((cells, index) => index === r ? cells.map((value, i) => i === col ? transform(value) : value) : cells) }))}/></NativeTd>)}<NativeTd><NativeButton className="csdc-row-delete" aria-label={`Zeile ${r + 1} entfernen`} onClick={() => modify((s) => ({ ...s, tableOrigin: 'manual', tableRows: s.tableRows.filter((_, index) => index !== r) }))}>×</NativeButton></NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv><NativeP className="csdc-hint">Die PDF-Ausgabe wiederholt den Tabellenkopf auf jeder Folgeseite.</NativeP></NativeDiv> : null}
        <CentralCatalogQuickInput label="Individuelle Zusatztexte / Vereinbarungen" className="csdc-additional" rows={4} placeholder="Ergänzungen, Anlagen, abweichende Vereinbarungen …" value={snapshot.additionalText} choices={quickChoices?.additional ?? []} onChange={(transform) => modify((s) => ({ ...s, additionalText: transform(s.additionalText) }))}/>
        {d.sourceMode === 'original' ? <NativeLabel className="csdc-field">Originalunterlage als PDF *<NativeInput type="file" accept="application/pdf,.pdf" onChange={async (e) => {
                    const sequence = ++uploadSequence.current;
                    const file = e.target.files?.[0];
                    setOriginal(undefined);
                    setError('');
                    if (!file) {
                        modify((s) => s);
                        return;
                    }
                    if (file.size > 8 * 1024 * 1024) {
                        setError('Die Originaldatei darf höchstens 8 MB groß sein.');
                        return;
                    }
                    try {
                        const bytes = new Uint8Array(await file.arrayBuffer());
                        if (!mounted.current || sequence !== uploadSequence.current)
                            return;
                        if (!new TextDecoder().decode(bytes.subarray(0, 8)).startsWith('%PDF-'))
                            throw new Error('Bitte eine gültige PDF-Datei auswählen.');
                        setOriginal({ bytes, fileName: file.name });
                        modify((s) => s);
                    }
                    catch (cause) {
                        if (mounted.current && sequence === uploadSequence.current)
                            setError(cause instanceof Error ? cause.message : 'Die Originaldatei konnte nicht gelesen werden.');
                    }
                }}/><NativeSmall>{original?.fileName || (snapshot.parentDocumentId && props.copy?.originalHash ? 'Originalunterlage wird aus der Vorgängerfassung übernommen.' : 'Das Begleitblatt ersetzt die Originalunterlage nicht.')}</NativeSmall></NativeLabel> : null}
      </NativeFieldset>
      {missing.length ? <NativeP className="csdc-notice">Noch erforderlich für die Aktenablage: {missing.join(' · ')}</NativeP> : null}
      <NativeDiv className="csdc-actions csdc-editor-actions"><NativeButton className="csdc-button secondary" disabled={busy || loading || !props.permissions.preview} onClick={() => void act('preview')}>{busy ? 'Wird verarbeitet …' : 'PDF-Vorschau'}</NativeButton><NativeButton className="csdc-button secondary" disabled={busy || loading || !props.permissions.export} onClick={() => void act('download')}>PDF herunterladen</NativeButton><NativeButton className="csdc-button secondary" disabled={busy || loading || !props.permissions.export} onClick={() => void act('print')}>Drucken</NativeButton><NativeButton className="csdc-button" disabled={busy || loading || !props.permissions.save || !!missing.length || !!savedId || (d.sourceMode === 'original' && !original && !snapshot.parentDocumentId)} onClick={() => void act('save')}>{savedId ? 'Fassung gespeichert' : 'Entwurf in Akte speichern'}</NativeButton></NativeDiv>
      {pdfUrl ? <NativeSection className="csdc-preview"><NativeDiv className="csdc-panel-heading"><NativeH3>PDF-Vorschau</NativeH3><NativeSpan>{pdf?.pageCount} Seite(n) · {previewVersion === changeVersion ? 'Aktuell' : 'Änderungen noch nicht übernommen'}</NativeSpan></NativeDiv><NativeIframe src={pdfUrl} title={`PDF-Vorschau: ${d.title}`}/><NativeP className="csdc-hash">Dateiprüfwert: SHA-256 {pdf?.hash}</NativeP><NativeP className="csdc-hint">ID und Dateiprüfwert ermöglichen Zuordnung und Integritätsprüfung. Sie belegen keine externe Zertifizierung.</NativeP></NativeSection> : null}
      <NativeP className="csdc-document-id">Dokument-ID {snapshot.documentId} · Fassung {snapshot.revision}</NativeP>
    </> : null}
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
