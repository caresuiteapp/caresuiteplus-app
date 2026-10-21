import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { CareMedicationScheduleInput } from '@/components/inputs/CareMedicationScheduleInput';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { careAssessmentRuntimeAccess } from '@/lib/careAssessment/careAssessmentRuntimeAccess.web';
import { formatIntakeSchemaShort } from '@/lib/formatters/unitFormatters';
import { confirmAction } from '@/lib/platform/confirmAction';
import { createLiveMedication, fetchMedicationClientOptions, type CreateMedicationInput } from '@/lib/pflege/medicationLiveService';
import { assertMedicationCreateReceipt, readMedicationCreateReceipt } from '@/lib/pflege/medicationCreateReceipt.web';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import type { RoleKey, ServiceResult } from '@/types';
import type { MedicationClientOption } from '@/types/modules/pflege';
import { colors, spacing, typography } from '@/theme';

type Owner = { tenantId: string; profileId: string; role: RoleKey };
type Status = 'idle' | 'busy' | 'uncertain' | 'confirmed';
type Form = {
  clientSearch: string; clientId: string; name: string; activeIngredient: string; strength: string; form: string;
  dosage: string; route: string; prescribedBy: string; indication: string; notes: string;
  schedule: { morning: number; noon: number; evening: number; night: number }; schemaKey: string;
  isPrn: boolean; prnReason: string; isHighAlert: boolean; isControlled: boolean; intensive: boolean;
  pumpRequired: boolean; infusionRate: string; dilution: string;
};
type ClientRead = { ticket: symbol; owner: Owner; clients: MedicationClientOption[] };
type Attempt = { owner: Owner; ticket: symbol; form: Form; clients: MedicationClientOption[]; client: MedicationClientOption; payload: CreateMedicationInput; receiptId: string | null; saved: Record<string, unknown> | null };
type OriginalWrite = { attempt: Attempt; ticket: symbol; original: Pick<Attempt, 'owner' | 'form' | 'clients' | 'client' | 'payload'>; receiptId: string | null };
type ReadReceipt = { attempt: Attempt; ticket: symbol; original: OriginalWrite['original']; id: string; raw: Record<string, unknown> };
type Props = { owner: Owner | null; runtimeTenant: string | null; runtimeRole: RoleKey | null; canView: boolean; canManage: boolean; roleLabel: string | null };

const yesNo = [{ key: 'no', label: 'Nein' }, { key: 'yes', label: 'Ja' }];
const initialForm: Form = {
  clientSearch: '', clientId: '', name: '', activeIngredient: '', strength: '', form: 'Tablette', dosage: '', route: 'oral',
  prescribedBy: '', indication: '', notes: '', schedule: { morning: 0, noon: 0, evening: 0, night: 0 }, schemaKey: 'individuell',
  isPrn: false, prnReason: '', isHighAlert: false, isControlled: false, intensive: false, pumpRequired: false, infusionRate: '', dilution: '',
};
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Validate the entire supplied result, without claiming that the service returned an exhaustive client roster. */
function validateClients(input: unknown): MedicationClientOption[] {
  if (!Array.isArray(input)) throw Error('Der aktuelle Klientenbestand ist nicht verfügbar.');
  const ids = new Set<string>();
  for (let i = 0; i < input.length; i++) {
    const row = input[i];
    if (!row || typeof row !== 'object' || !woundUuid(row.id) || ids.has(row.id) || typeof row.label !== 'string' || !row.label.trim()
      || !(row.allergies === null || typeof row.allergies === 'string') || !(row.specialNotes === null || typeof row.specialNotes === 'string')) {
      throw Error('Der geladene Klientenbestand enthält ungültige oder doppelte native Angaben.');
    }
    ids.add(row.id);
  }
  return clone(input);
}

function validForm(value: Form): boolean {
  if (!value || typeof value !== 'object') return false;
  for (const key of Object.keys(initialForm) as (keyof Form)[]) {
    if (key === 'schedule') continue;
    if (typeof value[key] !== typeof initialForm[key]) return false;
  }
  return !!value.schedule && (['morning', 'noon', 'evening', 'night'] as const)
    .every(key => typeof value.schedule[key] === 'number' && Number.isFinite(value.schedule[key]) && value.schedule[key] >= 0);
}

function preparePayload(value: Form): CreateMedicationInput {
  if (!validForm(value) || !woundUuid(value.clientId) || !value.name.trim()) throw Error('Klient:in und Präparat sind erforderlich.');
  if (value.isPrn && !value.prnReason.trim()) throw Error('Für Bedarfsmedikation ist eine eindeutige Indikation erforderlich.');
  if (value.pumpRequired && !value.infusionRate.trim()) throw Error('Bei Pumpengabe ist die Laufgeschwindigkeit erforderlich.');
  return {
    clientId: value.clientId, name: value.name, activeIngredient: value.activeIngredient, strength: value.strength, form: value.form,
    dosage: value.dosage, route: value.route, prescribedBy: value.prescribedBy, indication: value.indication, notes: value.notes,
    startDate: new Date().toISOString().slice(0, 10),
    schedule: value.isPrn ? 'Bei Bedarf' : formatIntakeSchemaShort(value.schedule.morning, value.schedule.noon, value.schedule.evening, value.schedule.night),
    morningDose: String(value.schedule.morning || ''), noonDose: String(value.schedule.noon || ''), eveningDose: String(value.schedule.evening || ''), nightDose: String(value.schedule.night || ''),
    isPrn: value.isPrn, prnReason: value.prnReason, isHighAlert: value.isHighAlert, isControlledSubstance: value.isControlled,
    intensiveCareRelevant: value.intensive, infusionRate: value.infusionRate, dilution: value.dilution, pumpRequired: value.pumpRequired,
  };
}

export function MedicationCreateScreen() {
  const { profile } = useAuth();
  const runtimeTenant = useServiceTenantId();
  const permissions = usePermissions();
  const owner: Owner | null = profile && woundUuid(profile.tenantId) && woundUuid(profile.id) && profile.roleKey
    ? { tenantId: profile.tenantId!, profileId: profile.id, role: profile.roleKey } : null;
  // Permission/runtime readiness is deliberately absent from this native mount key.
  return <MedicationCreateEditor key={JSON.stringify(owner)} owner={owner} runtimeTenant={runtimeTenant}
    runtimeRole={permissions.roleKey} canView={permissions.can('pflege.medications.view')}
    canManage={permissions.can('pflege.medications.manage')} roleLabel={permissions.roleLabel} />;
}

function MedicationCreateEditor(props: Props) {
  const router = useRouter();
  const navigation = useNavigation();
  const owner = useRef(props.owner ? clone(props.owner) : null).current;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [value, setValue] = useState<Form>(() => clone(initialForm));
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmingRead, setConfirmingRead] = useState(false);
  const statusRef = useRef<Status>('idle');
  const flight = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const originalWrite = useRef<OriginalWrite | null>(null);
  const readFlight = useRef(false);
  const confirmedRead = useRef<ReadReceipt | null>(null);
  const leaving = useRef(false);
  const access = careAssessmentRuntimeAccess({ tenantId: props.owner?.tenantId, profileId: props.owner?.profileId,
    profileRole: props.owner?.role, runtimeTenantId: props.runtimeTenant, runtimeRole: props.runtimeRole,
    canView: props.canView, canManage: props.canManage });
  // The existing client-options service requires Manage; it supplies confidential client fields.
  const canLoadClients = access.canRead && access.canManage && same(owner, props.owner);
  const queryKey = JSON.stringify([owner, props.runtimeTenant, props.runtimeRole, props.canView, props.canManage, canLoadClients]);
  const readBoundary = useRef({ key: queryKey, ticket: Symbol('medication-client-read') });
  if (readBoundary.current.key !== queryKey) readBoundary.current = { key: queryKey, ticket: Symbol('medication-client-read') };
  const ownReadKey = JSON.stringify([owner, props.owner, props.runtimeTenant, props.runtimeRole, props.canView, access.canRead]);
  const ownReadBoundary = useRef({ key: ownReadKey, ticket: Symbol('medication-original-read') });
  if (ownReadBoundary.current.key !== ownReadKey) ownReadBoundary.current = { key: ownReadKey, ticket: Symbol('medication-original-read') };
  const runtime = useRef({ owner: props.owner, access, canLoadClients, ticket: readBoundary.current.ticket });
  runtime.current = { owner: props.owner, access, canLoadClients, ticket: readBoundary.current.ticket };
  function nativeCurrent() { return alive.current && !!owner && same(owner, runtime.current.owner); }
  function readCurrent(ticket: symbol) { return nativeCurrent() && runtime.current.canLoadClients && runtime.current.ticket === ticket; }
  const clientsQuery = useAsyncQuery<ClientRead>(async () => {
    const ticket = runtime.current.ticket;
    if (!readCurrent(ticket) || !owner) return { ok: false, error: 'Aktueller Benutzerbezug oder Leserecht fehlt.' };
    const result = await fetchMedicationClientOptions(owner.tenantId, owner.role);
    if (!readCurrent(ticket)) return { ok: false, error: 'Der Benutzerbezug oder das Leserecht wurde geändert.' };
    if (!result.ok) return result;
    try { return { ok: true, data: { ticket, owner: clone(owner), clients: validateClients(result.data) } }; }
    catch (cause) { return { ok: false, error: cause instanceof Error ? cause.message : 'Der Klientenbestand ist ungültig.' }; }
  }, [queryKey], { queryKey, enabled: canLoadClients, retryCount: 0 });
  let clients: MedicationClientOption[] = [];
  let poolError: string | null = null;
  const envelope = clientsQuery.data;
  let ready = canLoadClients && !!envelope && readCurrent(envelope.ticket) && same(envelope.owner, owner)
    && !clientsQuery.loading && !clientsQuery.refreshing && !clientsQuery.error && !clientsQuery.refreshError
    && !clientsQuery.previewData && !clientsQuery.tableMissing;
  if (ready && envelope) {
    try { clients = validateClients(envelope.clients); } catch (cause) { ready = false; poolError = cause instanceof Error ? cause.message : 'Der Klientenbestand ist ungültig.'; }
  }
  const latest = useRef({ value, clients, ready, envelope, readKey: queryKey, queryError: clientsQuery.error, refreshError: clientsQuery.refreshError,
    loading: clientsQuery.loading, refreshing: clientsQuery.refreshing, confirm: confirmAction, back: () => router.back(), open: (id: string) => router.push(`/pflege/medikation/${id}` as never), refresh: clientsQuery.refresh });
  latest.current = { value, clients, ready, envelope, readKey: queryKey, queryError: clientsQuery.error, refreshError: clientsQuery.refreshError,
    loading: clientsQuery.loading, refreshing: clientsQuery.refreshing, confirm: confirmAction, back: () => router.back(), open: (id: string) => router.push(`/pflege/medikation/${id}` as never), refresh: clientsQuery.refresh };
  function writable() { return nativeCurrent() && runtime.current.access.canManage && latest.current.ready && !flight.current && !readFlight.current && statusRef.current === 'idle'; }
  function change<K extends keyof Form>(key: K, next: Form[K]) {
    if (!writable()) return;
    const nextValue = clone({ ...latest.current.value, [key]: next });
    if (!validForm(nextValue)) return;
    if (key === 'clientId' && !validateClients(latest.current.clients).some(client => client.id === next)) return;
    latest.current.value = nextValue;
    setValue(nextValue); setError(null);
  }
  function publishStatus(next: Status) { statusRef.current = next; if (nativeCurrent()) setStatus(next); }
  function originalFrame(captured: Attempt): OriginalWrite['original'] {
    return clone({ owner: captured.owner, form: captured.form, clients: captured.clients, client: captured.client, payload: captured.payload });
  }
  function originalCurrent(captured: Attempt) {
    const original = originalWrite.current;
    return nativeCurrent() && !!original && attempt.current === captured && original.attempt === captured
      && captured.ticket === original.ticket && same(captured.owner, owner) && same(originalFrame(captured), original.original)
      && captured.receiptId === original.receiptId && same(latest.current.value, original.original.form);
  }
  function ownOriginalRead(captured: Attempt, ticket: symbol) {
    return originalCurrent(captured) && runtime.current.access.canRead && ownReadBoundary.current.ticket === ticket;
  }
  function acceptOriginalRead(captured: Attempt, ticket: symbol, raw: Record<string, unknown>) {
    if (!ownOriginalRead(captured, ticket) || !captured.receiptId || !woundUuid(captured.receiptId)) return false;
    const saved = assertMedicationCreateReceipt(raw, { id: captured.receiptId, tenantId: captured.owner.tenantId,
      profileId: captured.owner.profileId, clientId: captured.client.id, role: captured.owner.role, input: captured.payload });
    captured.saved = clone(saved);
    confirmedRead.current = { attempt: captured, ticket, original: originalFrame(captured), id: captured.receiptId, raw: clone(saved) };
    publishStatus('confirmed'); return true;
  }
  function currentOriginalReceipt() {
    const captured = attempt.current, receipt = confirmedRead.current;
    if (!captured || !receipt || statusRef.current !== 'confirmed' || flight.current || readFlight.current
      || receipt.attempt !== captured || receipt.id !== captured.receiptId || !ownOriginalRead(captured, receipt.ticket)
      || !same(receipt.original, originalFrame(captured)) || !same(receipt.raw, captured.saved)) return null;
    try { assertMedicationCreateReceipt(receipt.raw, { id: receipt.id, tenantId: captured.owner.tenantId,
      profileId: captured.owner.profileId, clientId: captured.client.id, role: captured.owner.role, input: captured.payload }); }
    catch { return null; }
    return receipt;
  }
  function stillOwnAttempt(captured: Attempt) {
    const current = latest.current;
    return nativeCurrent() && readCurrent(captured.ticket) && attempt.current === captured && same(current.value, captured.form)
      && runtime.current.access.canManage && current.ready && same(validateClients(current.clients), captured.clients);
  }
  async function handleSave() {
    if (!writable() || !owner) return;
    let captured: Attempt;
    try {
      const form = clone(latest.current.value), pool = validateClients(latest.current.clients), payload = preparePayload(form);
      const client = pool.find(row => row.id === form.clientId);
      if (!client) throw Error('Der gewählte native Klient ist im aktuellen Benutzerbezug nicht enthalten.');
      captured = { owner: clone(owner), ticket: runtime.current.ticket, form, clients: pool, client: clone(client), payload: clone(payload), receiptId: null, saved: null };
    } catch (cause) { if (nativeCurrent()) setError(cause instanceof Error ? cause.message : 'Die Angaben konnten nicht vorbereitet werden.'); return; }
    // Lock synchronously before the first service call, including repeated calls before a React render.
    flight.current = true; attempt.current = captured;
    originalWrite.current = { attempt: captured, ticket: captured.ticket, original: originalFrame(captured), receiptId: null };
    const originalReadTicket = ownReadBoundary.current.ticket;
    publishStatus('busy'); setError(null);
    try {
      const result: ServiceResult<{ id: string }> = await createLiveMedication(captured.owner.tenantId, captured.owner.profileId, clone(captured.payload), captured.owner.role);
      const validReceipt = result?.ok === true && woundUuid(result.data?.id);
      if (validReceipt) {
        captured.receiptId = result.data.id;
        if (originalWrite.current?.attempt === captured) originalWrite.current.receiptId = result.data.id;
      }
      if (!validReceipt || !stillOwnAttempt(captured)) {
        // The unchanged direct-insert API does not classify false results or expose an idempotent request identity.
        publishStatus('uncertain');
        if (nativeCurrent()) setError('Das Speicherergebnis ist im aktuellen Benutzerbezug nicht bestätigt. Die ursprünglichen Angaben bleiben erhalten; eine erneute Anlage ist gesperrt.');
        return;
      }
      const saved = await readMedicationCreateReceipt({ id: captured.receiptId!, tenantId: captured.owner.tenantId,
        profileId: captured.owner.profileId, clientId: captured.client.id, role: captured.owner.role, input: clone(captured.payload) }, () => stillOwnAttempt(captured) && ownOriginalRead(captured, originalReadTicket));
      if (!stillOwnAttempt(captured) || !acceptOriginalRead(captured, originalReadTicket, saved)) {
        publishStatus('uncertain');
        if (nativeCurrent()) setError('Die zurückgegebene Verordnungskennung konnte nicht im unveränderten eigenen Mandanten- und Klientenbezug gelesen werden. Eine erneute Anlage bleibt gesperrt.');
        return;
      }
    } catch {
      publishStatus('uncertain');
      if (nativeCurrent()) setError('Das Speicherergebnis ist ungeklärt. Die ursprünglichen Angaben bleiben erhalten; eine erneute Anlage ist gesperrt.');
    } finally { flight.current = false; }
  }
  async function confirmKnownOriginal() {
    const captured = attempt.current, ticket = ownReadBoundary.current.ticket;
    if (!captured || !woundUuid(captured.receiptId) || flight.current || readFlight.current
      || (statusRef.current !== 'uncertain' && statusRef.current !== 'confirmed') || !ownOriginalRead(captured, ticket)) return;
    // Read only: preserve the original write and returned identity, without invoking creation again.
    readFlight.current = true; if (nativeCurrent()) setConfirmingRead(true);
    try {
      const raw = await readMedicationCreateReceipt({ id: captured.receiptId!, tenantId: captured.owner.tenantId,
        profileId: captured.owner.profileId, clientId: captured.client.id, role: captured.owner.role, input: clone(captured.payload) }, () => ownOriginalRead(captured, ticket));
      if (!acceptOriginalRead(captured, ticket, raw)) {
        if (attempt.current === captured) publishStatus('uncertain');
        if (nativeCurrent()) setError('Der eigene Lesebezug hat sich vor der Übernahme des Anlagenbelegs geändert. Die Originalangaben und Kennung bleiben erhalten; eine erneute Anlage ist gesperrt.');
        return;
      }
      if (nativeCurrent()) setError(null);
    } catch {
      if (attempt.current === captured) publishStatus('uncertain');
      if (nativeCurrent()) setError('Der ursprüngliche Anlagenbeleg konnte im aktuellen eigenen Lesebezug nicht bestätigt werden. Die Originalangaben und Kennung bleiben erhalten; eine erneute Anlage ist gesperrt.');
    } finally { readFlight.current = false; if (nativeCurrent()) setConfirmingRead(false); }
  }
  function leaveSnapshot() {
    const current = latest.current;
    return clone({ owner: runtime.current.owner, value: current.value, clients: current.clients, ready: current.ready,
      readKey: current.readKey, queryError: current.queryError, refreshError: current.refreshError, loading: current.loading,
      refreshing: current.refreshing, status: statusRef.current, attempt: attempt.current });
  }
  function canLeave() { return nativeCurrent() && !flight.current && !readFlight.current && statusRef.current !== 'busy' && statusRef.current !== 'uncertain'; }
  async function handleLeave(action?: () => void) {
    if (!canLeave() || leaving.current) return;
    const captured = leaveSnapshot(), ticket = runtime.current.ticket; leaving.current = true;
    try {
      const dirty = statusRef.current !== 'confirmed' && !same(latest.current.value, initialForm);
      const accepted = !dirty || await latest.current.confirm({ title: 'Ungespeicherte Eingaben', message: 'Möchten Sie die unveränderten Eingaben verwerfen und die Seite verlassen?', confirmLabel: 'Eingaben verwerfen', cancelLabel: 'Weiter bearbeiten' });
      if (!accepted || !canLeave() || runtime.current.ticket !== ticket || !same(captured, leaveSnapshot())) return;
      if (action) action(); else latest.current.back();
    } finally { leaving.current = false; }
  }
  function openCreated() {
    const receipt = currentOriginalReceipt();
    if (receipt) latest.current.open(receipt.id);
  }
  function reloadClients() { if (nativeCurrent() && runtime.current.canLoadClients) void latest.current.refresh(); }
  const dirty = status !== 'confirmed' && !same(value, initialForm);
  usePreventRemove(dirty || (['busy','uncertain'] as readonly string[]).includes(status) || confirmingRead, ({ data }) => { void handleLeave(() => navigation.dispatch(data.action)); });
  useEffect(() => {
    if ((!dirty && status !== 'busy' && status !== 'uncertain' && !confirmingRead) || typeof window === 'undefined') return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirty, status, confirmingRead]);
  const writeBlocked = !ready || !access.canManage || status !== 'idle';
  const { clientSearch, clientId, name, activeIngredient, strength, form, dosage, route, prescribedBy, indication, notes,
    schedule, schemaKey, isPrn, prnReason, isHighAlert, isControlled, intensive, pumpRequired, infusionRate, dilution } = value;
  const roleLabel = props.roleLabel;
  const filteredClients = useMemo(() => {
    const needle = clientSearch.trim().toLocaleLowerCase('de-DE');
    return clients.filter(client => !needle || client.label.toLocaleLowerCase('de-DE').includes(needle)).slice(0, 40);
  }, [clients, clientSearch]);
  const selectedClient = clients.find(client => client.id === clientId);
  const knownOriginal = attempt.current;
  const readableReceipt = currentOriginalReceipt();
  const canConfirmKnown = !!knownOriginal && woundUuid(knownOriginal.receiptId) && ownOriginalRead(knownOriginal, ownReadBoundary.current.ticket)
    && !flight.current && !readFlight.current;
  if (status === 'uncertain' || status === 'confirmed') return <ScreenShell title={readableReceipt ? 'Anlagenbeleg gelesen' : 'Anlagenbeleg prüfen'} showBack={false}>
    {access.canRead && nativeCurrent() ? <>
      {readableReceipt ? <SuccessState message="Der ursprüngliche Anlageninhalt wurde unter seiner nativen Kennung im eigenen Mandanten- und Klientenbezug gelesen. Eine ärztliche Freigabe oder tatsächliche Durchführung ist damit nicht bestätigt." /> : status === 'confirmed' ? <InfoBanner variant="info" title="Frühere Rücklesung erhalten" message="Der frühere Anlagenbeleg ist keine aktuelle Lesebestätigung. Bitte das Speicherergebnis unter den aktuellen eigenen Leserechten erneut prüfen." /> : <ErrorState message={error ?? 'Das Speicherergebnis ist nicht bestätigt.'} />}
      <InfoBanner variant="warning" title="Ursprüngliche Angaben erhalten" message="Eine sichere erneute Anlage ist nicht verfügbar. Eine bereits zurückgegebene Kennung kann ausschließlich lesend mit dem ursprünglichen Auftrag abgeglichen werden. Ohne Kennung bleibt das Ergebnis ungeklärt. Der lokale Originalauftrag kann bei Neuladen verloren gehen." />
    </> : <ErrorState message="Der aktuelle eigene Benutzerbezug oder das erforderliche Leserecht ist nicht verfügbar. Der ursprüngliche Speicherstand bleibt gesperrt." />}
    <PremiumButton title={confirmingRead ? 'Anlagenbeleg wird gelesen…' : 'Speicherergebnis erneut lesen'} disabled={!canConfirmKnown} onPress={() => { void confirmKnownOriginal(); }} />
    <PremiumButton title="Gespeicherte Verordnung öffnen" disabled={!readableReceipt} onPress={openCreated} />
    <PremiumButton title="Zurück" disabled={status === 'uncertain' || confirmingRead} variant="secondary" onPress={() => { void handleLeave(); }} />
  </ScreenShell>;
  if (!canLoadClients || !ready) return <ScreenShell title="Medikation anlegen" onBack={() => { void handleLeave(); }}>
    {canLoadClients && clientsQuery.loading ? <LoadingState message="Klientenbestand wird geladen…" /> : <ErrorState message={poolError ?? clientsQuery.error ?? clientsQuery.refreshError ?? 'Der aktuelle Benutzerbezug oder die erforderlichen Rechte sind nicht verfügbar.'} />}
    <PremiumButton title="Klientenbestand erneut laden" disabled={!canLoadClients} onPress={reloadClients} />
    <PremiumButton title="Zurück" disabled={(['busy','uncertain'] as readonly string[]).includes(status)} variant="secondary" onPress={() => { void handleLeave(); }} />
  </ScreenShell>;
  return (
    <ScreenShell title="Medikation anlegen" subtitle={`Ambulante Pflege und Intensivpflege · ${roleLabel ?? 'Pflegefachkraft'}`} onBack={() => { void handleLeave(); }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoBanner variant="info" title="Verordnung erfassen" message="Gespeicherte Angaben sind keine ärztliche Freigabe oder bestätigte Durchführung. Originalquelle und fachliche Prüfung bleiben gesondert erforderlich." />
        {error ? <ErrorState message={error} /> : null}
        <SectionPanel title="Klient:in" subtitle="Aktiver Versorgungsfall">
          <PremiumInput label="Klient:in suchen" placeholder="Name eingeben" value={clientSearch} onChangeText={value => change("clientSearch", value)} editable={!writeBlocked} />
          <FilterChipGroup options={filteredClients.map((client) => ({ key: client.id, label: client.label }))} value={clientId} onChange={value => change("clientId", value)} />
          {selectedClient?.allergies ? <InfoBanner variant="warning" title="Allergien / Unverträglichkeiten" message={selectedClient.allergies} /> : null}
        </SectionPanel>
        <SectionPanel title="Ärztliche Verordnung" subtitle="Präparat, Wirkstoff und Indikation">
          <PremiumInput label="Präparat *" value={name} onChangeText={value => change("name", value)} editable={!writeBlocked} />
          <View style={styles.twoCols}><PremiumInput label="Wirkstoff" value={activeIngredient} onChangeText={value => change("activeIngredient", value)} editable={!writeBlocked} /><PremiumInput label="Stärke" placeholder="z. B. 5 mg" value={strength} onChangeText={value => change("strength", value)} editable={!writeBlocked} /></View>
          <View style={styles.twoCols}><PremiumInput label="Darreichungsform" value={form} onChangeText={value => change("form", value)} editable={!writeBlocked} /><PremiumInput label="Applikationsweg" value={route} onChangeText={value => change("route", value)} editable={!writeBlocked} /></View>
          <PremiumInput label="Dosierung" placeholder="eindeutige Einzeldosis" value={dosage} onChangeText={value => change("dosage", value)} editable={!writeBlocked} />
          <PremiumInput label="Verordnet durch" placeholder="Ärztin / Arzt" value={prescribedBy} onChangeText={value => change("prescribedBy", value)} editable={!writeBlocked} />
          <PremiumInput label="Indikation" value={indication} onChangeText={value => change("indication", value)} editable={!writeBlocked} />
          <PremiumInput label="Einnahme- und Pflegehinweise" value={notes} onChangeText={value => change("notes", value)} editable={!writeBlocked} multiline />
        </SectionPanel>
        <SectionPanel title="Gabeplan" subtitle="Morgens · mittags · abends · nachts">
          <View pointerEvents={writeBlocked ? "none" : "auto"}><CareMedicationScheduleInput label="Regelmedikation" value={schedule} onChange={value => change("schedule", value)} schemaKey={schemaKey} onSchemaKeyChange={value => change("schemaKey", value)} /></View>
          <Text style={styles.fieldLabel}>Bedarfsmedikation</Text><FilterChipGroup options={yesNo} value={isPrn ? 'yes' : 'no'} onChange={value => change("isPrn", value === "yes")} />
          {isPrn ? <PremiumInput label="Bedarfsindikation / Grenzwert *" placeholder="z. B. Schmerz NRS ≥ 4; max. Tagesdosis beachten" value={prnReason} onChangeText={value => change("prnReason", value)} editable={!writeBlocked} multiline /> : null}
        </SectionPanel>
        <SectionPanel title="Medikationssicherheit" subtitle="Kennzeichnung und Gegenkontrolle">
          <Text style={styles.fieldLabel}>Hochrisikomedikament</Text><FilterChipGroup options={yesNo} value={isHighAlert ? 'yes' : 'no'} onChange={value => change("isHighAlert", value === "yes")} />
          <Text style={styles.fieldLabel}>Betäubungsmittel (BtM)</Text><FilterChipGroup options={yesNo} value={isControlled ? 'yes' : 'no'} onChange={value => change("isControlled", value === "yes")} />
          <Text style={styles.fieldLabel}>Intensivpflegerelevant</Text><FilterChipGroup options={yesNo} value={intensive ? 'yes' : 'no'} onChange={value => change("intensive", value === "yes")} />
          {intensive ? <><Text style={styles.fieldLabel}>Pumpengabe</Text><FilterChipGroup options={yesNo} value={pumpRequired ? 'yes' : 'no'} onChange={value => change("pumpRequired", value === "yes")} /><View style={styles.twoCols}><PremiumInput label="Laufgeschwindigkeit" placeholder="z. B. 2 ml/h" value={infusionRate} onChangeText={value => change("infusionRate", value)} editable={!writeBlocked} /><PremiumInput label="Verdünnung / Trägerlösung" value={dilution} onChangeText={value => change("dilution", value)} editable={!writeBlocked} /></View></> : null}
        </SectionPanel>
        <View style={styles.actions}><PremiumButton title={status === 'busy' ? 'Wird gespeichert…' : 'Verordnung speichern'} disabled={writeBlocked || !clientId || !name.trim()} onPress={() => { void handleSave(); }} /><PremiumButton title="Abbrechen" variant="secondary" disabled={(['busy','uncertain'] as readonly string[]).includes(status)} onPress={() => { void handleLeave(); }} /></View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  fieldLabel: { ...typography.label, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs },
  twoCols: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
