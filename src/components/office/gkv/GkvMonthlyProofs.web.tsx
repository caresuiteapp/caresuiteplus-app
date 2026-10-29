import { useEffect, useRef, useState } from 'react';
import type { RoleKey } from '@/types';
import { SERVICE_TYPES, isMonth, type ServiceType } from '@/lib/gkvExchange/model';
import { type MonthlyProof, type MonthlyProofCommand } from '@/lib/gkvExchange/monthlyProof';
import { MonthlyProofWriter } from '@/lib/gkvExchange/monthlyWriter';
import {GkvMonthlySignature} from './GkvMonthlySignature.web';
import type {MonthlyOriginalReceipt} from '@/lib/gkvExchange/monthlyOriginalContract';
import { MONTHLY_STATUS, monthlyDifferences, type MonthlyClient, type MonthlySource, type MonthlyWorkspace } from '@/lib/gkvExchange/monthlyWorkspace';
import { checkMonthlyRequest, commandMonthlyProof, listMonthlyClients, listMonthlySources, listMonthlyEvents, loadMonthlyProof,
  loadMonthlyWorkspace, readMonthlyProofHistory, type MonthlyEvent } from '@/lib/gkvExchange/repository.web';

export type MonthlyWorkState = {dirty: boolean; busy: boolean};
type Props = {tenantId: string; roleKey: RoleKey; canCreate: boolean; onWorkState: (state: MonthlyWorkState) => void};
const day = (value: string) => new Date(value + 'T12:00:00Z').toLocaleDateString('de-DE', {timeZone: 'Europe/Berlin'});
const time = (value: string) => new Date(value).toLocaleString('de-DE', {timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short'});
const idsKey = (ids: string[]) => [...ids].sort().join(',');
const currentMonth = () => {
  const parts = new Intl.DateTimeFormat('en', {timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit'}).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}`;
};
const eventLabels: Record<string, string> = {create: 'Monatsnachweis angelegt', replace_sources: 'Quellen mit Begründung abgeglichen',
  finalize_missing: 'Ausnahme ohne Unterschrift dokumentiert', confirm: 'Monatsnachweis bestätigt', correct: 'Korrekturfassung angelegt', invalidate_for_correction: 'Vorgänger für Korrektur entwertet'};

export function GkvMonthlyProofs(props: Props) {
  return <MonthlyWorkspacePanel key={`${props.tenantId}:${props.roleKey}:${props.canCreate}`} {...props} />;
}
function MonthlyWorkspacePanel({tenantId, roleKey, canCreate, onWorkState}: Props) {
  const [month, setMonth] = useState(currentMonth), [monthInput, setMonthInput] = useState(currentMonth);
  const [search, setSearch] = useState(''), [appliedSearch, setAppliedSearch] = useState('');
  const [clients, setClients] = useState<MonthlyClient[]>([]), [clientCursor, setClientCursor] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [workspace, setWorkspace] = useState<MonthlyWorkspace | null>(null);
  const [sources, setSources] = useState<MonthlySource[]>([]), [sourceCursor, setSourceCursor] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>('01');
  const [proof, setProof] = useState<MonthlyProof | null>(null), [history, setHistory] = useState<MonthlyProof[]>([]);
  const [historyMore, setHistoryMore] = useState(false), [comparison, setComparison] = useState<MonthlyProof | null>(null);
  const [events, setEvents] = useState<MonthlyEvent[]>([]), [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<'missing' | 'correct' | null>(null), [reason, setReason] = useState(''), [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [captureWork,setCaptureWork]=useState<MonthlyWorkState>({dirty:false,busy:false});
  const mounted = useRef(true), running = useRef(false), operation = useRef(0);
  const scope = useRef(0);
  const workCallback = useRef(onWorkState); workCallback.current = onWorkState;
  const [writer] = useState(() => new MonthlyProofWriter({
    execute: (command, requestId) => commandMonthlyProof(tenantId, roleKey, command, requestId),
    status: requestId => checkMonthlyRequest(tenantId, roleKey, requestId),
  }, () => crypto.randomUUID()));
  const sourceChanged = idsKey(selectedIds) !== idsKey(proof?.payload.records.map(r => r.recordId) || []);
  const dirty = sourceChanged || !!reason.trim() || !!writer.pending || captureWork.dirty;
  const locked = !!busy || !!writer.pending || captureWork.dirty || captureWork.busy;
  const writable = canCreate && workspace?.canWrite === true;
  const editable = writable && (!proof || proof.status === 'open') && !locked && !mode;
  const storedSources = proof?.payload.records.filter(record => !sources.some(source => source.id === record.recordId)) || [];
  const differences = proof && comparison ? monthlyDifferences(comparison, proof) : [];

  const unresolved = !!writer.pending;
  useEffect(() => { workCallback.current({dirty, busy: !!busy || unresolved || captureWork.busy}); }, [dirty, busy, unresolved, captureWork.busy]);
  useEffect(() => {
    mounted.current = true;
    void run('Klienten laden', () => loadClients(currentMonth(), '', false));
    return () => { mounted.current = false; scope.current++; operation.current++; running.current = false; workCallback.current({dirty: false, busy: false}); };
  }, []);
  function current(ticket: number) { return mounted.current && ticket === scope.current; }
  async function run(label: string, action: () => Promise<void>) {
    if (running.current) return;
    const ticket = ++operation.current;
    running.current = true; setBusy(label); setError(''); setNotice('');
    try { await action(); }
    catch (e) { if (mounted.current && ticket === operation.current) setError(e instanceof Error ? e.message : 'Die Monatsnachweise konnten nicht geladen werden.'); }
    finally { if (ticket === operation.current) { running.current = false; if (mounted.current) setBusy(''); } }
  }
  function mayChangeSelection() {
    if (locked || running.current) return false;
    return !dirty || window.confirm('Ungespeicherte Änderungen am Monatsnachweis verwerfen und die Auswahl wechseln?');
  }
  function resetDetail() {
    setProof(null); setHistory([]); setComparison(null); setEvents([]); setHistoryMore(false);
    setSelectedIds([]); setMode(null); setReason(''); setReviewed(false);
  }
  async function loadClients(nextMonth: string, query: string, older: boolean) {
    const ticket = ++scope.current;
    const page = await listMonthlyClients(tenantId, roleKey, nextMonth, query, older ? clientCursor : null);
    if (!current(ticket)) return;
    setClients(previous => older ? [...previous, ...page.items.filter(i => !previous.some(p => p.id === i.id))] : page.items);
    setClientCursor(page.nextCursor); setMonth(nextMonth); setAppliedSearch(query);
    if (!older) { setClientId(''); setWorkspace(null); setSources([]); setSourceCursor(null); resetDetail(); }
  }
  async function loadClient(id: string) {
    const ticket = ++scope.current;
    setWorkspace(null); setSources([]); setSourceCursor(null); resetDetail(); setClientId(id);
    if (!id) return;
    const [ws, page] = await Promise.all([loadMonthlyWorkspace(tenantId, roleKey, id, month), listMonthlySources(tenantId, roleKey, id, month)]);
    if (!current(ticket)) return;
    setWorkspace(ws); setSources(page.items); setSourceCursor(page.nextCursor); setServiceType('01');
    await chooseType('01', ws, ticket);
  }
  async function chooseType(type: ServiceType, ws = workspace, ticket = ++scope.current) {
    resetDetail(); setServiceType(type);
    const summary = ws?.proofs.find(p => p.serviceType === type);
    if (!summary) return;
    const [p, past, log] = await Promise.all([loadMonthlyProof(tenantId, roleKey, summary.id),
      readMonthlyProofHistory(tenantId, roleKey, summary.seriesId), listMonthlyEvents(tenantId, roleKey, summary.id)]);
    if (!current(ticket)) return;
    if (p.series_id !== summary.seriesId || p.payload.clientId !== ws?.clientId || p.payload.month !== month || p.payload.serviceType !== type) throw new Error('Die Fassung gehört nicht zur gewählten Leistungsart.');
    for (const prior of past.rows) monthlyDifferences(prior, p);
    setProof(p); setSelectedIds(p.payload.records.map(r => r.recordId)); setHistory(past.rows); setHistoryMore(past.hasMore); setEvents(log);
    setComparison(past.rows.find(r => r.id === p.predecessor_id) || null);
  }
  async function refresh() {
    if (!mayChangeSelection()) return;
    await run('Monatsnachweise aktualisieren', async () => {
      if (!clientId) { await loadClients(month, appliedSearch, false); return; }
      const ticket = ++scope.current;
      const [ws, page] = await Promise.all([loadMonthlyWorkspace(tenantId, roleKey, clientId, month), listMonthlySources(tenantId, roleKey, clientId, month)]);
      if (!current(ticket)) return;
      setWorkspace(ws); setSources(page.items); setSourceCursor(page.nextCursor); await chooseType(serviceType, ws, ticket);
    });
  }
  async function accept(p: MonthlyProof) {
    if (!mounted.current) return;
    setProof(p); setSelectedIds(p.payload.records.map(r => r.recordId)); setMode(null); setReason(''); setReviewed(false);
    setNotice(p.status === 'invalidated' ? 'Der Auftrag wurde gespeichert. Diese Fassung wurde inzwischen durch eine Korrektur ungültig.' : 'Der Monatsnachweis wurde gespeichert.');
    const ticket = ++scope.current;
    const [ws, past, log, page] = await Promise.all([loadMonthlyWorkspace(tenantId, roleKey, clientId, month),
      readMonthlyProofHistory(tenantId, roleKey, p.series_id), listMonthlyEvents(tenantId, roleKey, p.id), listMonthlySources(tenantId, roleKey, clientId, month)]);
    if (!current(ticket)) return;
    for (const prior of past.rows) monthlyDifferences(prior, p);
    setWorkspace(ws); setHistory(past.rows); setHistoryMore(past.hasMore); setEvents(log); setSources(page.items); setSourceCursor(page.nextCursor);
    setComparison(past.rows.find(r => r.id === p.predecessor_id) || null);
  }
  async function write(command: MonthlyProofCommand) {
    if (!writable || locked) return;
    await run('Monatsnachweis speichern', async () => { await accept(await writer.submit(command)); });
  }
  async function confirmSignature(receipt:MonthlyOriginalReceipt){
    if(!proof || !writable || busy || writer.pending || sourceChanged || receipt.tenantId!==tenantId || receipt.proofId!==proof.id
      || receipt.revision!==proof.revision || receipt.contentSha256!==proof.content_sha256)return;
    await run('Monatsbestätigung speichern',async()=>{await accept(await writer.submit({action:'confirm',input:{id:proof.id,revision:proof.revision,
      content_sha256:proof.content_sha256,receipt_id:receipt.receiptId}}));});
  }
  function saveSources() {
    if (!workspace || !selectedIds.length || selectedIds.length > 500) return;
    if (proof) void write({action: 'replace_sources', input: {id: proof.id, revision: proof.revision, source_ids: selectedIds, reason: reason.trim()}});
    else void write({action: 'create', input: {new_id: crypto.randomUUID(), client_id: clientId, month, service_type: serviceType, source_ids: selectedIds}});
  }
  function finish() {
    if (!proof || !reviewed || reason.trim().length < 3) return;
    if (mode === 'correct') void write({action: 'correct', input: {id: proof.id, revision: proof.revision, new_id: crypto.randomUUID(), reason: reason.trim()}});
    else if (mode === 'missing' && !sourceChanged) void write({action: 'finalize_missing', input: {id: proof.id, revision: proof.revision, content_sha256: proof.content_sha256, reason: reason.trim()}});
  }

  return <section className="gx-stack gx-monthly" aria-label="Monatsnachweise" aria-busy={!!busy}>
    <div className="gx-card gx-stack">
      <div className="gx-card-title"><div><p className="gx-eyebrow">Leistungsnachweise</p><h2>Monat für Monat nachvollziehbar</h2></div><button type="button" disabled={locked} onClick={() => void refresh()}>Monatsnachweise aktualisieren</button></div>
      <p className="gx-muted">Leistungen je Klient und Leistungsart zusammenstellen. Endgültige Fassungen bleiben erhalten, spätere Änderungen beginnen mit einer Korrektur.</p>
      <form className="gx-monthly-filter" onSubmit={e => { e.preventDefault(); if (isMonth(monthInput) && mayChangeSelection()) void run('Klienten laden', () => loadClients(monthInput, search, false)); }}>
        <label className="gx-field"><span>Leistungsmonat</span><input type="month" value={monthInput} disabled={locked} onChange={e => setMonthInput(e.target.value)} required /></label>
        <label className="gx-field"><span>Klient suchen</span><input value={search} maxLength={100} disabled={locked} placeholder="Vor- oder Nachname" onChange={e => setSearch(e.target.value)} /></label>
        <button type="submit" disabled={locked || !isMonth(monthInput)}>Auswahl laden</button>
      </form>
      <div className="gx-monthly-client"><label className="gx-field"><span>Klient mit Leistungen im Monat {month}</span><select disabled={locked || !clients.length} value={clientId} onChange={e => { const id = e.target.value; if (mayChangeSelection()) void run('Monatsnachweise laden', () => loadClient(id)); }}><option value="">Klient auswählen</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {clientCursor && <button type="button" disabled={locked} onClick={() => void run('Weitere Klienten laden', () => loadClients(month, appliedSearch, true))}>Weitere Klienten laden</button>}</div>
      {!clients.length && !busy && !error && <p className="gx-muted" role="status">Für diese Auswahl liegen noch keine freigegebenen Leistungen oder Monatsnachweise vor.</p>}
    </div>
    {busy && <p className="gx-notice" role="status">{busy} …</p>}
    {error && <div className="gx-notice" data-tone="error" role="alert">{error}</div>}
    {notice && <div className="gx-notice" data-tone="success" role="status">{notice}</div>}
    {writer.pending && !busy && <div className="gx-card gx-stack" role="alert"><h3>Ergebnis der Speicherung noch offen</h3><p>Die Antwort konnte nicht sicher zugeordnet werden. Prüfen Sie zuerst den gespeicherten Auftrag. Auswahl und Angaben bleiben bis zur Klärung gesperrt.</p><div className="gx-actions">
      <button type="button" onClick={() => void run('Speicherauftrag prüfen', async () => { const result = await writer.check(); if (!mounted.current) return; if (result.state === 'applied') await accept(result.proof); else setNotice('Der Auftrag wurde noch nicht gefunden. Sie können denselben Auftrag unverändert erneut senden.'); })}>Speicherung klären</button>
      {writer.checkedNotFound && <button type="button" className="gx-primary" onClick={() => void run('Auftrag unverändert wiederholen', async () => { await accept(await writer.retry()); })}>Unverändert erneut senden</button>}
    </div></div>}
    {workspace && <>
      <div className="gx-card gx-stack"><div className="gx-card-title"><h2>{workspace.clientName} · {month}</h2><span className="gx-badge">{writable ? 'Fachlich beauftragt' : 'Nur Ansicht'}</span></div>
        {!writable && <p className="gx-muted">Änderungen benötigen eine aktive Beauftragung als verantwortliche Pflegefachperson oder Vertretung.</p>}
        <label className="gx-field"><span>Leistungsart des Monatsnachweises</span><select value={serviceType} disabled={locked} onChange={e => { const type = e.target.value as ServiceType; if (mayChangeSelection()) void run('Fassung laden', () => chooseType(type)); }}>{Object.entries(SERVICE_TYPES).map(([id, label]) => <option key={id} value={id}>{label}{workspace.proofs.some(p => p.serviceType === id) ? ' · Nachweis vorhanden' : ''}</option>)}</select></label>
        {proof ? <div className="gx-monthly-meta"><span className="gx-badge" data-tone={proof.status === 'open' ? undefined : 'warn'}>{MONTHLY_STATUS[proof.status]}</span><span>Fassung {proof.version} · Bearbeitungsstand {proof.revision}</span><span>{time(proof.updated_at)}</span></div> : <p className="gx-muted">Für diese Leistungsart wurde noch kein Monatsnachweis angelegt.</p>}
        <p className="gx-subtle">Vorhandene Einsatzunterschriften ersetzen die persönliche Monatsbestätigung nicht. Eine endgültige Fassung ist hier noch nicht für die elektronische Abrechnung freigegeben.</p>
      </div>
      {(!proof || proof.status === 'open') && <section className="gx-card gx-stack" aria-label="Leistungen auswählen">
        <div><h3>Leistungen zusammenstellen</h3><p className="gx-muted">Die Auswahl wird beim Speichern erneut an den Originalnachweisen geprüft. Ein vollständiger Einsatz kann nur einem Monatsnachweis zugeordnet werden.</p></div>
        <div className="gx-monthly-sources">{sources.map(source => {
          const assignedElsewhere = !!source.assignedSeriesId && source.assignedSeriesId !== proof?.series_id;
          return <label className="gx-monthly-source" key={source.id}><input type="checkbox" checked={selectedIds.includes(source.id)} disabled={!editable || assignedElsewhere} onChange={e => { const checked = e.target.checked; setSelectedIds(ids => checked ? [...new Set([...ids, source.id])] : ids.filter(id => id !== source.id)); }} />
            <span><strong>{day(source.serviceDate)} · {source.employeeName}</strong><span>{source.actualMinutes} Minuten</span><span>{source.description || 'Beschreibung wird beim Quellenabgleich geprüft.'}</span>{assignedElsewhere && <span className="gx-badge">Anderem Nachweis zugeordnet</span>}</span></label>;
        })}{storedSources.map(record => <label className="gx-monthly-source" key={record.recordId}><input type="checkbox" checked={selectedIds.includes(record.recordId)} disabled={!editable} onChange={e => { const checked = e.target.checked; setSelectedIds(ids => checked ? [...new Set([...ids, record.recordId])] : ids.filter(id => id !== record.recordId)); }} /><span><strong>{day(record.serviceDate)} · {record.employeeName}</strong><span>{record.description}</span><span className="gx-muted">Gespeicherte Quelle · noch nicht in der aktuellen Auswahl geladen. Beim Speichern wird ihre Gültigkeit erneut geprüft.</span></span></label>)}</div>
        {!sources.length && <p className="gx-muted">Keine übernehmbaren Einsatzquellen geladen.</p>}
        {sourceCursor && <button type="button" disabled={locked} onClick={() => void run('Weitere Leistungen laden', async () => { const ticket = scope.current; const page = await listMonthlySources(tenantId, roleKey, clientId, month, sourceCursor); if (current(ticket)) { setSources(previous => [...previous, ...page.items.filter(x => !previous.some(p => p.id === x.id))]); setSourceCursor(page.nextCursor); } })}>Weitere Leistungen laden</button>}
        <p className="gx-muted">{selectedIds.length} Leistungen ausgewählt{selectedIds.some(id => !sources.some(s => s.id === id)) ? ' · Bereits gespeicherte, hier noch nicht geladene Quellen bleiben ausgewählt.' : '.'}</p>
        {writable && <><label className="gx-field"><span>{proof ? 'Begründung für den Quellenabgleich' : 'Leistungen vor dem Anlegen prüfen'}</span>{proof ? <textarea disabled={locked || !!mode} value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} placeholder="Was wurde geändert und weshalb?" /> : <small>Die ausgewählten Einsätze müssen zur gewählten Leistungsart gehören. Die Zuordnung ersetzt keine Tarifprüfung.</small>}</label>
          <button type="button" className="gx-primary" disabled={!editable || !!mode || !selectedIds.length || selectedIds.length > 500 || (!!proof && reason.trim().length < 3)} onClick={saveSources}>{proof ? 'Quellen abgleichen und speichern' : 'Monatsnachweis anlegen'}</button></>}
      </section>}
      {proof && <>
        <GkvMonthlySignature proof={proof} roleKey={roleKey} canSign={writable && !sourceChanged && !mode && !reason.trim()}
          disabled={!!busy || !!writer.pending} onWorkState={setCaptureWork} onConfirm={confirmSignature}/>
        <MonthlyProofContent proof={proof} />
        {writable && proof.status !== 'invalidated' && <section className="gx-card gx-stack" aria-label="Fassung bearbeiten">
          {!mode ? <div className="gx-actions">{proof.status === 'final' ? <button type="button" disabled={locked} onClick={() => { setMode('correct'); setReason(''); setReviewed(false); }}>Korrektur beginnen</button>
            : <button type="button" disabled={locked || sourceChanged} onClick={() => { setMode('missing'); setReason(''); setReviewed(false); }}>Ausnahme ohne Unterschrift dokumentieren</button>}</div> : <>
            <h3>{mode === 'correct' ? 'Neue Korrekturfassung' : 'Begründetes Fehlen der Unterschrift'}</h3>
            <p>{mode === 'correct' ? 'Mit dem Anlegen wird die bisherige endgültige Fassung sofort ungültig. Ihre Daten bleiben archiviert. Die neue Fassung ist offen und muss erneut bestätigt werden.' : 'Dieser Abschluss gilt nur für einen dokumentierten Ausnahmefall. Eine Unterschrift, die noch im Klientenportal eingeholt werden soll, ist kein solcher Abschluss.'}</p>
            <label className="gx-field"><span>Begründung</span><textarea value={reason} maxLength={2000} disabled={locked} onChange={e => setReason(e.target.value)} /></label>
            <label className="gx-check"><input type="checkbox" checked={reviewed} disabled={locked} onChange={e => setReviewed(e.target.checked)} /><span>{mode === 'correct' ? 'Ich habe die Fassung geprüft und möchte sie für die Korrektur entwerten.' : 'Ich habe die Leistungen und die Begründung geprüft. Die Unterschrift wird nicht lediglich nachgeholt.'}</span></label>
            <div className="gx-actions"><button type="button" className="gx-primary" disabled={locked || !reviewed || reason.trim().length < 3} onClick={finish}>{mode === 'correct' ? 'Korrekturfassung anlegen' : 'Endgültig ohne Unterschrift abschließen'}</button><button type="button" disabled={locked} onClick={() => { setMode(null); setReason(''); setReviewed(false); }}>Abbrechen</button></div>
          </>}
        </section>}
        <section className="gx-card gx-stack" aria-label="Nachweisfassungen vergleichen"><div><h3>Fassungen und Änderungen</h3><p className="gx-muted">Frühere Fassungen bleiben unverändert einsehbar. Der Vergleich bezieht sich auf die aktuell angezeigte Fassung.</p></div>
          <div className="gx-actions">{history.map(p => <button type="button" disabled={locked} aria-pressed={comparison?.id === p.id} key={p.id} onClick={() => setComparison(p)}>Fassung {p.version} · {MONTHLY_STATUS[p.status]}</button>)}</div>
          {historyMore && <button type="button" disabled={locked} onClick={() => void run('Ältere Fassungen laden', async () => { const ticket = scope.current; const page = await readMonthlyProofHistory(tenantId, roleKey, proof.series_id, history.at(-1)?.version); if (current(ticket)) { setHistory(previous => [...previous, ...page.rows.filter(p => !previous.some(x => x.id === p.id))]); setHistoryMore(page.hasMore); } })}>Ältere Fassungen laden</button>}
          {comparison && <><div className="gx-card-title"><h3>Vergleich: Fassung {comparison.version} → {proof.version}</h3><button type="button" disabled={locked} onClick={() => setComparison(null)}>Vergleich schließen</button></div>
            {!differences.length ? <p className="gx-muted">Die übernommenen Leistungsdaten sind gleich. Status und Bestätigung können sich unterscheiden.</p> : <div className="gx-monthly-differences">{differences.map(d => <article key={d.key}><h4>{d.label}</h4><div><section><h5>Ausgewählte Fassung</h5><p>{d.before}</p></section><section><h5>Aktuelle Ansicht</h5><p>{d.after}</p></section></div></article>)}</div>}
            <details><summary>Ausgewählte Fassung vollständig ansehen</summary><MonthlyProofContent proof={comparison} />
              {comparison.id!==proof.id && <GkvMonthlySignature proof={comparison} roleKey={roleKey} canSign={false} disabled={locked} onWorkState={()=>{}} onConfirm={async()=>{}}/>}</details></>}
        </section>
        <section className="gx-card gx-stack" aria-label="Bearbeitungsprotokoll"><h3>Bearbeitungsprotokoll dieser Fassung</h3>{events.map(event => <article className="gx-event" key={event.id}><time>{time(event.created_at)}</time><p><strong>{eventLabels[event.action] || 'Bearbeitung dokumentiert'}</strong></p>{event.reason && <p>{event.reason}</p>}</article>)}{!events.length && <p className="gx-muted">Keine Protokolleinträge geladen.</p>}<p className="gx-limit">Die 30 neuesten Einträge dieser Fassung.</p></section>
      </>}
    </>}
  </section>;
}

export function MonthlyProofContent({proof}: {proof: MonthlyProof}) {
  return <section className="gx-card gx-stack gx-monthly-original" aria-label={`Gespeicherte Fassung ${proof.version}`}>
    <div className="gx-card-title"><h3>Gespeicherte Fassung {proof.version}</h3><span className="gx-badge">{MONTHLY_STATUS[proof.status]}</span></div>
    <p>{proof.payload.clientName} · {proof.payload.month} · {SERVICE_TYPES[proof.payload.serviceType]}</p>
    {proof.confirmation?.kind === 'missing_signature' && <div className="gx-subtle"><strong>Endgültig ohne Unterschrift</strong><p>{proof.confirmation.reason}</p></div>}
    {proof.confirmation?.kind === 'signature' && <div className="gx-subtle"><strong>Bestätigt durch {proof.confirmation.signerName}</strong><p>{proof.confirmation.signerRole === 'representative' ? 'Vertretung' : 'Pflegebedürftige Person'} · {time(proof.confirmation.capturedAt)}</p></div>}
    {proof.status === 'invalidated' && <p className="gx-notice" data-tone="error">Diese Fassung wurde durch eine Korrektur ungültig. Sie bleibt zur Nachvollziehbarkeit erhalten.</p>}
    <ol className="gx-monthly-records">{[...proof.payload.records].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || a.recordId.localeCompare(b.recordId)).map(record => <li key={record.recordId}>
      <div className="gx-card-title"><strong>{day(record.serviceDate)} · {record.employeeName}</strong><span>{record.actualMinutes} Minuten</span></div>
      <p>{record.description}</p>{record.tasks.length > 0 && <ul>{record.tasks.map((task, i) => <li key={`${task.id}:${i}`}><strong>{task.title}</strong> · {({done: 'Erbracht', open: 'Offen', not_done: 'Nicht erbracht', not_requested: 'Nicht gewünscht', cancelled: 'Abgesagt'} as Record<string, string>)[task.status] || task.status}{task.completionNote && <p>{task.completionNote}</p>}</li>)}</ul>}
    </li>)}</ol>
  </section>;
}
