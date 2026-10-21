import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { carePermissionOwner, carePermissionOwnerIsCurrent, sameCarePermissionOwner, type CarePermissionOwner } from '@/lib/permissions/carePermissionOwner.web';
import { isDemoMode } from '@/lib/supabase/config';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { controlHistory, type ControlSource } from '@/lib/pflege/clinicalControlDomain';
import { controlSourceLabels, controlStatusLabels } from '@/lib/pflege/clinicalControlForm';
import {
  assertHandoverClosable, assertHandoverSelectionCurrent, caseDocumentMimeTypes, caseEmergencyExcerpt, caseHandoverVersion,
  handoverTaskFollowUps, type CaseHandoverCommand, type CaseHandoverContext, type CaseHandoverState,
  type HandoverContent, type NativeRow, type ReviewedCaseDocument,
} from '@/lib/pflege/caseHandoverDomain.web';
import { CaseHandoverWorkflow, browserHandoverLock, type HandoverJournal } from '@/lib/pflege/caseHandoverWorkflow.web';
import { discardHandoverDraft, restoreHandoverDraft, saveHandoverDraft, type HandoverEditorDraft } from '@/lib/pflege/caseHandoverDraft.web';
import { caseHandoverRepository as repository } from '@/lib/pflege/caseHandoverRepository.supabase.web';
import type { HandoverAuthority } from '@/lib/pflege/caseHandoverRepository.web';
import type { PermissionKey } from '@/types/permissions';
import { woundInstant, woundUuid } from '@/lib/pflege/woundCareDomain';
import { colors, spacing } from '@/theme';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { SourcePicker } from './TreatmentSourcePicker.web';

type Mode = 'list' | 'new' | 'detail';
type Boundary = { owner: CarePermissionOwner | null; grants: readonly PermissionKey[]; number: number; canCurrent(): boolean };
const readRights: PermissionKey[] = ['office.clients.view', 'office.documents.view', 'pflege.handovers.view', 'pflege.documentation.view', 'pflege.treatment.view', 'pflege.orders.view', 'pflege.risks.view'];
const priorities = [{ key: 'normal', label: 'Normal' }, { key: 'important', label: 'Wichtig' }, { key: 'urgent', label: 'Dringend' }, { key: 'critical', label: 'Kritisch' }];
const priorityLabel = (p: string) => priorities.find(x => x.key === p)?.label ?? p;
const when = (s: string) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s));
const person = (r: NativeRow) => [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Name nicht hinterlegt';
const sourceKey = (r: ControlSource) => r.kind + ':' + r.id;
function sourceTitle(r: ControlSource) {
  const s = r.snapshot;
  const title = [s.title, s.summary, s.description, s.measurement_type, s.treatment_type, s.report_type].find(v => typeof v === 'string' && v.trim());
  return `${controlSourceLabels[r.kind] ?? 'Aktenbeleg'}${title ? ' · ' + String(title).slice(0, 180) : ''}`;
}
const rowText = (r: NativeRow, fields: string[]) => fields.map(k => r[k]).filter(v => typeof v === 'string' && v.trim()).join(' · ') || 'Keine weitere Angabe hinterlegt';
const toggle = (selected: string[], value: string) => selected.includes(value) ? selected.filter(x => x !== value) : [...selected, value];

/** Web-only routes and runtime scope. The native Android screens remain independent. */
export function CaseHandoverWorkspace({ mode = 'list', embedded = false }: { mode?: Mode; embedded?: boolean }) {
  const styles = useHandoverStyles();
  const auth = useAuth(), tenantId = useServiceTenantId(), permissions = useCareRuntimePermissions();
  const owner = carePermissionOwner(auth, tenantId, isDemoMode());
  const reference = useRef<Boundary | null>(null), mounted = useRef(true);
  if (!reference.current || !sameCarePermissionOwner(reference.current.owner, owner) || reference.current.grants !== permissions.permissions) {
    const captured = permissions.permissions;
    reference.current = { owner, grants: captured, number: (reference.current?.number ?? 0) + 1, canCurrent: () => permissions.canAll([...captured]) };
  }
  const boundary = reference.current;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const authority = useMemo<HandoverAuthority | null>(() => {
    if (!boundary.owner || boundary.owner.demo || !boundary.owner.accessToken || !readRights.every(k => boundary.grants.includes(k))) return null;
    const own = boundary.owner;
    return { tenantId: own.tenantId, actorId: own.profileId, accessToken: own.accessToken!, expiresAt: own.expiresAt,
      isCurrent: () => mounted.current && reference.current === boundary && carePermissionOwnerIsCurrent(own) && boundary.canCurrent() };
  }, [boundary]);
  const content = permissions.loading ? <LoadingState message="Aktuelle Zugriffsrechte werden geprüft…" /> : permissions.error ?
    <ErrorState message={permissions.error} onRetry={permissions.refreshPermissions} /> : !authority ?
      <InfoBanner variant="warning" message={owner?.demo ? 'Verbindliche Übergaben benötigen ein angemeldetes Betriebskonto mit aktuellen Aktenrechten.' : 'Die aktuellen Rechte für Pflegeakte, Dokumente, Aufträge und Übergaben sind nicht vollständig bestätigt.'} /> :
      <AuthorizedHandover key={boundary.number} authority={authority} mode={mode} canManage={boundary.grants.includes('pflege.handovers.manage')} canExport={boundary.grants.includes('documents.download')} />;
  return embedded ? <View style={styles.stack}>{content}</View> : <ScreenShell title="Fallübergaben" subtitle="Aktenbelege, Empfang und Versorgungsaufträge nachhalten">{content}</ScreenShell>;
}

function AuthorizedHandover({ authority, mode, canManage, canExport }: { authority: HandoverAuthority; mode: Mode; canManage: boolean; canExport: boolean }) {
  const styles = useHandoverStyles();
  const params = useLocalSearchParams(), [clients, setClients] = useState<NativeRow[] | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const routeClient = typeof params.clientId === 'string' && woundUuid(params.clientId) ? params.clientId : '';
  const routeId = typeof params.handoverId === 'string' && woundUuid(params.handoverId) ? params.handoverId : '';
  const [clientId, setClientId] = useState(routeClient);
  useEffect(() => {
    let active = true; setClients(null); setError('');
    void repository.clients(authority).then(r => { if (!active || !authority.isCurrent()) return; if (r.ok) setClients(r.data); else setError(r.error); });
    return () => { active = false; };
  }, [authority, revision]);
  if (params.clientId !== undefined && !routeClient || params.handoverId !== undefined && (!routeId || !routeClient) || mode === 'detail' && !routeId) return <ErrorState message="Der Übergabelink ist ungültig. Die Pflegeakte und Übergabe müssen eindeutig benannt sein." />;
  return <View style={styles.stack}>
    {!clients ? error ? <ErrorState message={error} onRetry={() => setRevision(n => n + 1)} /> : <LoadingState message="Zugängliche Pflegefälle werden vollständig geladen…" /> : <>
      <SectionPanel title="Pflegefall auswählen"><SourcePicker label="Pflegefall" rows={clients.map(r => ({ id: String(r.id), label: person(r) }))} value={clientId} onChange={setClientId} disabled={mode === 'detail'} />
        {!clients.length ? <Text style={styles.body}>Kein aktiver Pflegefall ist aktuell zugänglich.</Text> : null}
      </SectionPanel>
      {clientId && clients.some(c => c.id === clientId) ? <CaseWorkspace key={clientId} authority={authority} clientId={clientId} handoverId={routeId} mode={mode} canManage={canManage} canExport={canExport} /> : clientId ? <ErrorState message="Der verlinkte Pflegefall ist nicht im aktuellen zugänglichen Bestand enthalten." /> : <InfoBanner variant="info" message="Einen Pflegefall auswählen, um Übergaben, Notfallinformationen und offene Folgen zu laden." />}
    </>}
  </View>;
}

function CaseWorkspace({ authority, clientId, handoverId, mode, canManage, canExport }: { authority: HandoverAuthority; clientId: string; handoverId: string; mode: Mode; canManage: boolean; canExport: boolean }) {
  const styles = useHandoverStyles();
  const router = useRouter(), [loaded, setLoaded] = useState<{ context: CaseHandoverContext; rows: CaseHandoverState[] } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [reading, setReading] = useState(true), [loadRevision, setLoadRevision] = useState(0);
  const [journal, setJournal] = useState<HandoverJournal | null>(null), [journalError, setJournalError] = useState(''), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(handoverId), [editing, setEditing] = useState(mode === 'new');
  const alive = useRef(true), action = useRef(false), requestTicket = useRef(0);
  const workflow = useMemo(() => new CaseHandoverWorkflow({ tenantId: authority.tenantId, actorId: authority.actorId, clientId }, {
    storage: {
      getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value), removeItem: key => window.localStorage.removeItem(key),
    }, lock: browserHandoverLock, isCurrent: () => alive.current && authority.isCurrent(),
    commit: command => repository.commit(authority, command), confirm: command => repository.confirm(authority, command),
  }), [authority, clientId]);
  const current = () => alive.current && authority.isCurrent();
  const readJournal = () => {
    try { setJournal(workflow.read()); setJournalError(''); }
    catch (e) { setJournalError(e instanceof Error ? e.message : 'Der gesicherte Vorgang konnte nicht gelesen werden. Neue Übertragung bleibt gesperrt.'); }
  };
  useEffect(() => {
    alive.current = true; readJournal();
    const storage = (e: StorageEvent) => { if (e.key?.startsWith('caresuite.case-handover.v1:')) readJournal(); };
    window.addEventListener('storage', storage);
    return () => { alive.current = false; requestTicket.current++; window.removeEventListener('storage', storage); };
  }, [workflow]);
  useEffect(() => {
    const ticket = ++requestTicket.current; setReading(true); setError('');
    void Promise.all([repository.context(authority, clientId), repository.list(authority, clientId)]).then(([context, rows]) => {
      if (!current() || requestTicket.current !== ticket) return;
      if (!context.ok || !rows.ok) { setError(!context.ok ? context.error : !rows.ok ? rows.error : 'Der vollständige Bestand fehlt.'); return; }
      setLoaded({ context: context.data, rows: rows.data });
      setReading(false);
    });
  }, [authority, clientId, loadRevision]);
  const locked = busy || reading || !!journal || !!journalError;
  async function run(operation: () => Promise<void>) {
    if (action.current || !current()) return;
    action.current = true; setBusy(true); setError('');
    try { await operation(); }
    catch (e) { if (current()) setError(e instanceof Error ? e.message : 'Der Vorgang konnte nicht bestätigt werden.'); }
    finally { action.current = false; if (current()) { setBusy(false); readJournal(); } }
  }
  async function send(command: CaseHandoverCommand) {
    await run(async () => {
      if (!canManage || !current() || workflow.read()) throw Error('Neue Übertragung ist derzeit gesperrt.');
      const result = await workflow.dispatch(command);
      if (!current()) return;
      if (!result.ok) throw Error(result.error);
      if (command.kind === 'publish') discardHandoverDraft(window.sessionStorage, { tenantId: authority.tenantId, actorId: authority.actorId, clientId }, command.expectedHeadId);
      setNotice(command.kind === 'acknowledge' ? 'Ihr Empfang dieser Fassung ist bestätigt gespeichert. Versorgungsaufträge behalten ihren eigenen Status.' : command.kind === 'close' ? 'Die Kommunikation dieser Übergabe ist bestätigt geschlossen. Die Originalaufträge bleiben unverändert.' : 'Die neue Übergabefassung ist bestätigt gespeichert. Der Empfang durch die adressierten Personen steht noch aus.');
      setSelected(command.handoverId); setEditing(false); setLoadRevision(n => n + 1);
    });
  }
  const base = (kind: CaseHandoverCommand['kind'], id: string, head: string | null) => ({ version: caseHandoverVersion, kind, requestId: crypto.randomUUID(), eventId: crypto.randomUUID(), tenantId: authority.tenantId, clientId, actorId: authority.actorId, handoverId: id, expectedHeadId: head });
  const detail = loaded?.rows.find(r => r.head.handoverId === selected) ?? null;
  const recover = journal ? <SectionPanel title="Gesicherter Übergabevorgang">
    <Text style={styles.body}>{journal.phase === 'dispatched' ? 'Die Speicherantwort ist unklar. Die ursprüngliche Anfrage bleibt auf diesem Gerät gesichert. Ein fehlender Lesetreffer beweist keine Ablehnung.' : journal.phase === 'confirmed' ? 'Die native Quittung ist gesichert. Vor einer weiteren Aktion den Originalbeleg im neu geladenen Verlauf abgleichen.' : journal.phase === 'rejected' ? journal.rejection : 'Die Anfrage wurde vor der Übertragung gesichert und noch nicht gesendet.'}</Text>
    {journal.phase === 'dispatched' ? <PremiumButton title="Gespeicherten Vorgang ausschließlich prüfen" loading={busy} disabled={busy} onPress={() => void run(async () => { const r = await workflow.confirm(); if (!r.ok) throw Error(r.error); if (current()) { setSelected(r.data.command.handoverId); setEditing(false); setLoadRevision(n => n + 1); } })} /> : null}
    {journal.phase === 'confirmed' ? <PremiumButton title="Bestätigung mit Originalverlauf abgleichen" loading={busy} disabled={busy || !loaded} onPress={() => void run(async () => {
      const original = await repository.history(authority, clientId, journal.command.handoverId);
      if (!original.ok || !current()) throw Error('Der bestätigte Originalverlauf konnte noch nicht abgeglichen werden.');
      await workflow.releaseConfirmed(original.data.events); if (current()) setLoadRevision(n => n + 1);
    })} /> : null}
    {journal.phase === 'prepared' || journal.phase === 'rejected' ? <PremiumButton title="Abgewiesenen oder ungesendeten Vorgang freigeben" variant="secondary" disabled={busy} onPress={() => void run(() => workflow.discardUnsentOrRejected())} /> : null}
  </SectionPanel> : null;
  return <View style={styles.stack}>
    {journalError ? <ErrorState message={journalError} /> : null}{recover}
    {error ? <ErrorState message={error} onRetry={busy ? undefined : () => setLoadRevision(n => n + 1)} /> : null}
    {notice ? <SuccessState message={notice} /> : null}
    {!loaded ? !error ? <LoadingState message="Aktuelle Aktenbelege, Personen, Aufträge und Übergabeverläufe werden geladen…" /> : null : <>
      <View style={styles.actions}><PremiumButton title="Pflegeakte öffnen" variant="secondary" disabled={busy} onPress={() => { if (current()) router.push(clientRecordRoute(clientId) as never); }} />
        <PremiumButton title="Aktuellen Bestand neu laden" variant="secondary" disabled={busy} onPress={() => setLoadRevision(n => n + 1)} />
        {canManage && !editing ? <PremiumButton title="Neue Fallübergabe" disabled={locked} onPress={() => { setSelected(''); setEditing(true); setNotice(''); }} /> : null}
      </View>
      {reading ? <LoadingState message="Aktueller Bestand wird erneut geprüft. Neue Übertragung bleibt bis zur vollständigen Antwort gesperrt…" /> : null}
      <InfoBanner variant="info" message="Diese Übersicht führt die neuen Web-Fallübergaben. Frühere Übergaben bleiben in ihren bisherigen Verläufen; ihre Empfangsangaben gelten nicht als Bestätigung einer neuen Fassung." />
      {editing ? canManage ? <HandoverEditor key={detail?.head.id ?? 'new'} context={loaded.context} previous={detail} disabled={locked} isCurrent={current} onSave={(content, reason) => {
        try { assertHandoverSelectionCurrent(content, loaded.context); const command = { ...base('publish', detail?.head.handoverId ?? crypto.randomUUID(), detail?.head.id ?? null), kind: 'publish' as const, content, reason }; void send(command); }
        catch (e) { setError(e instanceof Error ? e.message : 'Auswahl prüfen.'); }
      }} onCancel={() => setEditing(false)} /> : <InfoBanner variant="warning" message="Für neue Übergaben fehlt das aktuelle Bearbeitungsrecht." /> : <>
        <HandoverList rows={loaded.rows} actorId={authority.actorId} value={selected} disabled={busy} onSelect={id => { setSelected(id); setNotice(''); }} />
        {detail ? <HandoverDetail key={detail.head.id} state={detail} context={loaded.context} actorId={authority.actorId} disabled={locked} canManage={canManage} canExport={canExport}
          onAcknowledge={statement => void send({ ...base('acknowledge', detail.head.handoverId, detail.head.id), kind: 'acknowledge', statement })}
          onClose={statement => { try { const taskSnapshots = loaded.context.controls.filter(r => detail.head.command.content.tasks.some(t => t.task.id === r.task.id)); assertHandoverClosable(detail, taskSnapshots); void send({ ...base('close', detail.head.handoverId, detail.head.id), kind: 'close', statement, taskSnapshots }); } catch (e) { setError(e instanceof Error ? e.message : 'Abschluss prüfen.'); } }}
          onRevise={() => { if (current()) setEditing(true); }} isCurrent={current} /> : selected ? <ErrorState message="Diese Übergabe ist nicht im vollständig zugänglichen Verlauf enthalten." /> : null}
      </>}
    </>}
  </View>;
}

function HandoverList({ rows, actorId, value, disabled, onSelect }: { rows: CaseHandoverState[]; actorId: string; value: string; disabled: boolean; onSelect(id: string): void }) {
  const styles = useHandoverStyles();
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState(''), [count, setCount] = useState(20);
  const filtered = rows.filter(r => (filter === 'all' || filter === 'mine' && r.pendingRecipients.some(p => p.id === actorId) || filter === 'open' && !r.closure || filter === 'closed' && !!r.closure) && (r.head.command.content.title + ' ' + r.head.command.content.summary).toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
  return <SectionPanel title="Übergaben und ausstehender Empfang">
    <PremiumInput label="Übergaben suchen" value={search} onChangeText={v => { setSearch(v); setCount(20); }} />
    <FilterChipGroup wrap options={[{ key: 'all', label: 'Alle' }, { key: 'mine', label: 'Mein Empfang offen' }, { key: 'open', label: 'Kommunikation offen' }, { key: 'closed', label: 'Kommunikation geschlossen' }]} value={filter} onChange={v => { setFilter(v); setCount(20); }} />
    {!filtered.length ? <Text style={styles.body}>Keine Übergabe für diese Auswahl vorhanden.</Text> : null}
    {filtered.slice(0, count).map(r => <View key={r.head.handoverId} style={[styles.item, value === r.head.handoverId && styles.selected]}>
      <Text style={styles.heading}>{r.head.command.content.title}</Text><Text style={styles.body}>{priorityLabel(r.head.command.content.priority)} · Fassung {r.revision} · {when(r.head.recordedAt)}</Text>
      <Text style={styles.body}>{r.closure ? 'Kommunikation geschlossen' : `${r.pendingRecipients.length} von ${r.head.command.content.recipients.length} Empfangsbestätigungen offen`}</Text>
      <PremiumButton title={value === r.head.handoverId ? 'Ausgewählte Übergabe' : 'Übergabe und offene Folgen öffnen'} variant="secondary" disabled={disabled} onPress={() => onSelect(r.head.handoverId)} />
    </View>)}
    {count < filtered.length ? <PremiumButton title="Weitere Übergaben anzeigen" variant="secondary" onPress={() => setCount(n => n + 20)} /> : null}
  </SectionPanel>;
}

function MultiSelect({ label, rows, selected, disabled, onChange }: { label: string; rows: { id: string; label: string }[]; selected: string[]; disabled: boolean; onChange(value: string[]): void }) {
  const styles = useHandoverStyles();
  return <View style={styles.stack}><SourcePicker label={label} rows={rows.map(r => ({ ...r, label: (selected.includes(r.id) ? '✓ ' : '') + r.label }))} value="" onChange={id => onChange(toggle(selected, id))} disabled={disabled} />
    <Text style={styles.caption}>{selected.length} ausgewählt. Eine ausgewählte Zeile erneut wählen, um sie zu entfernen.</Text></View>;
}

function HandoverEditor({ context, previous, disabled, isCurrent, onSave, onCancel }: { context: CaseHandoverContext; previous: CaseHandoverState | null; disabled: boolean; isCurrent(): boolean; onSave(content: HandoverContent, reason: string): void; onCancel(): void }) {
  const styles = useHandoverStyles();
  const router = useRouter();
  const old = previous?.head.command.content;
  const draftScope = { tenantId: context.tenantId, clientId: context.clientId, actorId: context.actorId }, previousHead = previous?.head.id ?? null;
  const [restored] = useState(() => { try { return { value: restoreHandoverDraft(window.sessionStorage, draftScope, previousHead, context), error: '' }; } catch (e) { return { value: null, error: e instanceof Error ? e.message : 'Der Entwurf konnte nicht gelesen werden.' }; } });
  const draft = restored.value?.draft.content;
  const [draftError, setDraftError] = useState(restored.error), [draftSaved, setDraftSaved] = useState(false);
  const [title, setTitle] = useState(draft?.title ?? old?.title ?? ''), [summary, setSummary] = useState(draft?.summary ?? old?.summary ?? ''), [priority, setPriority] = useState<HandoverContent['priority']>(draft?.priority ?? old?.priority ?? 'normal');
  const [reason, setReason] = useState(restored.value?.draft.reason ?? ''), [sourceIds, setSourceIds] = useState<string[]>(draft?.sources.map(sourceKey) ?? []), [taskIds, setTaskIds] = useState<string[]>(draft?.tasks.map(t => t.task.id) ?? []), [recipientIds, setRecipientIds] = useState<string[]>(draft?.recipients.map(p => p.id) ?? []);
  const [contactIds, setContactIds] = useState<string[]>(draft?.emergency.contacts.map(r => String(r.id)) ?? []), [riskIds, setRiskIds] = useState<string[]>(draft?.emergency.risks.map(r => String(r.id)) ?? []), [planIds, setPlanIds] = useState<string[]>(draft?.emergency.plans.map(sourceKey) ?? []);
  const [accessNote, setAccessNote] = useState(draft?.emergency.accessNote ?? old?.emergency.accessNote ?? ''), [limitations, setLimitations] = useState(draft?.emergency.limitations ?? old?.emergency.limitations ?? ''), [reviewed, setReviewed] = useState(false);
  const [documents, setDocuments] = useState<ReviewedCaseDocument[]>(draft?.documents ?? []), [error, setError] = useState(restored.value?.changed ? 'Der Entwurf wurde wiederhergestellt. Geänderte oder nicht mehr zugängliche Originale müssen neu ausgewählt werden.' : restored.value ? 'Entwurf wiederhergestellt. Notfallinformationen vor dem Speichern erneut ausdrücklich prüfen.' : '');
  const contextStamp = useRef(context.loadedAt);
  const changedContext = contextStamp.current !== context.loadedAt;
  useEffect(() => {
    if (contextStamp.current === context.loadedAt) return;
    contextStamp.current = context.loadedAt;
    setSourceIds([]); setTaskIds([]); setRecipientIds([]); setContactIds([]); setRiskIds([]); setPlanIds([]); setDocuments([]); setReviewed(false);
    setError('Der aktuelle Bestand wurde neu geladen. Texte bleiben erhalten; Originalbelege, Aufträge, Dokumentprüfungen und Empfangspersonen erneut auswählen.');
  }, [context.loadedAt]);
  const openTasks = context.controls.filter(t => controlHistory(t.task, t.events).status === 'open');
  const currentDraft: HandoverEditorDraft = { version: caseHandoverVersion, scope: draftScope, previousHeadId: previousHead, reason,
    content: { title, summary, priority, client: structuredClone(context.client), sources: context.sources.filter(s => sourceIds.includes(sourceKey(s))), tasks: openTasks.filter(t => taskIds.includes(t.task.id)),
      documents: structuredClone(documents), recipients: context.recipients.rows.filter(p => recipientIds.includes(p.id)), emergency: { contacts: context.contacts.rows.filter(r => contactIds.includes(String(r.id))), risks: context.risks.rows.filter(r => riskIds.includes(String(r.id))),
        plans: context.sources.filter(s => planIds.includes(sourceKey(s))), accessNote, limitations, reviewed } } };
  const draftJson = JSON.stringify(currentDraft);
  useEffect(() => {
    if (!isCurrent() || draftError || changedContext) return;
    try { saveHandoverDraft(window.sessionStorage, JSON.parse(draftJson) as HandoverEditorDraft); setDraftSaved(true); }
    catch (e) { setDraftSaved(false); setDraftError(e instanceof Error ? e.message : 'Der Entwurf konnte nicht gesichert werden.'); }
  }, [draftJson, draftError, context.loadedAt, changedContext]);
  function persistAndOpenDocument() {
    try {
      if (!isCurrent() || disabled || draftError || changedContext) throw Error('Den Entwurf zuerst im aktuellen Aktenstand sichern.');
      saveHandoverDraft(window.sessionStorage, currentDraft); setDraftSaved(true);
      window.open(clientRecordRoute(context.clientId), '_blank', 'noopener,noreferrer');
    } catch (e) { setDraftError(e instanceof Error ? e.message : 'Der Entwurf konnte vor dem Öffnen der Akte nicht gesichert werden.'); }
  }
  function persistAndOpenControls() {
    try {
      if (!isCurrent() || disabled || draftError || changedContext) throw Error('Den Entwurf zuerst im aktuellen Aktenstand sichern.');
      saveHandoverDraft(window.sessionStorage, currentDraft);
      router.push({ pathname: '/pflege/behandlungspflege', params: { view: 'controls', clientId: context.clientId } } as never);
    } catch (e) { setDraftError(e instanceof Error ? e.message : 'Der Entwurf konnte vor dem Wechsel nicht gesichert werden.'); }
  }
  function save() {
    try {
      if (!isCurrent() || disabled || draftError || changedContext) throw Error(draftError || 'Aktuelle Auswahl erneut prüfen.');
      if (!reviewed) throw Error('Notfallinformationen und fehlende Angaben ausdrücklich prüfen.');
      const content: HandoverContent = { title: title.trim(), summary: summary.trim(), priority, client: structuredClone(context.client),
        sources: context.sources.filter(s => sourceIds.includes(sourceKey(s))), tasks: openTasks.filter(t => taskIds.includes(t.task.id)),
        documents: structuredClone(documents), recipients: context.recipients.rows.filter(p => recipientIds.includes(p.id)),
        emergency: { contacts: context.contacts.rows.filter(r => contactIds.includes(String(r.id))), risks: context.risks.rows.filter(r => riskIds.includes(String(r.id))),
          plans: context.sources.filter(s => planIds.includes(sourceKey(s))), accessNote: accessNote.trim(), limitations: limitations.trim(), reviewed: true } };
      assertHandoverSelectionCurrent(content, context);
      if (previous && !reason.trim()) throw Error('Den tatsächlichen Anlass der neuen Fassung ergänzen.');
      setError(''); onSave(content, reason.trim());
    } catch (e) { setError(e instanceof Error ? e.message : 'Übergabe prüfen.'); }
  }
  return <View style={styles.stack}>
    <SectionPanel title={previous ? `Neue Fassung zu „${old?.title}“` : 'Neue Fallübergabe'} subtitle={`${person(context.client)} · Aktenstand ${when(context.loadedAt)}`}>
      <Text style={styles.caption}>{draftSaved && !draftError ? 'Entwurf für dieses Konto und diesen Fall in diesem Browserfenster gesichert. Er bleibt beim Neuladen erhalten; das Schließen des Fensters kann ihn entfernen.' : 'Entwurfssicherung in diesem Browserfenster noch nicht bestätigt.'}</Text>
      {draftError ? <><ErrorState message={draftError} /><PremiumButton title="Lokalen Entwurf freigeben und erneut sichern" variant="secondary" disabled={disabled} onPress={() => { try { discardHandoverDraft(window.sessionStorage, draftScope, previousHead); setDraftError(''); setDraftSaved(false); } catch (e) { setDraftError(e instanceof Error ? e.message : 'Entwurf konnte nicht freigegeben werden.'); } }} /></> : null}
      {previous ? <InfoBanner variant="warning" message="Die frühere Fassung bleibt erhalten. Quellen, Dokumente, Aufträge und Empfangspersonen müssen für die neue Fassung erneut ausgewählt und geprüft werden. Frühere Empfangsbestätigungen werden nicht übernommen." /> : null}
      <PremiumInput label="Titel der Übergabe *" maxLength={200} value={title} onChangeText={setTitle} editable={!disabled} />
      <PremiumInput label="Anlass, relevante Änderung und nächste Schritte *" maxLength={8000} value={summary} onChangeText={setSummary} multiline editable={!disabled} />
      <FilterChipGroup wrap options={priorities} value={priority} onChange={disabled ? undefined : v => setPriority(v as HandoverContent['priority'])} />
      {previous ? <PremiumInput label="Grund der neuen Fassung *" maxLength={4000} value={reason} onChangeText={setReason} multiline editable={!disabled} /> : null}
    </SectionPanel>
    <SectionPanel title="Aktenbelege übernehmen"><MultiSelect label="Originalbelege" rows={context.sources.map(s => ({ id: sourceKey(s), label: sourceTitle(s) }))} selected={sourceIds} disabled={disabled} onChange={v => { setSourceIds(v); setReviewed(false); }} />
      {context.sources.filter(s => sourceIds.includes(sourceKey(s))).map(s => <SourceSummary key={sourceKey(s)} source={s} />)}
    </SectionPanel>
    <DocumentReview key={context.loadedAt} context={context} value={documents} disabled={disabled} onOpenDocument={persistAndOpenDocument} onChange={v => { setDocuments(v); setReviewed(false); }} />
    <SectionPanel title="Notfallinformationen für diese Fassung prüfen" subtitle="Nur tatsächlich hinterlegte Angaben auswählen. Unbekannte Angaben bleiben ausdrücklich offen.">
      <MultiSelect label="Erreichbare Kontakte" rows={context.contacts.rows.map(r => ({ id: String(r.id), label: rowText(r, ['name', 'full_name', 'relationship', 'phone', 'mobile']) }))} selected={contactIds} disabled={disabled} onChange={v => { setContactIds(v); setReviewed(false); }} />
      <MultiSelect label="Relevante dokumentierte Risiken" rows={context.risks.rows.map(r => ({ id: String(r.id), label: rowText(r, ['category', 'level', 'description']) }))} selected={riskIds} disabled={disabled} onChange={v => { setRiskIds(v); setReviewed(false); }} />
      <MultiSelect label="Hinterlegte Planbezüge" rows={context.sources.filter(s => s.kind === 'care_plan').map(s => ({ id: sourceKey(s), label: sourceTitle(s) }))} selected={planIds} disabled={disabled} onChange={v => { setPlanIds(v); setReviewed(false); }} />
      <InfoBanner variant="info" message="Ein hinterlegter Pflegeplan ist keine bestätigte Notfallanordnung. Erreichbarkeit, Aktualität und medizinische Gültigkeit werden durch die Auswahl nicht bescheinigt." />
      <PremiumInput label="Zugang und Auffindbarkeit oder fehlende Angaben *" maxLength={2000} value={accessNote} onChangeText={v => { setAccessNote(v); setReviewed(false); }} multiline editable={!disabled} placeholder="Keine Schlüsselcodes oder Passwörter eintragen." />
      <PremiumInput label="Fehlende Informationen, Grenzen und weiterer Prüfbedarf *" maxLength={4000} value={limitations} onChangeText={v => { setLimitations(v); setReviewed(false); }} multiline editable={!disabled} />
      <FilterChipGroup wrap options={[{ key: 'open', label: 'Prüfung offen' }, { key: 'reviewed', label: 'Auswahl und fehlende Angaben geprüft' }]} value={reviewed ? 'reviewed' : 'open'} onChange={disabled ? undefined : v => setReviewed(v === 'reviewed')} />
    </SectionPanel>
    <SectionPanel title="Offene Versorgungsaufträge zuordnen">
      <Text style={styles.body}>Zuständigkeit, Frist und Eskalationsregel stammen aus dem Originalauftrag. Für Änderungen den Originalauftrag öffnen; eine Übergabe überträgt diese Angaben unverändert.</Text>
      <MultiSelect label="Bestehende offene Aufträge" rows={openTasks.map(r => { const s = controlHistory(r.task, r.events); return { id: r.task.id, label: `${s.title} · Frist ${when(s.policy.dueAt)} · ${context.recipients.rows.find(p => p.id === s.policy.assigneeId)?.name ?? 'Zuständigkeit im Originalauftrag'}` }; })} selected={taskIds} disabled={disabled} onChange={setTaskIds} />
      <PremiumButton title="Kontrollaufträge mit Zuständigkeit und Eskalation bearbeiten" variant="secondary" disabled={disabled} onPress={persistAndOpenControls} />
    </SectionPanel>
    <SectionPanel title="Berechtigte Empfangspersonen festlegen"><MultiSelect label="Empfangspersonen im eigenen Pflegeteam" rows={context.recipients.rows.map(p => ({ id: p.id, label: p.name }))} selected={recipientIds} disabled={disabled} onChange={setRecipientIds} />
      <Text style={styles.body}>Jede Person bestätigt ausschließlich ihren eigenen Empfang der genauen Fassung. Offene Versorgungsaufträge bleiben davon unberührt.</Text>
    </SectionPanel>
    {error ? <ErrorState message={error} /> : null}<View style={styles.actions}><PremiumButton title="Geprüfte Übergabefassung verbindlich speichern" disabled={disabled || !!draftError} onPress={save} /><PremiumButton title="Zurück zur Übersicht" variant="secondary" disabled={disabled} onPress={onCancel} /></View>
  </View>;
}

function DocumentReview({ context, value, disabled, onOpenDocument, onChange }: { context: CaseHandoverContext; value: ReviewedCaseDocument[]; disabled: boolean; onOpenDocument(): void; onChange(v: ReviewedCaseDocument[]): void }) {
  const styles = useHandoverStyles();
  const [selected, setSelected] = useState(''), [source, setSource] = useState(''), [date, setDate] = useState(''), [note, setNote] = useState(''), [readable, setReadable] = useState(false), [correct, setCorrect] = useState(false), [error, setError] = useState('');
  const document = context.documents.rows.find(r => r.id === selected);
  const eligible = context.documents.rows.filter(r => r.status === 'aktiv' && caseDocumentMimeTypes.includes(r.mime_type as typeof caseDocumentMimeTypes[number]));
  function add() {
    if (!document || !readable || !correct || !source.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Herkunft, tatsächliches Dokumentdatum, Lesbarkeit und richtige Fallzuordnung prüfen.'); return; }
    onChange([...value.filter(d => d.document.id !== document.id), { document: structuredClone(document), source: source.trim(), documentDate: date, note: note.trim(), readable: true, correctCase: true }]);
    setSelected(''); setSource(''); setDate(''); setNote(''); setReadable(false); setCorrect(false); setError('');
  }
  return <SectionPanel title="Dokumente prüfen und übernehmen">
    <Text style={styles.body}>Bereits der Pflegeakte zugeordnete Dokumente auswählen. Die Akte öffnen, um das tatsächliche Dokument zu lesen. Herkunft, Datum und persönliche Sichtprüfung werden mit genau dieser Metadatenfassung gesichert.</Text>
    <SourcePicker label="Aktives Dokument" rows={eligible.map(r => ({ id: String(r.id), label: rowText(r, ['title', 'file_name', 'category']) }))} value={selected} disabled={disabled} onChange={v => { setSelected(v); setSource(''); setDate(''); setReadable(false); setCorrect(false); }} />
    {context.documents.rows.length !== eligible.length ? <Text style={styles.caption}>Inaktive Dokumente und nicht unterstützte Dateitypen stehen nicht zur Übernahme bereit.</Text> : null}
    {document ? <View style={styles.stack}><Text style={styles.body}>{rowText(document, ['title', 'file_name', 'mime_type'])}</Text>
      <PremiumButton title="Pflegeakte zum Nachlesen in neuem Fenster öffnen" variant="secondary" disabled={disabled} onPress={onOpenDocument} />
      <PremiumInput label="Tatsächliche Herkunft / ausstellende Stelle *" maxLength={1000} value={source} onChangeText={setSource} editable={!disabled} />
      <PremiumInput label="Datum im Dokument (JJJJ-MM-TT) *" maxLength={10} value={date} onChangeText={setDate} editable={!disabled} />
      <PremiumInput label="Prüfhinweis oder Einschränkung" maxLength={4000} value={note} onChangeText={setNote} multiline editable={!disabled} />
      <FilterChipGroup wrap options={[{ key: 'no', label: 'Lesbarkeit offen' }, { key: 'yes', label: 'Dokument gelesen und lesbar' }]} value={readable ? 'yes' : 'no'} onChange={disabled ? undefined : v => setReadable(v === 'yes')} />
      <FilterChipGroup wrap options={[{ key: 'no', label: 'Zuordnung offen' }, { key: 'yes', label: `Gehört zu ${person(context.client)}` }]} value={correct ? 'yes' : 'no'} onChange={disabled ? undefined : v => setCorrect(v === 'yes')} />
      <PremiumButton title="Geprüfte Dokumentfassung übernehmen" variant="secondary" disabled={disabled} onPress={add} />
    </View> : null}
    {value.map(d => <View key={String(d.document.id)} style={styles.item}><Text style={styles.body}>{String(d.document.title)} · {d.source} · {d.documentDate}</Text><PremiumButton title="Dokument aus dieser Übergabe entfernen" variant="secondary" disabled={disabled} onPress={() => onChange(value.filter(x => x.document.id !== d.document.id))} /></View>)}
    {error ? <ErrorState message={error} /> : null}
  </SectionPanel>;
}

function SourceSummary({ source }: { source: ControlSource }) {
  const styles = useHandoverStyles();
  const labels: Record<string, string> = { title: 'Bezeichnung', summary: 'Zusammenfassung', description: 'Beschreibung', content: 'Inhalt', result: 'Ergebnis', note: 'Hinweis', notes: 'Hinweise', status: 'Dokumentierter Status', occurred_at: 'Tatsächlicher Zeitpunkt', measured_at: 'Messzeitpunkt', updated_at: 'Fassungsstand', value: 'Wert', unit: 'Einheit' };
  return <View style={styles.item}><Text style={styles.heading}>{sourceTitle(source)}</Text>{Object.entries(labels).filter(([k]) => ['string', 'number'].includes(typeof source.snapshot[k])).map(([k, label]) => <Text key={k} style={styles.body}>{label}: {String(source.snapshot[k])}</Text>)}</View>;
}

function HandoverDetail({ state, context, actorId, disabled, canManage, canExport, onAcknowledge, onClose, onRevise, isCurrent }: {
  state: CaseHandoverState; context: CaseHandoverContext; actorId: string; disabled: boolean; canManage: boolean; canExport: boolean;
  onAcknowledge(s: string): void; onClose(s: string): void; onRevise(): void; isCurrent(): boolean;
}) {
  const styles = useHandoverStyles();
  const router = useRouter(), [statement, setStatement] = useState(''), [closeStatement, setCloseStatement] = useState(''), [error, setError] = useState('');
  const content = state.head.command.content, tasks = handoverTaskFollowUps(content, context.controls, context.tenantId, context.clientId);
  const ownPending = state.pendingRecipients.some(p => p.id === actorId), allTasksClosed = tasks.every(t => t.accessible && t.state?.status !== 'open');
  const [historyCount, setHistoryCount] = useState(10);
  function exportEmergency() {
    try {
      if (!isCurrent() || !canExport || disabled) throw Error('Die aktuelle Ausgabeberechtigung ist nicht bestätigt.');
      const html = caseEmergencyExcerpt(content, state.head.recordedAt), blob = new Blob([html], { type: 'text/html;charset=utf-8' }), url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'CareSuite_Fallinformationen.html'; link.rel = 'noopener'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Die Fallinformationen konnten nicht ausgegeben werden.'); }
  }
  return <View style={styles.stack}>
    <SectionPanel title={content.title} subtitle={`Fassung ${state.revision} · ${priorityLabel(content.priority)} · ${state.head.actorName} · ${when(state.head.recordedAt)}`}>
      <Text style={styles.body}>{content.summary}</Text><InfoBanner variant="info" message={state.closure ? 'Die Kommunikation ist geschlossen. Dies bescheinigt keine Durchführung der Versorgung.' : `Empfang: ${state.acknowledgements.length} bestätigt, ${state.pendingRecipients.length} offen. Versorgungsaufträge werden separat weiterverfolgt.`} />
      {canManage && !state.closure ? <PremiumButton title="Geänderte Informationen als neue Fassung übergeben" variant="secondary" disabled={disabled} onPress={onRevise} /> : null}
    </SectionPanel>
    <SectionPanel title="Aktenbelege und übernommene Dokumente">
      {content.sources.map(s => <SourceSummary key={sourceKey(s)} source={s} />)}
      {content.documents.map(d => <View key={String(d.document.id)} style={styles.item}><Text style={styles.heading}>{String(d.document.title)}</Text><Text style={styles.body}>{d.source} · Dokumentdatum {d.documentDate} · Lesbarkeit und Fallzuordnung durch {state.head.actorName} bestätigt</Text>{d.note ? <Text style={styles.body}>{d.note}</Text> : null}</View>)}
      {!content.sources.length && !content.documents.length ? <Text style={styles.body}>Keine zusätzlichen Belege oder Dokumente ausgewählt.</Text> : null}
    </SectionPanel>
    <SectionPanel title="Notfallinformationen der übergebenen Fassung">
      <Text style={styles.heading}>{person(content.client)}</Text><Text style={styles.body}>{rowText(content.client, ['date_of_birth', 'birth_date', 'street', 'house_number', 'zip', 'postal_code', 'city'])}</Text>
      <Text style={styles.heading}>Kontakte</Text>{content.emergency.contacts.length ? content.emergency.contacts.map(r => <Text key={String(r.id)} style={styles.body}>{rowText(r, ['name', 'full_name', 'relationship', 'phone', 'mobile', 'email'])}</Text>) : <Text style={styles.body}>Keine geprüften Kontakte in dieser Fassung.</Text>}
      <Text style={styles.heading}>Risiken</Text>{content.emergency.risks.length ? content.emergency.risks.map(r => <Text key={String(r.id)} style={styles.body}>{rowText(r, ['category', 'level', 'description', 'mitigation'])}</Text>) : <Text style={styles.body}>Keine Risiken für diese Fassung ausgewählt.</Text>}
      {content.emergency.plans.map(s => <SourceSummary key={sourceKey(s)} source={s} />)}
      <Text style={styles.body}>Zugang und Auffindbarkeit: {content.emergency.accessNote}</Text><Text style={styles.body}>Fehlende Angaben / Prüfbedarf: {content.emergency.limitations}</Text>
      <InfoBanner variant="warning" message="Der Auszug zeigt die übergebene Fassung. Erreichbarkeit, aktuelle medizinische Gültigkeit und Notfallanordnungen sind damit nicht bestätigt." />
      {canExport ? <PremiumButton title="Geprüfte Fallinformationen herunterladen" variant="secondary" disabled={disabled} onPress={exportEmergency} /> : null}
    </SectionPanel>
    <SectionPanel title="Versorgungsaufträge und aktuelle Folgen">
      {!tasks.length ? <Text style={styles.body}>Dieser Übergabe wurden keine bestehenden Aufträge zugeordnet.</Text> : null}
      {tasks.map(t => { const captured = controlHistory(t.original.task, t.original.events); return <View key={t.original.task.id} style={styles.item}>
        <Text style={styles.heading}>{captured.title}</Text><Text style={styles.body}>Bei Übergabe: {controlStatusLabels[captured.status]} · Frist {when(captured.policy.dueAt)}</Text>
        <Text style={styles.body}>{t.state ? `Aktuell: ${controlStatusLabels[t.state.status]} · Frist ${when(t.state.policy.dueAt)} · zuständig: ${context.recipients.rows.find(p => p.id === t.state!.policy.assigneeId)?.name ?? 'Person im Originalauftrag prüfen'}` : 'Aktueller Originalauftrag nicht zugänglich. Sein Status bleibt unbekannt.'}</Text>
        {t.state?.status === 'open' ? <Text style={styles.body}>Eskalation laut Originalauftrag: {when(t.state.policy.escalationAt)} · {context.recipients.rows.find(p => p.id === t.state!.policy.escalationRecipientId)?.name ?? 'Empfangsperson im Originalauftrag prüfen'}{woundInstant(t.state.policy.escalationAt)! <= BigInt(Date.now()) * 1000n ? '. Eskalationsfrist erreicht; tatsächliche Kontaktaufnahme und Rückmeldung im Originalauftrag nachhalten.' : ''}</Text> : null}
        {t.changed ? <Text style={styles.caption}>Der Originalauftrag wurde seit der Übergabe fortgeschrieben. Der übergebene Stand bleibt erhalten.</Text> : null}
        {t.current ? <PremiumButton title="Originalauftrag und Eskalationsregel öffnen" variant="secondary" disabled={disabled} onPress={() => { if (isCurrent()) router.push({ pathname: '/pflege/behandlungspflege', params: { view: 'controls', clientId: context.clientId, taskId: t.original.task.id } } as never); }} /> : null}
      </View>; })}
    </SectionPanel>
    <SectionPanel title="Empfang und tatsächliche Rückmeldung">
      {content.recipients.map(p => { const ack = state.acknowledgements.find(e => e.actorId === p.id); return <View key={p.id} style={styles.item}><Text style={styles.heading}>{p.name}</Text><Text style={styles.body}>{ack ? `Empfang bestätigt am ${when(ack.recordedAt)}` : 'Empfang dieser Fassung offen'}</Text>{ack?.command.kind === 'acknowledge' ? <Text style={styles.body}>{ack.command.statement}</Text> : null}</View>; })}
      {canManage && ownPending && !state.closure ? <><PremiumInput label="Eigene tatsächliche Rückmeldung zum Empfang *" maxLength={4000} value={statement} onChangeText={setStatement} multiline editable={!disabled} /><PremiumButton title="Meinen Empfang dieser Fassung bestätigen" disabled={disabled || !statement.trim()} onPress={() => onAcknowledge(statement.trim())} /></> : null}
    </SectionPanel>
    {canManage && !state.closure ? <SectionPanel title="Kommunikation abschließen"><Text style={styles.body}>{state.pendingRecipients.length ? 'Der Abschluss wartet auf alle Empfangsbestätigungen.' : !allTasksClosed ? 'Der Abschluss wartet auf die Bearbeitung der zugeordneten Originalaufträge. Fehlende oder offene Aufträge bleiben sichtbar.' : 'Alle Empfangsbestätigungen und die nicht mehr offenen Originalaufträge liegen vor. Einen tatsächlichen Abschlussvermerk ergänzen.'}</Text>
      <PremiumInput label="Tatsächlicher Abschlussvermerk *" maxLength={4000} value={closeStatement} onChangeText={setCloseStatement} multiline editable={!disabled} /><PremiumButton title="Kommunikation mit aktuellem Aufgabenstand schließen" disabled={disabled || !!state.pendingRecipients.length || !allTasksClosed || !closeStatement.trim()} onPress={() => onClose(closeStatement.trim())} />
    </SectionPanel> : null}
    <SectionPanel title="Unveränderlicher Verlauf"><Text style={styles.body}>{state.events.length} belegte Ereignisse. Empfangsbestätigungen gehören jeweils zu der darin bezeichneten Fassung.</Text>
      {state.events.slice(-historyCount).map(e => <View key={e.id} style={styles.item}><Text style={styles.heading}>{{ publish: 'Übergabefassung gespeichert', acknowledge: 'Eigener Empfang bestätigt', close: 'Kommunikation geschlossen' }[e.kind]}</Text><Text style={styles.body}>{e.actorName} · {when(e.recordedAt)}</Text><Text style={styles.body}>{e.command.kind === 'publish' ? `${e.command.content.title}${e.command.reason ? ' · ' + e.command.reason : ''}` : e.command.statement}</Text></View>)}
      {historyCount < state.events.length ? <PremiumButton title="Frühere Ereignisse anzeigen" variant="secondary" onPress={() => setHistoryCount(n => n + 10)} /> : null}
    </SectionPanel>{error ? <ErrorState message={error} /> : null}
  </View>;
}

function useHandoverStyles() {
  const text = useAdaptiveContentStyles();
  return { ...layoutStyles, body: text.body, caption: text.caption, heading: text.bodyStrong };
}
const layoutStyles = StyleSheet.create({
  stack: { gap: spacing.md, width: '100%', minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'flex-start' },
  item: { borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 12, padding: spacing.md, gap: spacing.sm, minWidth: 0, width: '100%' },
  selected: { borderColor: colors.primary },
});
