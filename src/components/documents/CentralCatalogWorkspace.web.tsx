import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CENTRAL_DOCUMENT_CATALOG, filterCentralDocuments, findCentralDocument } from '@/data/seeds/documentCatalog/centralCatalog';
import { CENTRAL_CATALOG_GROUPS } from '@/data/seeds/documentCatalog/centralCatalogTitles';
import { centralFileName, centralMissingFields, createCentralSnapshot, newCentralDocumentId, refreshCentralSnapshot } from '@/lib/documents/centralCatalogModel';
import type { ServiceResult } from '@/types';
import type { CentralDocumentContext, CentralDocumentDefinition, CentralDocumentSnapshot, CentralDocumentStored, CentralDocumentTarget } from '@/types/documents/centralCatalog';
import { centralCatalogCss } from './centralCatalogCss.web';
import { CentralCatalogEntitySelect } from './CentralCatalogEntitySelect.web';
import type { CentralCatalogEntityOption } from '@/lib/documents/centralCatalogEntities';

type Original = { bytes: Uint8Array; fileName: string };
type PdfResult = { bytes: Uint8Array; hash: string; pageCount: number };
export type CentralCatalogWorkspaceProps = {
  tenantId: string; author: string; demo: boolean;
  clients: CentralCatalogEntityOption[]; employees: CentralCatalogEntityOption[]; loadingEntities: boolean; entityError?: string;
  permissions: { create: boolean; preview: boolean; export: boolean; save: boolean };
  module?: string; clientId?: string; employeeId?: string; templateKey?: string;
  initialTab?: 'catalog' | 'records';
  records: CentralDocumentStored[]; recordsError?: string; loadingRecords: boolean;
  recordsHasMore?: boolean; onLoadMore?: () => void;
  loadContext: (target: CentralDocumentTarget, id: string, definition?: CentralDocumentDefinition, references?: Record<string, string>) => Promise<ServiceResult<CentralDocumentContext>>;
  save: (snapshot: CentralDocumentSnapshot, bytes: Uint8Array, original?: Original) => Promise<ServiceResult<CentralDocumentStored>>;
  download: (record: CentralDocumentStored, original?: boolean) => Promise<ServiceResult<Uint8Array>>;
  onSaved: () => void; onRefresh: () => void;
};
const layoutNames = { letter: 'Fensterbrief', contract: 'Vertrag / Erklärung', form: 'Formular', table: 'Nachweistabelle', checklist: 'Checkliste' };
const targetNames = { client: 'Klientenakte', employee: 'Personalakte', company: 'Unternehmensakte' };

function downloadBytes(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function logoImage(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (/^data:image\/(png|jpeg);base64,/.test(url)) return url;
  const parsed = new URL(url); if (parsed.protocol !== 'https:') throw new Error('Das Unternehmenslogo benötigt eine sichere HTTPS-Adresse.');
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error('Das Unternehmenslogo konnte nicht innerhalb von 15 Sekunden geladen werden.')); }, 15000);
    image.onload = () => {
      clearTimeout(timeout);
      try {
        if (!image.naturalWidth || !image.naturalHeight) throw new Error();
        const canvas = document.createElement('canvas'); const scale = Math.min(1, 680 / image.naturalWidth, 280 / image.naturalHeight);
        canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
        canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/png'));
      } catch { reject(new Error('Das Unternehmenslogo konnte nicht für die PDF-Ausgabe geladen werden.')); }
    };
    image.onerror = () => { clearTimeout(timeout); reject(new Error('Das Unternehmenslogo konnte nicht für die PDF-Ausgabe geladen werden.')); };
    image.src = url;
  });
}

export function CentralCatalogWorkspace(props: CentralCatalogWorkspaceProps) {
  const [query, setQuery] = useState(''); const [category, setCategory] = useState('');
  const [module, setModule] = useState(props.module ?? '');
  const [selectedKey, setSelectedKey] = useState(props.templateKey ?? '');
  const [tab, setTab] = useState<'catalog' | 'records'>(props.initialTab ?? 'catalog');
  const [copy, setCopy] = useState<CentralDocumentStored | null>(null);
  const [recordBusy, setRecordBusy] = useState(''); const [recordMessage, setRecordMessage] = useState('');
  const dirty = useRef(false);
  const reportDirty = useCallback((value:boolean) => { dirty.current=value; },[]);
  const allowSwitch = () => !dirty.current || window.confirm('Der bearbeitete Entwurf ist noch nicht in der Akte gespeichert. Änderungen verwerfen und wechseln?');
  const visible = useMemo(() => filterCentralDocuments({ query, category, module }), [query, category, module]);
  const selected = findCentralDocument(selectedKey);
  const allModules = useMemo(() => [...new Set(CENTRAL_DOCUMENT_CATALOG.flatMap((d) => [...d.modules]))].sort(), []);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const openStored = async (record: CentralDocumentStored, original = false) => {
    setRecordBusy(record.id); setRecordMessage('');
    try {
      const result = await props.download(record, original); if (!mounted.current) return;
      if (result.ok) { downloadBytes(result.data, original ? centralFileName(record.snapshot).replace('_ENTWURF.pdf','_ORIGINAL.pdf') : centralFileName(record.snapshot)); setRecordMessage('Gespeicherte Datei geprüft und heruntergeladen.'); }
      else setRecordMessage(result.error);
    } catch { if (mounted.current) setRecordMessage('Die gespeicherte Datei konnte nicht geladen werden.'); }
    finally { if (mounted.current) setRecordBusy(''); }
  };
  return <div className="csdc">
    <style>{centralCatalogCss}</style>
    <div className="csdc-hero">
      <div><span className="csdc-eyebrow">OFFICE · ZENTRALER DOKUMENTENKATALOG</span><h1>Dokumentenkatalog</h1><p>Vorlagen auswählen, gespeicherte Angaben übernehmen und Dokumente in der zugehörigen Akte ablegen.</p></div>
      <div className="csdc-stats"><div><strong>{CENTRAL_DOCUMENT_CATALOG.length}</strong><span>Katalogeinträge</span></div><div><strong>{CENTRAL_CATALOG_GROUPS.length}</strong><span>Fachbereiche</span></div><div><strong>A4</strong><span>Hoch / Quer</span></div></div>
    </div>
    <nav className="csdc-tabs" aria-label="Dokumentenkatalog"><button className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>Vorlagenkatalog <span>{CENTRAL_DOCUMENT_CATALOG.length}</span></button><button className={tab === 'records' ? 'active' : ''} onClick={() => { if(tab==='records'||allowSwitch()){dirty.current=false;setTab('records');} }}>Gespeicherte Fassungen <span>{props.records.length}</span></button></nav>
    {tab === 'catalog' ? <div className="csdc-workspace">
      <aside className="csdc-panel csdc-catalog">
        <div className="csdc-panel-heading"><h2>Vorlage auswählen</h2><span>{visible.length} Treffer</span></div>
        <label className="csdc-field">Suche<input type="search" placeholder="z. B. Leistungsnachweis, Wunde, Vertrag" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label className="csdc-field">Fachbereich<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Alle {CENTRAL_CATALOG_GROUPS.length} Fachbereiche</option>{CENTRAL_CATALOG_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}</select></label>
        <label className="csdc-field">Modul<select value={module} onChange={(e) => setModule(e.target.value)}><option value="">Alle Module</option>{allModules.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}</select></label>
        <div className="csdc-catalog-list" aria-label="Vorlagen">
          {visible.length ? visible.map((d) => <button key={d.key} className={`csdc-template ${selectedKey === d.key ? 'selected' : ''}`} aria-pressed={selectedKey === d.key} onClick={() => { if(selectedKey===d.key || !allowSwitch())return; dirty.current=false;setSelectedKey(d.key); setCopy(null); }}>
            <span className="csdc-template-icon">{d.sourceMode === 'original' ? '↳' : d.layout === 'table' ? '▦' : d.layout === 'contract' ? '§' : '▤'}</span>
            <span><strong>{d.title}</strong><small>{d.categoryName}</small><em>{d.sourceMode === 'original' ? 'Original + Begleitblatt' : layoutNames[d.layout]} · {d.orientation === 'landscape' ? 'Querformat' : 'Hochformat'}</em></span>
          </button>) : <div className="csdc-empty"><h3>Keine passende Vorlage</h3><p>Ändern Sie die Suche oder setzen Sie die Filter zurück.</p><button className="csdc-button secondary" onClick={() => { setQuery(''); setCategory(''); setModule(''); }}>Filter zurücksetzen</button></div>}
        </div>
      </aside>
      <main className="csdc-editor-host">
        {selected ? <CentralCatalogEditor key={`${props.tenantId}:${selected.key}:${copy?.id ?? 'new'}`} definition={selected} {...props} copy={copy} onDraftChange={reportDirty} /> : <div className="csdc-panel csdc-welcome"><div className="csdc-welcome-symbol">▤</div><span className="csdc-eyebrow">NEU FÜR CARESUITE HEALTHOS</span><h2>Von der Vorlage in die Akte.</h2><p>Wählen Sie links ein Dokument und anschließend die passende Person oder Organisation. Gespeicherte Angaben werden übernommen und bleiben bearbeitbar.</p><div className="csdc-steps"><div><b>01</b><strong>Auswählen</strong><span>{CENTRAL_DOCUMENT_CATALOG.length} Einträge aus Pflege, Betreuung, Verwaltung, Personal und Software.</span></div><div><b>02</b><strong>Ergänzen</strong><span>Felder, Vertragsabschnitte, Tabellen und individuelle Texte.</span></div><div><b>03</b><strong>Ausgeben</strong><span>PDF ansehen, drucken und als Entwurf in der Akte ablegen.</span></div></div></div>}
      </main>
    </div> : <section className="csdc-panel">
      <div className="csdc-panel-heading"><div><h2>Gespeicherte Dokumentfassungen</h2><p>Jede Fassung hat eine eigene ID. Eine Bearbeitung erzeugt eine neue Fassung.</p></div><button className="csdc-button secondary" onClick={props.onRefresh}>Aktualisieren</button></div>
      {props.recordsError ? <p role="alert" className="csdc-alert">{props.recordsError}</p> : null}
      {props.loadingRecords ? <p role="status">Fassungen werden geladen …</p> : null}
      {recordMessage ? <p role="status" className="csdc-notice">{recordMessage}</p> : null}
      {!props.records.length && !props.loadingRecords && !props.recordsError ? <div className="csdc-empty"><h3>Noch keine Katalogdokumente gespeichert</h3><p>Erstellte Entwürfe erscheinen nach erfolgreicher Aktenablage hier.</p></div> : props.records.map((r) => <article key={r.id} className="csdc-record"><div><strong>{r.title}</strong><p>{r.snapshot.context.subject.name} · {targetNames[r.snapshot.context.target]} · Fassung {r.revision} · Entwurf{r.snapshot.definition.layout === 'letter' ? ` · Empfänger: ${r.snapshot.values.subjectName}` : ''}</p><small>{new Date(r.createdAt).toLocaleDateString('de-DE')} · ID {r.id}</small>{r.pdfHash ? <small className="csdc-hash">SHA-256 {r.pdfHash}</small> : null}</div><div className="csdc-actions"><button className="csdc-button secondary" disabled={!!recordBusy} onClick={() => void openStored(r)}>{recordBusy === r.id ? 'Prüfen …' : 'PDF prüfen & laden'}</button>{r.originalHash ? <button className="csdc-button secondary" disabled={!!recordBusy} onClick={() => void openStored(r, true)}>Original prüfen &amp; laden</button> : null}<button className="csdc-button" disabled={!props.permissions.create} onClick={() => { setSelectedKey(r.templateKey); setCopy(r); setTab('catalog'); }}>Neue Fassung</button></div></article>)}
      {props.recordsHasMore && props.onLoadMore ? <button className="csdc-button secondary" disabled={props.loadingRecords} onClick={props.onLoadMore}>{props.loadingRecords ? 'Fassungen werden geladen …' : props.recordsError ? 'Weitere Fassungen erneut laden' : 'Weitere Fassungen laden'}</button> : null}
    </section>}
  </div>;
}

function CentralCatalogEditor(props: CentralCatalogWorkspaceProps & { definition: CentralDocumentDefinition; copy: CentralDocumentStored | null; onDraftChange:(value:boolean)=>void }) {
  const { loadContext, onDraftChange } = props;
  const sourceRequest = useRef({ loadContext, author: props.author, copy: props.copy });
  sourceRequest.current = { loadContext, author: props.author, copy: props.copy };
  const d = props.copy?.snapshot.definition ?? props.definition;
  const initialId = props.copy?.snapshot.context.entityId ?? (d.target === 'company' ? props.tenantId : d.target === 'client' ? props.clientId : props.employeeId) ?? '';
  const [entityId, setEntityId] = useState(initialId);
  const [snapshot, setSnapshot] = useState<CentralDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [error, setError] = useState(''); const [logo, setLogo] = useState<string>(); const [logoWarning, setLogoWarning] = useState('');
  const [original, setOriginal] = useState<Original>(); const [pdf, setPdf] = useState<PdfResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState(''); const [changeVersion, setChangeVersion] = useState(0); const [previewVersion, setPreviewVersion] = useState(-1);
  const [savedId, setSavedId] = useState(''); const mounted = useRef(true);
  const uploadSequence = useRef(0);
  const activeSnapshot = useRef(snapshot); activeSnapshot.current = snapshot;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(()=>{
    const changed=changeVersion>0&&!savedId;onDraftChange(changed);
    if(!changed)return;
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload);
  },[changeVersion,savedId,onDraftChange]);
  useEffect(() => {
    const { loadContext: fetchContext, author, copy: sourceCopy } = sourceRequest.current;
    let active = true; uploadSequence.current++; setLoading(false); setSnapshot(null); setPdf(null); setError(''); setMessage(''); setOriginal(undefined); setLogo(undefined); setLogoWarning(''); setSavedId('');
    if (!entityId || !props.permissions.create) return;
    setLoading(true);
    void (async () => {
      try {
        const result = sourceCopy && entityId === sourceCopy.snapshot.context.entityId
          ? { ok: true as const, data: sourceCopy.snapshot.context }
          : await fetchContext(d.target, entityId, d);
        if (!active) return;
        if (!result.ok) { setError(result.error); return; }
        const next = sourceCopy && entityId === sourceCopy.snapshot.context.entityId
          ? { ...JSON.parse(JSON.stringify(sourceCopy.snapshot)) as CentralDocumentSnapshot, documentId: newCentralDocumentId(), revision: sourceCopy.revision + 1, parentDocumentId: sourceCopy.id, createdAt: new Date().toISOString() }
          : createCentralSnapshot(d, result.data, author);
        if (next.definition.key !== d.key) throw new Error('Die kopierte Fassung gehört zu einer anderen Vorlage.');
        setSnapshot(next); setChangeVersion(0); setPreviewVersion(-1);
        try { const logoData = await logoImage(result.data.company.logoUrl); if (active) setLogo(logoData); }
        catch (cause) { if (active) setLogoWarning(cause instanceof Error ? cause.message : 'Unternehmenslogo nicht verfügbar.'); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Daten konnten nicht übernommen werden.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [entityId, props.tenantId, props.permissions.create, d, sourceAttempt]);
  useEffect(() => {
    if (!pdf) { setPdfUrl(''); return; }
    const url = URL.createObjectURL(new Blob([new Uint8Array(pdf.bytes)], { type: 'application/pdf' })); setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdf]);
  const missing = snapshot ? centralMissingFields(snapshot) : [];
  const modify = (transform: (s: CentralDocumentSnapshot) => CentralDocumentSnapshot) => {
    setSnapshot((s) => {
      if (!s) return s;
      const next = savedId ? { ...s, documentId: newCentralDocumentId(), parentDocumentId: savedId, revision: s.revision + 1, createdAt: new Date().toISOString() } : s;
      return transform(next);
    }); setSavedId(''); setChangeVersion((value) => value + 1); setMessage('');
  };
  const generate = async () => {
    if (!snapshot) throw new Error('Bitte zuerst eine Akte auswählen.');
    if (pdf && previewVersion === changeVersion) return pdf;
    const { renderCentralDocumentPdf } = await import('@/lib/documents/centralCatalogPdf');
    const result = renderCentralDocumentPdf(snapshot, { logoDataUrl: logo });
    if (mounted.current) { setPdf(result); setPreviewVersion(changeVersion); } return result;
  };
  const act = async (action: 'preview' | 'download' | 'print' | 'save') => {
    if (!snapshot || busy || loading) return;
    setBusy(true); setError(''); setMessage('');
    const printWindow = action === 'print' ? window.open('', '_blank') : null;
    if (printWindow) printWindow.opener = null;
    const chosen = snapshot;
    try {
      const result = await generate(); if (!mounted.current || activeSnapshot.current !== chosen) { printWindow?.close(); return; }
      if (action === 'download') downloadBytes(result.bytes, centralFileName(chosen));
      if (action === 'print') {
        if (!printWindow) throw new Error('Der Browser hat das Druckfenster blockiert. Bitte Pop-ups für CareSuite erlauben.');
        const url = URL.createObjectURL(new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' }));
        printWindow.location.replace(url); printWindow.addEventListener('load', () => { try { printWindow.print(); } catch { /* Browser PDF viewer retains its own print control. */ } }, { once: true });
        setTimeout(() => URL.revokeObjectURL(url), 60000); setMessage('PDF-Druckansicht geöffnet. Falls kein Dialog erscheint, verwenden Sie das Drucksymbol der PDF-Ansicht.');
      }
      if (action === 'save') {
        const saved = await props.save(chosen, result.bytes, original); if (!mounted.current) return;
        if (!saved.ok) throw new Error(saved.error);
        setSavedId(saved.data.id); setMessage(props.demo ? 'Entwurf in dieser Demo-Sitzung abgelegt. PDF-Prüfwert gespeichert.' : `Entwurf in der ${targetNames[d.target]} gespeichert. PDF-Prüfwert serverseitig erstellt.`); props.onSaved();
      }
    } catch (cause) { printWindow?.close(); if (mounted.current) setError(cause instanceof Error ? cause.message : 'Die Aktion konnte nicht abgeschlossen werden.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  const entities = d.target === 'client' ? props.clients : props.employees;
  const refreshSources = async () => {
    if (!snapshot || busy || loading) return;
    const chosen = snapshot; setBusy(true); setError(''); setMessage('');
    try {
      const result = await props.loadContext(d.target, entityId, d, chosen.context.procedure);
      if (!mounted.current || activeSnapshot.current !== chosen) return;
      if (!result.ok) throw new Error(result.error);
      const fresh = refreshCentralSnapshot(chosen, result.data, props.author);
      modify((next) => ({ ...fresh, documentId: next.documentId, parentDocumentId: next.parentDocumentId, revision: next.revision, createdAt: next.createdAt }));
      try { const data = await logoImage(result.data.company.logoUrl); if (mounted.current) { setLogo(data); setLogoWarning(''); } }
      catch (cause) { if (mounted.current) setLogoWarning(cause instanceof Error ? cause.message : 'Unternehmenslogo nicht verfügbar.'); }
      if (mounted.current) setMessage('Gespeicherte Angaben aktualisiert. Individuelle Eingaben bleiben erhalten.');
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Stammdaten konnten nicht aktualisiert werden.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <section className="csdc-panel csdc-editor">
    <div className="csdc-panel-heading"><div><span className="csdc-eyebrow">{d.categoryName}</span><h2>{d.title}</h2><p>{layoutNames[d.layout]} · {d.orientation === 'landscape' ? 'A4 quer' : 'A4 hoch'} · {targetNames[d.target]}</p></div><span className="csdc-badge">Entwurf · v{d.version}</span></div>
    <p className="csdc-instructions">{d.instructions}</p>
    {props.entityError ? <p role="alert" className="csdc-alert">{props.entityError}</p> : null}
    {d.target !== 'company' ? <CentralCatalogEntitySelect entities={entities} label={d.target === 'client' ? 'Klient:in / Patient:in auswählen' : 'Mitarbeiter:in auswählen'} disabled={busy || props.loadingEntities || !props.permissions.create} value={entityId} onChange={(id) => {
      if (changeVersion > 0 && !savedId && !window.confirm('Ungespeicherte Änderungen verwerfen und eine andere Akte auswählen?')) return false;
      uploadSequence.current++; setChangeVersion(0); setSnapshot(null); setPdf(null); setEntityId(id); return true;
    }} /> : null}
    {loading ? <p role="status" className="csdc-notice">Gespeicherte Angaben werden übernommen …</p> : null}
    {error ? <p role="alert" className="csdc-alert">{error}</p> : null}{message ? <p role="status" className="csdc-success">{message}</p> : null}
    {error && !snapshot && !loading && entityId && props.permissions.create ? <button className="csdc-button secondary" onClick={() => setSourceAttempt((value) => value + 1)}>Stammdaten erneut laden</button> : null}
    {logoWarning ? <p className="csdc-notice">{logoWarning} Die Ausgabe verwendet die Unternehmensbezeichnung.</p> : null}
    {!props.permissions.create ? <div className="csdc-empty">Sie haben keine Berechtigung zum Erstellen von Dokumenten.</div> : !snapshot && !loading ? <div className="csdc-empty"><h3>Die richtige Akte zuerst.</h3><p>Nach der Auswahl werden Unternehmens- und Personenangaben übernommen. Fehlende Angaben bleiben erkennbar.</p></div> : null}
    {snapshot ? <>
      <div className="csdc-source"><span>↳ Stammdaten übernommen</span><small>{new Date(snapshot.context.sourceFetchedAt).toLocaleString('de-DE')} · Änderungen gelten für diese Dokumentfassung.{snapshot.context.procedure?.invoiceNumber ? ` · Rechnung ${snapshot.context.procedure.invoiceNumber}` : ''}{snapshot.tableOrigin === 'stored' ? ' · Gespeicherte Vorgangsdaten in der Tabelle übernommen.' : ''}{snapshot.context.procedure?.sourceNote ? ` · ${snapshot.context.procedure.sourceNote}` : ''}</small><button className="csdc-button secondary" disabled={busy || loading} onClick={() => void refreshSources()}>Stammdaten aktualisieren</button></div>
      <fieldset disabled={busy || loading} className="csdc-form">
        {d.layout === 'letter' ? <label className="csdc-field">Empfängeranschrift übernehmen<select value={snapshot.recipientSource ?? 'manual'} onChange={(event) => {
          const source = event.target.value as NonNullable<CentralDocumentSnapshot['recipientSource']>;
          modify((current) => {
            if (source === 'manual') return { ...current, recipientSource: source, fieldOrigins: { ...current.fieldOrigins, subjectName: 'manual', subjectAddress: 'manual' } };
            const recipient = current.context[source];
            return { ...current, recipientSource: source, values: { ...current.values, subjectName: recipient.name || '', subjectAddress: recipient.address || '' }, fieldOrigins: { ...current.fieldOrigins, subjectName: recipient.name ? 'stored' : 'empty', subjectAddress: recipient.address ? 'stored' : 'empty' } };
          });
        }}><option value="manual">Individuelle Empfängeranschrift ergänzen</option><option value="subject">Zugeordnete Person / Organisation</option><option value="company">Eigenes Unternehmen</option><option value="representative" disabled={!snapshot.context.representative.name}>Gesetzliche Vertretung</option><option value="payor" disabled={!snapshot.context.payor.name}>Kostenträger – fehlende Anschrift ergänzen</option></select><small>Aktenzuordnung und Briefempfänger werden getrennt gewählt. Die Anschrift bleibt bearbeitbar.</small></label> : null}
        <div className="csdc-field-grid">{d.fields.map((f) => <label className={`csdc-field ${f.type === 'multiline' ? 'wide' : ''}`} key={f.key}><span>{f.label}{f.required ? ' *' : ''}<em>{snapshot.fieldOrigins[f.key] === 'stored' ? 'Übernommen' : snapshot.fieldOrigins[f.key] === 'manual' ? 'Individuell' : snapshot.fieldOrigins[f.key] === 'default' ? 'Vorgabe' : 'Offen'}</em></span>{f.type === 'multiline' ? <textarea rows={f.key.includes('Address') ? 2 : 3} value={snapshot.values[f.key] ?? ''} onChange={(e) => modify((s) => ({ ...s, values: { ...s.values, [f.key]: e.target.value }, fieldOrigins: { ...s.fieldOrigins, [f.key]: 'manual' } }))} /> : <input type={f.type === 'date' ? 'date' : 'text'} value={snapshot.values[f.key] ?? ''} onChange={(e) => modify((s) => ({ ...s, values: { ...s.values, [f.key]: e.target.value }, fieldOrigins: { ...s.fieldOrigins, [f.key]: 'manual' } }))} />}</label>)}</div>
        {d.sections.length ? <div className="csdc-sections"><h3>{d.layout === 'letter' ? 'Brieftext' : 'Bearbeitbare Textabschnitte'}</h3>{d.sections.map((section) => <details key={section.key} open={d.layout === 'letter' || undefined}><summary>{section.heading}</summary><label className="csdc-field"><span className="csdc-sr-only">{section.heading} bearbeiten</span><textarea rows={7} value={snapshot.sectionTexts[section.key] ?? section.text} onChange={(e) => modify((s) => ({ ...s, sectionTexts: { ...s.sectionTexts, [section.key]: e.target.value } }))} /></label></details>)}</div> : null}
        {d.columns.length ? <div className="csdc-table-section"><div className="csdc-panel-heading"><h3>{d.layout === 'checklist' ? 'Prüfpunkte' : 'Nachweistabelle'}</h3><button className="csdc-button secondary" type="button" onClick={() => modify((s) => ({ ...s, tableOrigin: 'manual', tableRows: [...s.tableRows, d.columns.map(() => '')] }))}>Zeile hinzufügen</button></div><div className="csdc-table-scroll"><table><thead><tr>{d.columns.map((column) => <th key={column}>{column}</th>)}<th>Aktion</th></tr></thead><tbody>{snapshot.tableRows.map((row, r) => <tr key={r}>{d.columns.map((column, col) => <td key={column}><textarea rows={2} aria-label={`${column}, Zeile ${r + 1}`} value={row[col] ?? ''} onChange={(e) => modify((s) => ({ ...s, tableOrigin: 'manual', tableRows: s.tableRows.map((cells, index) => index === r ? cells.map((value, i) => i === col ? e.target.value : value) : cells) }))} /></td>)}<td><button className="csdc-row-delete" aria-label={`Zeile ${r + 1} entfernen`} onClick={() => modify((s) => ({ ...s, tableOrigin: 'manual', tableRows: s.tableRows.filter((_, index) => index !== r) }))}>×</button></td></tr>)}</tbody></table></div><p className="csdc-hint">Die PDF-Ausgabe wiederholt den Tabellenkopf auf jeder Folgeseite.</p></div> : null}
        <label className="csdc-field csdc-additional">Individuelle Zusatztexte / Vereinbarungen<textarea rows={4} placeholder="Ergänzungen, Anlagen, abweichende Vereinbarungen …" value={snapshot.additionalText} onChange={(e) => modify((s) => ({ ...s, additionalText: e.target.value }))} /></label>
        {d.sourceMode === 'original' ? <label className="csdc-field">Originalunterlage als PDF *<input type="file" accept="application/pdf,.pdf" onChange={async (e) => {
          const sequence = ++uploadSequence.current; const file = e.target.files?.[0];
          setOriginal(undefined); setError('');
          if (!file) { modify((s) => s); return; }
          if (file.size > 8 * 1024 * 1024) { setError('Die Originaldatei darf höchstens 8 MB groß sein.'); return; }
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (!mounted.current || sequence !== uploadSequence.current) return;
            if (!new TextDecoder().decode(bytes.subarray(0, 8)).startsWith('%PDF-')) throw new Error('Bitte eine gültige PDF-Datei auswählen.');
            setOriginal({ bytes, fileName: file.name }); modify((s) => s);
          } catch (cause) { if (mounted.current && sequence === uploadSequence.current) setError(cause instanceof Error ? cause.message : 'Die Originaldatei konnte nicht gelesen werden.'); }
        }} /><small>{original?.fileName || (snapshot.parentDocumentId && props.copy?.originalHash ? 'Originalunterlage wird aus der Vorgängerfassung übernommen.' : 'Das Begleitblatt ersetzt die Originalunterlage nicht.')}</small></label> : null}
      </fieldset>
      {missing.length ? <p className="csdc-notice">Noch erforderlich für die Aktenablage: {missing.join(' · ')}</p> : null}
      <div className="csdc-actions csdc-editor-actions"><button className="csdc-button secondary" disabled={busy || loading || !props.permissions.preview} onClick={() => void act('preview')}>{busy ? 'Wird verarbeitet …' : 'PDF-Vorschau'}</button><button className="csdc-button secondary" disabled={busy || loading || !props.permissions.export} onClick={() => void act('download')}>PDF herunterladen</button><button className="csdc-button secondary" disabled={busy || loading || !props.permissions.export} onClick={() => void act('print')}>Drucken</button><button className="csdc-button" disabled={busy || loading || !props.permissions.save || !!missing.length || !!savedId || (d.sourceMode === 'original' && !original && !snapshot.parentDocumentId)} onClick={() => void act('save')}>{savedId ? 'Fassung gespeichert' : 'Entwurf in Akte speichern'}</button></div>
      {pdfUrl ? <section className="csdc-preview"><div className="csdc-panel-heading"><h3>PDF-Vorschau</h3><span>{pdf?.pageCount} Seite(n) · {previewVersion === changeVersion ? 'Aktuell' : 'Änderungen noch nicht übernommen'}</span></div><iframe src={pdfUrl} title={`PDF-Vorschau: ${d.title}`} /><p className="csdc-hash">Dateiprüfwert: SHA-256 {pdf?.hash}</p><p className="csdc-hint">ID und Dateiprüfwert ermöglichen Zuordnung und Integritätsprüfung. Sie belegen keine externe Zertifizierung.</p></section> : null}
      <p className="csdc-document-id">Dokument-ID {snapshot.documentId} · Fassung {snapshot.revision}</p>
    </> : null}
  </section>;
}
