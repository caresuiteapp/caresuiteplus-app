import { KimHostPanel } from '@/components/office/gkv/GkvKimHost.web';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell.web';
import { CaseEditor, Choice, Field, ProfileEditor, money } from '@/components/office/gkv/GkvEditors.web';
import { RevisionHistory } from '@/components/office/gkv/GkvRevisionHistory.web';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useGkvUnsavedChanges } from '@/hooks/useGkvUnsavedChanges.web';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { billingDay, blankCase, blankDraft, GKV_SPEC, hasDraftShape, isMonth, SERVICE_TYPES, STATUS_LABELS, validateDraft, type ExchangeDraft, type ExchangeProfile, type ServiceType } from '@/lib/gkvExchange/model';
import { decodeLatin1 } from '@/lib/gkvExchange/edifact';
import { parseCarrierDirectory, resolveCarrierRoute, type CarrierDirectory } from '@/lib/gkvExchange/kostentraeger';
import { READINESS_REQUIREMENTS } from '@/lib/gkvExchange/lifecycle';
import { command, downloadBytes, readBatch, readDirectory, readEvents, readInvoiceCase, readInvoiceSources, readRevision, readRevisions, readWorkspace, requestTestExport, type Batch, type Event, type RevisionSummary, type SavedRevision, type SourceInvoice } from '@/lib/gkvExchange/repository.web';
import type { RoleKey } from '@/types';
import { gkvExchangeCss } from './gkvExchangeStyles.web';

type Workspace = Awaited<ReturnType<typeof readWorkspace>>;
type ExportFiles = Awaited<ReturnType<typeof requestTestExport>>;
const editableStates = ['draft', 'checked', 'blocked', 'exported_test'];
const eventLabels: Record<string, string> = { save: 'Entwurf gespeichert', cancel: 'Paket verworfen', export_note: 'Prüfdatei erstellt', feedback_note: 'Manueller Rückmeldungsvermerk', revision_copy: 'Prüfentwurf aus gespeichertem Stand angelegt', revision_copy_source: 'Gespeicherter Stand in neuen Prüfentwurf übernommen' };
const dateTime = (date: string) => new Date(date).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });

export function GkvKassenabrechnungScreen() {
  const auth = useAuth();
  const tenantId = useServiceTenantId()?.trim() ?? '';
  const { roleKey, permissions, can } = usePermissions();
  const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey) && can('office.invoices.view'));
  const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...new Set(permissions)].sort()]);
  return <ScreenShell title="Pflegekassen-Abrechnung" contentOwnsHeader><style>{gkvExchangeCss}</style>
    {!auth.authReady ? <section className="gx gx-empty" role="status">Zugang wird geprüft …</section> : !allowed || !roleKey ? <section className="gx gx-empty"><h1>Pflegekassen-Abrechnung</h1><p>Für diesen Bereich benötigen Sie einen Verwaltungszugang mit Zugriff auf Rechnungen.</p></section> : <WorkspaceContent key={scopeKey} tenantId={tenantId} roleKey={roleKey} canCreate={can('office.invoices.create')} />}
  </ScreenShell>;
}

function WorkspaceContent({ tenantId, roleKey, canCreate }: { tenantId: string; roleKey: RoleKey; canCreate: boolean }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [tab, setTab] = useState('pakete');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<ExchangeDraft | null>(null);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [base, setBase] = useState('');
  const [profile, setProfile] = useState<ExchangeProfile>(blankDraft().profile);
  const [profileBase, setProfileBase] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsError, setEventsError] = useState('');
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [revisionsMore, setRevisionsMore] = useState(false);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState('');
  const [revisionPreview, setRevisionPreview] = useState<SavedRevision | null>(null);
  const [copyReason, setCopyReason] = useState('');
  const copyNewId = useRef('');
  const [note, setNote] = useState('');
  const [sources, setSources] = useState<SourceInvoice[] | null>(null);
  const [files, setFiles] = useState<ExportFiles | null>(null);
  const [directory, setDirectory] = useState<CarrierDirectory | null>(null);
  const [carrierSearch, setCarrierSearch] = useState('');
  const [packetSearch, setPacketSearch] = useState('');
  const newId = useRef('');
  const mounted = useRef(true);
  const running = useRef(false);
  const retry = useRef<{ fingerprint: string; id: string } | null>(null);
  const dirty = Boolean(draft && JSON.stringify(draft) !== base);
  const profileDirty = Boolean(profileBase && JSON.stringify(profile) !== profileBase);
  const leave = useGkvUnsavedChanges(dirty || profileDirty, Boolean(busy));
  const canEdit = canCreate && (!selected || editableStates.includes(selected.status));
  const issues = useMemo(() => draft ? validateDraft(draft) : [], [draft]);
  const errors = issues.filter(issue => issue.severity === 'error');
  const canExport = Boolean(canEdit && selected && !dirty && !errors.length && draft?.channel === 'classic' && draft.mode !== 'production');

  useEffect(() => {
    mounted.current = true;
    void readWorkspace(tenantId, roleKey).then(value => {
      if (!mounted.current) return;
      setWorkspace(value);
      const next = value.settings?.profile || blankDraft().profile;
      setProfile(next); setProfileBase(JSON.stringify(next));
    }).catch(reason => { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Die Abrechnung konnte nicht geladen werden.'); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [tenantId, roleKey]);
  useEffect(() => {
    let current = true; setEvents([]); setEventsError('');
    if (selected) void readEvents(tenantId, roleKey, selected.id).then(value => { if (current) setEvents(value); }).catch(() => { if (current) setEventsError('Das Protokoll konnte nicht geladen werden. Bitte aktualisieren.'); });
    return () => { current = false; };
  }, [tenantId, roleKey, selected?.id, selected?.revision]);
  useEffect(() => {
    let current = true; setRevisions([]); setRevisionsMore(false); setRevisionsError(''); setRevisionPreview(null); setCopyReason('');
    setRevisionsLoading(Boolean(selected));
    if (selected) void readRevisions(tenantId, roleKey, selected.id).then(page => { if (current) { setRevisions(page.rows); setRevisionsMore(page.hasMore); } })
      .catch(reason => { if (current) setRevisionsError(reason instanceof Error ? reason.message : 'Gespeicherte Stände konnten nicht geladen werden.'); })
      .finally(() => { if (current) setRevisionsLoading(false); });
    return () => { current = false; };
  }, [tenantId, roleKey, selected?.id, selected?.revision]);

  async function run(label: string, action: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(label); setError(''); setNotice('');
    try { await action(); } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : 'Die Aktion konnte nicht abgeschlossen werden.'); }
    finally { running.current = false; if (mounted.current) setBusy(''); }
  }
  async function write<T>(action: string, input: Record<string, unknown>): Promise<T> {
    if (!mounted.current) throw new Error('Der Abrechnungsbereich wurde verlassen.');
    const fingerprint = JSON.stringify([action, input]);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() };
    const result = await command<T>(tenantId, roleKey, action, input, retry.current.id);
    retry.current = null; return result;
  }
  function keepChanges() { return !dirty || window.confirm('Die Änderungen an diesem Paket sind noch nicht gespeichert. Trotzdem wechseln?'); }
  function openBatch(batch: Batch) {
    if (running.current || !keepChanges()) return;
    setSelected(batch); setDraft(structuredClone(batch.draft)); setBase(JSON.stringify(batch.draft)); setFiles(null); setSources(null); setNotice(''); setError(''); setNote(''); setTab('pakete');
  }
  function createDraft() {
    if (!canCreate || running.current || !keepChanges()) return;
    const value = blankDraft(); value.profile = structuredClone(workspace?.settings?.profile || profile);
    newId.current = crypto.randomUUID(); setSelected(null); setDraft(value); setBase(JSON.stringify(value)); setFiles(null); setSources(null); setNote(''); setTab('pakete');
  }
  function update(value: ExchangeDraft) { setDraft(value); setFiles(null); }
  function receive(batch: Batch) {
    if (!mounted.current) return;
    setSelected(batch); setDraft(structuredClone(batch.draft)); setBase(JSON.stringify(batch.draft));
    setWorkspace(previous => previous ? { ...previous, batches: [batch, ...previous.batches.filter(item => item.id !== batch.id)].slice(0, 100) } : previous);
  }
  async function loadRevisions(older = false) {
    if (!selected) return;
    await run('Gespeicherte Stände laden', async () => {
      try {
        const page = await readRevisions(tenantId, roleKey, selected.id, older ? revisions.at(-1)?.revision : undefined);
        if (mounted.current) { setRevisions(previous => older ? [...previous, ...page.rows.filter(row => !previous.some(p => p.revision === row.revision))] : page.rows); setRevisionsMore(page.hasMore); setRevisionsError(''); }
      } catch (reason) { if (mounted.current) setRevisionsError(reason instanceof Error ? reason.message : 'Gespeicherte Stände konnten nicht geladen werden.'); }
    });
  }
  async function inspectRevision(revision: number) {
    if (!selected) return;
    await run('Gespeicherten Stand laden', async () => {
      const value = await readRevision(tenantId, roleKey, selected.id, revision);
      if (mounted.current) { setRevisionPreview(value); setCopyReason(''); copyNewId.current = crypto.randomUUID(); }
    });
  }
  async function copyRevision() {
    if (!selected || !revisionPreview || !canCreate || !keepChanges()) return;
    await run('Neuen Prüfentwurf anlegen', async () => {
      const result = await write<Batch>('copy_revision', { batch_id: selected.id, expected_revision: selected.revision,
        source_revision: revisionPreview.revision, new_id: copyNewId.current, reason: copyReason.trim() });
      if (mounted.current) { receive(result); setFiles(null); setSources(null); setNote(''); setNotice('Neuer Prüfentwurf angelegt. Bitte Nachweise, Quellen und Dateinummern erneut prüfen.'); }
    });
  }
  async function refresh() {
    if (!keepChanges() || (profileDirty && !window.confirm('Profiländerungen verwerfen und neu laden?'))) return;
    await run('Aktualisieren', async () => {
      const value = await readWorkspace(tenantId, roleKey); if (!mounted.current) return;
      setWorkspace(value); setLoading(false);
      const next = value.settings?.profile || blankDraft().profile; setProfile(next); setProfileBase(JSON.stringify(next));
      if (selected) {
        const current = value.batches.find(item => item.id === selected.id) || await readBatch(tenantId, roleKey, selected.id);
        if (mounted.current) receive(current);
      }
      setFiles(null); setNotice('Daten wurden aktualisiert.');
    });
  }
  const packets = workspace?.batches.filter(batch => `${batch.draft.month} ${STATUS_LABELS[batch.status]} ${batch.draft.insuranceIk} ${SERVICE_TYPES[batch.draft.serviceType]}`.toLowerCase().includes(packetSearch.toLowerCase())) || [];
  const carriers = directory?.records.filter(item => !item.deleted && `${item.ik} ${item.name}`.toLowerCase().includes(carrierSearch.toLowerCase())) || [];
  return <section className="gx" data-testid="gkv-exchange-workspace" aria-busy={Boolean(busy) || loading}>
    <header className="gx-head"><div><p className="gx-eyebrow">Office · Datenaustausch nach § 105 SGB XI</p><h1>Pflegekassen-Abrechnung</h1><p>Abrechnungen vorbereiten, prüfen und als Prüfdatei bereitstellen.</p></div><div className="gx-actions"><button type="button" disabled={Boolean(busy)} onClick={() => { if (leave.confirmLeave()) router.push('/business/office/invoices' as never); }}>Rechnungen</button><button type="button" disabled={Boolean(busy) || loading} onClick={() => void refresh()}>Aktualisieren</button>{canCreate && <button type="button" className="gx-primary" disabled={Boolean(busy) || !workspace} onClick={createDraft}>Neues Paket</button>}</div></header>
    <div className="gx-notice"><strong>Prüfbetrieb · TA {GKV_SPEC.version}</strong> — Dateierstellung für das klassische Verfahren. Echtversand, KIM und automatische Kassenrückmeldungen sind noch nicht angeschlossen.</div>
    {error && <div className="gx-notice" data-tone="error" role="alert">{error}{!workspace && <div className="gx-actions"><button type="button" disabled={Boolean(busy)} onClick={() => void refresh()}>Erneut laden</button></div>}</div>}
    {notice && <div className="gx-notice" data-tone="success" role="status">{notice}</div>}
    {busy && <p className="gx-subtle" role="status">{busy} …</p>}
    <nav className="gx-tabs" aria-label="Pflegekassen-Abrechnung">{[['pakete','Abrechnungspakete'],['profil','Abrechnungsprofil'],['kostentraeger','Kostenträger'],['konnektor','Konnektorprüfung'],['freigabe','Versandvoraussetzungen']].map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} disabled={Boolean(busy)} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {loading ? <div className="gx-card gx-empty" role="status">Abrechnungspakete werden geladen …</div> : tab === 'pakete' ? <div className="gx-layout">
      <aside className="gx-card"><h2>Pakete <span className="gx-badge">{workspace?.batches.length || 0}</span></h2><label className="gx-field" style={{ marginTop: 15 }}><span>Pakete suchen</span><input value={packetSearch} onChange={e => setPacketSearch(e.target.value)} placeholder="Monat, Kasse oder Status" /></label><div className="gx-packets">{packets.map(batch => <button type="button" key={batch.id} aria-pressed={selected?.id === batch.id} disabled={Boolean(busy)} onClick={() => openBatch(batch)}><strong>{batch.draft.month} · {batch.draft.insuranceIk || 'Kasse offen'}</strong><span>{SERVICE_TYPES[batch.draft.serviceType]}</span><small>{STATUS_LABELS[batch.status]} · {batch.draft.cases.length} Fälle</small><small>{dateTime(batch.updated_at)}</small></button>)}{!packets.length && <p className="gx-empty">{packetSearch ? 'Keine passenden Pakete.' : 'Noch keine Abrechnungspakete vorhanden.'}</p>}</div><p className="gx-limit">Die 100 zuletzt geänderten Pakete.</p></aside>
      {!draft ? <div className="gx-card gx-empty"><h2>Abrechnung vorbereiten</h2><p>Wählen Sie ein vorhandenes Paket oder beginnen Sie mit einem neuen Paket.</p></div> : <div className="gx-stack">
        <div className="gx-card"><div className="gx-card-title"><h2>{selected ? 'Abrechnungspaket' : 'Neues Abrechnungspaket'}</h2><span className="gx-badge">{selected ? STATUS_LABELS[selected.status] : 'Noch nicht gespeichert'}</span></div>
          {selected?.origin_batch_id && <div className="gx-subtle"><p>Dieser Prüfentwurf basiert auf Stand {selected.origin_revision} eines früheren Pakets.</p><button type="button" disabled={Boolean(busy)} onClick={() => { if (!keepChanges()) return; void run('Ursprungspaket laden', async () => { const origin = await readBatch(tenantId, roleKey, selected.origin_batch_id!); if (mounted.current) { receive(origin); setFiles(null); setSources(null); setNote(''); } }); }}>Ursprungspaket öffnen</button></div>}
          <fieldset disabled={Boolean(busy) || !canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><div className="gx-grid">
            <Field label="Abrechnungsmonat" value={draft.month} type="month" onChange={month => { update({ ...draft, month }); setSources(null); }} />
            <Choice label="Leistungsart" value={draft.serviceType} onChange={serviceType => update({ ...draft, serviceType: serviceType as ServiceType })}>{Object.entries(SERVICE_TYPES).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</Choice>
            <Choice label="Verfahren" value={draft.channel} onChange={channel => update({ ...draft, channel: channel as ExchangeDraft['channel'] })}><option value="classic">Klassischer Datenaustausch</option><option value="kim">KIM (noch nicht angeschlossen)</option></Choice>
            <Choice label="Dateimodus" value={draft.mode} onChange={mode => update({ ...draft, mode: mode as ExchangeDraft['mode'] })}><option value="test">Testdaten · Kennzeichen 0</option><option value="trial">Erprobung · Kennzeichen 1</option><option value="production">Echtbetrieb (gesperrt)</option></Choice>
            <Field label="IK der Pflegekasse" value={draft.insuranceIk} maxLength={9} onChange={insuranceIk => update({ ...draft, insuranceIk })} />
            <Field label="IK des Kostenträgers" value={draft.payerIk} maxLength={9} onChange={payerIk => update({ ...draft, payerIk })} />
            <Field label="IK der entschlüsselnden Stelle" value={draft.receiverIk} maxLength={9} onChange={receiverIk => update({ ...draft, receiverIk })} />
            <Field label="IK des physikalischen Empfängers" value={draft.physicalReceiverIk} maxLength={9} onChange={physicalReceiverIk => update({ ...draft, physicalReceiverIk })} />
            <Field label="Dateifolge (1–99)" value={String(draft.sequence)} type="number" onChange={v => update({ ...draft, sequence: Number(v) })} />
            <Field label="Übertragungsnummer (0–999)" value={String(draft.transferNumber)} type="number" onChange={v => update({ ...draft, transferNumber: Number(v) })} />
            <Field label="Dateireferenz (1–99999)" value={String(draft.interchangeReference)} type="number" onChange={v => update({ ...draft, interchangeReference: Number(v) })} />
            <Field label="Korrekturstand (0–9)" value={String(draft.correction)} type="number" onChange={v => update({ ...draft, correction: Number(v) })} />
          </div><p className="gx-limit">Erstellzeitpunkt: {dateTime(draft.createdAt)} · Ein Paket enthält eine Leistungsart und einen Abrechnungsmonat. Nummern sind im Prüfbetrieb manuell zu koordinieren.</p>
          <details style={{ marginTop: 18 }}><summary>Leistungserbringer und Vertrag dieses Pakets</summary><div style={{ marginTop: 18 }}><ProfileEditor value={draft.profile} onChange={profile => update({ ...draft, profile })} /></div></details></fieldset>
        </div>
        <div className="gx-card"><div className="gx-card-title"><h2>Abrechnungsfälle <span className="gx-badge">{draft.cases.length}</span></h2><div className="gx-actions"><button type="button" disabled={Boolean(busy) || !canEdit || !isMonth(draft.month)} onClick={() => void run('Rechnungen laden', async () => { const values = await readInvoiceSources(tenantId, roleKey, draft.month); if (mounted.current) setSources(values); })}>Rechnung übernehmen</button><button type="button" disabled={Boolean(busy) || !canEdit || draft.cases.length >= 500} onClick={() => update({ ...draft, cases: [...draft.cases, blankCase(draft.month)] })}>Fall hinzufügen</button></div></div>
          {sources && <div className="gx-subtle"><strong>Rechnungen im gewählten Leistungsmonat</strong>{sources.map(source => <div className="gx-source" key={source.id}><span>{source.invoice_number || 'Ohne Nummer'} · {money(Math.round(Number(source.total_amount) * 100))}</span><button type="button" disabled={Boolean(busy) || draft.cases.some(c => c.sourceInvoiceId === source.id)} onClick={() => void run('Rechnung übernehmen', async () => { const item = await readInvoiceCase(tenantId, roleKey, source.id, draft.month, draft.serviceType); if (mounted.current) { update({ ...draft, cases: [...draft.cases, item] }); setSources(null); } })}>Übernehmen</button></div>)}{!sources.length && <p>Keine passenden Rechnungen gefunden.</p>}<p className="gx-limit">Bis zu 100 Rechnungen. Vertragsziffern, Pflegegrad und Leistungsnachweise sind anschließend zu prüfen.</p></div>}
          <fieldset disabled={Boolean(busy) || !canEdit} className="gx-stack" style={{ border: 0, padding: 0, margin: '15px 0 0', minWidth: 0 }}>{draft.cases.map((item, index) => <CaseEditor key={`${index}:${item.sourceInvoiceId || ''}`} value={item} index={index} serviceType={draft.serviceType} onReload={item.sourceInvoiceId ? () => { if (window.confirm('Quellrechnung erneut übernehmen? Die bisherigen GKV-Schlüssel dieses Falls müssen anschließend erneut geprüft und ergänzt werden.')) void run('Quellrechnung aktualisieren', async () => { const current = await readInvoiceCase(tenantId, roleKey, item.sourceInvoiceId!, draft.month, draft.serviceType); if (mounted.current) update({ ...draft, cases: draft.cases.map((c, i) => i === index ? { ...current, documentNumber: item.documentNumber } : c) }); }); } : undefined} onChange={next => update({ ...draft, cases: draft.cases.map((c, i) => i === index ? next : c) })} onRemove={() => { if (window.confirm('Diesen Fall aus dem Paket entfernen?')) update({ ...draft, cases: draft.cases.filter((_, i) => i !== index) }); }} />)}</fieldset>
          {!draft.cases.length && <p className="gx-empty">Fügen Sie einen Fall hinzu oder übernehmen Sie eine Rechnung.</p>}<div className="gx-total"><span>{draft.cases.length} Fälle</span><span className="gx-money">Gesamt {money(draft.cases.reduce((sum, item) => sum + item.grossCents, 0))}</span></div>
        </div>
        <div className="gx-card"><div className="gx-card-title"><h2>Datenprüfung</h2><span className="gx-badge" data-tone={errors.length ? 'warn' : 'ok'}>{errors.length ? `${errors.length} Angaben prüfen` : 'Lokale Prüfung ohne Fehler'}</span></div><p className="gx-muted">Diese Prüfung ersetzt die Prüfung durch die Annahmestelle nicht. Exportiert wird ausschließlich der gespeicherte Stand.</p>{issues.length > 0 && <ol className="gx-issues">{issues.slice(0, 100).map((issue, i) => <li key={`${issue.path}:${i}`}>{issue.path.startsWith('cases.') ? `Fall ${Number(issue.path.split('.')[1]) + 1}${issue.path.includes('.lines.') ? `, Leistung ${Number(issue.path.split('.')[3]) + 1}` : ''}: ` : ''}{issue.message}</li>)}</ol>}{issues.length > 100 && <p className="gx-limit">Weitere Meldungen erscheinen, sobald die ersten Angaben korrigiert wurden.</p>}</div>
        <div className="gx-sticky"><small>{dirty ? 'Ungespeicherte Änderungen' : selected ? `Gespeicherter Stand · Revision ${selected.revision}` : 'Entwurf noch nicht gespeichert'}</small><div className="gx-actions"><button type="button" disabled={Boolean(busy) || !canEdit} onClick={() => void run('Entwurf speichern', async () => { if (!hasDraftShape(draft)) throw new Error('Bitte ungültige Zahlen und Beträge vor dem Speichern korrigieren.'); const result = await write<Batch>('save', { id: selected?.id, new_id: newId.current, revision: selected?.revision, draft }); receive(result); if (mounted.current) setNotice('Entwurf wurde gespeichert.'); })}>Entwurf speichern</button><button type="button" className="gx-primary" disabled={Boolean(busy) || !canExport} onClick={() => void run('Prüfdatei erstellen', async () => { if (!selected) return; const result = await requestTestExport(tenantId, roleKey, selected); if (!mounted.current) return; const saved = await write<Batch>('export_note', { id: selected.id, revision: selected.revision, sha256: result.sha256 }); receive(saved); if (mounted.current) { setFiles(result); setNotice('Prüfdateien wurden erstellt. Es wurde nichts übermittelt.'); } })}>Prüfdatei erstellen</button></div></div>
        {files && <div className="gx-card"><h2>Prüfdateien herunterladen</h2><p className="gx-subtle" style={{ margin: '16px 0' }}>{files.note} Enthaltene personenbezogene Daten sind vertraulich zu behandeln.</p>{files.sourceReport && <p className="gx-subtle">Serverprüfung: {files.sourceReport.checkedInvoices} Rechnungen · {files.sourceReport.checkedItems} Positionen · {files.sourceReport.checkedServiceRecords} Leistungsdatensätze · {files.sourceReport.checkedPdfFiles} Original-PDFs mit passender Prüfsumme. Manuelle Fälle ohne Systemabgleich: {files.sourceReport.manualCases}.</p>}<div className="gx-actions"><button type="button" onClick={() => downloadBytes(files.name, Uint8Array.from(atob(files.dataBase64), c => c.charCodeAt(0)))}>Nutzdaten {files.name}</button><button type="button" onClick={() => downloadBytes(`${files.name}.AUF`, Uint8Array.from(atob(files.orderBase64), c => c.charCodeAt(0)))}>Auftragsdatei (.AUF)</button></div><p className="gx-limit gx-filename">SHA-256: {files.sha256}</p></div>}
        {selected && <RevisionHistory rows={revisions} hasMore={revisionsMore} pending={Boolean(busy) || revisionsLoading} error={revisionsError} preview={revisionPreview} reason={copyReason}
          canCopy={canCreate && ['draft','checked','blocked','exported_test','cancelled'].includes(selected.status) && Boolean(revisionPreview && ['test','trial'].includes(revisionPreview.draft.mode) && revisionPreview.draft.channel === 'classic')}
          onInspect={revision => void inspectRevision(revision)} onMore={() => void loadRevisions(true)} onRetry={() => void loadRevisions()} onClose={() => setRevisionPreview(null)} onReason={setCopyReason} onCopy={() => void copyRevision()} />}
        {selected && <div className="gx-card"><div className="gx-card-title"><h2>Verlauf und Rückmeldungen</h2>{canEdit && <button type="button" className="gx-danger" disabled={Boolean(busy)} onClick={() => { if (window.confirm('Dieses Paket verwerfen? Die ursprünglichen Rechnungen bleiben erhalten.')) void run('Paket verwerfen', async () => { const result = await write<Batch>('cancel', { id: selected.id, revision: selected.revision }); receive(result); setFiles(null); }); }}>Paket verwerfen</button>}</div>{eventsError && <p role="alert">{eventsError}</p>}{events.map(event => <div className="gx-event" key={event.id}><time>{dateTime(event.created_at)}</time><p><strong>{eventLabels[event.event_type] || event.event_type}</strong></p>{typeof event.details.text === 'string' && <p>{event.details.text}</p>}</div>)}{!events.length && !eventsError && <p className="gx-muted">Noch keine Protokolleinträge geladen.</p>}<p className="gx-limit">Die 100 neuesten Vermerke. Gespeicherte Paketstände sind darüber vollständig nachladbar.</p>{canCreate && <div className="gx-stack" style={{ marginTop: 18 }}><label className="gx-field"><span>Manueller Rückmeldungsvermerk</span><textarea value={note} maxLength={4000} disabled={Boolean(busy)} onChange={e => setNote(e.target.value)} placeholder="Prüfrückmeldung oder nächsten Bearbeitungsschritt dokumentieren" /></label><small>Ein Vermerk bestätigt weder Zustellung noch fachliche Annahme oder Zahlung.</small><button type="button" disabled={Boolean(busy) || note.trim().length < 3} onClick={() => void run('Rückmeldung speichern', async () => { await write('feedback_note', { id: selected.id, revision: selected.revision, text: note.trim() }); const values = await readEvents(tenantId, roleKey, selected.id); if (mounted.current) { setEvents(values); setNote(''); setNotice('Rückmeldungsvermerk wurde gespeichert.'); } })}>Vermerk speichern</button></div>}</div>}
      </div>}
    </div> : tab === 'profil' ? <section className="gx-card gx-stack"><div><h2>Abrechnungsprofil</h2><p className="gx-muted">Gespeicherte Angaben werden für neue Pakete verwendet. Bestehende Pakete behalten ihren Vertragsstand.</p></div><fieldset disabled={Boolean(busy) || !canCreate || !workspace} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><ProfileEditor value={profile} onChange={setProfile} /></fieldset><div className="gx-actions"><button type="button" className="gx-primary" disabled={Boolean(busy) || !canCreate || !workspace || !profileDirty} onClick={() => void run('Profil speichern', async () => { const result = await write<NonNullable<Workspace['settings']>>('profile', { profile, revision: workspace?.settings?.revision || 0 }); if (mounted.current) { setWorkspace(previous => previous ? { ...previous, settings: result } : previous); setProfileBase(JSON.stringify(profile)); setNotice('Abrechnungsprofil wurde gespeichert.'); } })}>Profil speichern</button>{profileDirty && <small>Ungespeicherte Änderungen</small>}</div></section>
    : tab === 'kostentraeger' ? <section className="gx-stack"><div className="gx-card"><div className="gx-card-title"><h2>Amtliches Kostenträgerverzeichnis</h2><a href={GKV_SPEC.source} target="_blank" rel="noreferrer">Aktuelle GKV-Dateien öffnen ↗</a></div><p className="gx-muted">Importieren Sie eine entpackte vollständige Kostenträgerdatei im EDIFACT-Format. Gültigkeit und Empfängerverweise werden beim Routing geprüft.</p><label className="gx-upload" style={{ marginTop: 16 }}><span>Datei importieren</span><input type="file" disabled={Boolean(busy) || !canCreate || !workspace} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; void run('Kostenträgerdatei importieren', async () => { if (file.size > 8_000_000) throw new Error('Die Kostenträgerdatei darf höchstens 8 MB groß sein.'); const source = decodeLatin1(new Uint8Array(await file.arrayBuffer())); const parsed = parseCarrierDirectory(source, file.name); await write('directory', { filename: file.name, source }); const value = await readWorkspace(tenantId, roleKey); if (mounted.current) { setWorkspace(value); setDirectory(parsed); setNotice(`${parsed.records.length} Institutionen wurden importiert.`); } }); }} /></label><div style={{ marginTop: 16 }}>{workspace?.directories.map(item => <div className="gx-source" key={item.id}><span className="gx-filename">{item.filename} · {dateTime(item.imported_at)}</span><button type="button" disabled={Boolean(busy)} onClick={() => void run('Kostenträger laden', async () => { const row = await readDirectory(tenantId, roleKey, item.id); const parsed = parseCarrierDirectory(row.source_text, row.filename, row.imported_at); if (mounted.current) setDirectory(parsed); })}>Verzeichnis öffnen</button></div>)}{!workspace?.directories.length && <p className="gx-empty">Noch keine Kostenträgerdatei importiert.</p>}</div></div>{directory && <div className="gx-card gx-stack"><h2 className="gx-filename">{directory.fileName}</h2><Field label="Institution suchen" value={carrierSearch} onChange={setCarrierSearch} /><p className="gx-muted">{carriers.length} Treffer · Anzeige der ersten 50</p>{carriers.slice(0, 50).map(item => <div className="gx-source" key={item.ik}><span><strong>{item.ik}</strong> · {item.name}</span><button type="button" disabled={Boolean(busy) || !canEdit || !draft || !item.ik.startsWith('18')} onClick={() => { if (!draft) return; try { const route = resolveCarrierRoute(directory, { insuranceIk: item.ik, service: draft.serviceType, channel: draft.channel, day: billingDay(draft.createdAt), state: draft.profile.stateCode }); update({ ...draft, insuranceIk: item.ik, payerIk: route.payerIk, receiverIk: route.receiverIk, physicalReceiverIk: route.physicalReceiverIk }); setTab('pakete'); setNotice(`Empfänger aus ${route.sourceFile} übernommen. ${route.needsDirectoryLookup ? 'KIM-Adresse muss im TI-Verzeichnis aufgelöst werden.' : `Annahmeadresse: ${route.address}`}`); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Empfänger konnte nicht ermittelt werden.'); } }}>Für aktives Paket übernehmen</button></div>)}</div>}</section>
    : tab === 'konnektor' ? <KimHostPanel key={tenantId} tenantId={tenantId} roleKey={roleKey} canCheck={canCreate} />
    : <section className="gx-card gx-stack"><div><h2>Voraussetzungen für den Echtbetrieb</h2><p className="gx-muted">Diese Übersicht beschreibt noch erforderliche Anschlüsse und Freigaben. Sie ist keine Zertifizierung und lässt sich nicht durch Häkchen als erledigt markieren.</p></div><div className="gx-ready">{READINESS_REQUIREMENTS.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.detail}</p></article>)}</div><div className="gx-subtle"><strong>Aktuell verfügbar:</strong> Entwürfe, gespeicherte Paketstände mit Übernahme in einen neuen Prüfentwurf, Profilverwaltung, Rechnungsübernahme, Kostenträgerimport, lokale Fachprüfungen und unverschlüsselte Prüfdateien für freigegebene Selbstabrechnungsprofile. Zeit-, Punktwert- und Kilometerberechnung sowie einfache prozentuale und feste Zuschläge sind mit ausdrücklich gewählter Vertragsregel verfügbar. Pflegehilfsmittel mit Liefer-, Genehmigungs- und Steuerangaben sowie bewilligte Sonderleistungen sind als Prüfprofile verfügbar. Weitere Vertragsvarianten und verkettete Zuschlagsberechnungen bleiben offen.</div><a href={GKV_SPEC.source} target="_blank" rel="noreferrer">Technische Anlagen und Verfahrensunterlagen beim GKV-Spitzenverband ↗</a></section>}
  </section>;
}

export default GkvKassenabrechnungScreen;
