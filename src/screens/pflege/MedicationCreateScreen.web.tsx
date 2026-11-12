import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { CareMedicationScheduleInput } from '@/components/inputs/CareMedicationScheduleInput';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { MedicationOrderFieldOptions, MedicationPackagePicker, MedicationPhysicianPicker, medicationPackageKey } from '@/components/pflege/MedicationReferenceInputs';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { careAssessmentRuntimeAccess } from '@/lib/careAssessment/careAssessmentRuntimeAccess.web';
import { formatIntakeSchemaShort } from '@/lib/formatters/unitFormatters';
import { confirmAction } from '@/lib/platform/confirmAction';
import { createLiveMedication, fetchMedicationClientOptions, type CreateMedicationInput } from '@/lib/pflege/medicationLiveService';
import { assertMedicationCreateReceipt, readMedicationCreateReceipt } from '@/lib/pflege/medicationCreateReceipt.web';
import type { MedicationPackageOption, PhysicianOption } from '@/lib/pflege/medicationMasterData';
import { getMedicationPlanImport, getMedicationPlanOrderLink } from '@/lib/pflege/medicationPlanImportService';
import { takeMedicationPlanOrderHandoff } from '@/lib/pflege/medicationPlanOrderHandoff';
import { prepareMedicationPlanOrderPrefill, type MedicationPlanOrderPrefill } from '@/lib/pflege/medicationPlanOrderPrefill';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import type { RoleKey, ServiceResult } from '@/types';
import type { MedicationClientOption } from '@/types/modules/pflege';
import { colors, spacing, typography } from '@/theme';

type Owner = { tenantId: string; profileId: string; role: RoleKey };
type Status = 'idle' | 'busy' | 'uncertain' | 'confirmed';
type Form = {
  clientSearch: string; clientId: string; name: string; activeIngredient: string; strength: string; form: string;
  dosage: string; route: string; prescribedBy: string; indication: string; notes: string;
  productPzn: string; productBrand: string; productManufacturer: string; productCatalogSource: string; productCatalogVersion: string;
  prescriberDirectoryId: string;
  bmpStartDate: string;
  schedule: { morning: number; noon: number; evening: number; night: number }; schemaKey: string;
  isPrn: boolean; prnReason: string; isHighAlert: boolean; isControlled: boolean; intensive: boolean;
  pumpRequired: boolean; infusionRate: string; dilution: string;
};
type ClientRead = { ticket: symbol; owner: Owner; clients: MedicationClientOption[] };
type Attempt = { owner: Owner; ticket: symbol; form: Form; clients: MedicationClientOption[]; client: MedicationClientOption; payload: CreateMedicationInput; receiptId: string | null; saved: Record<string, unknown> | null };
type OriginalWrite = { attempt: Attempt; ticket: symbol; original: Pick<Attempt, 'owner' | 'form' | 'clients' | 'client' | 'payload'>; receiptId: string | null };
type ReadReceipt = { attempt: Attempt; ticket: symbol; original: OriginalWrite['original']; id: string; raw: Record<string, unknown> };
type Props = { owner: Owner | null; runtimeTenant: string | null; runtimeRole: RoleKey | null; canView: boolean; canManage: boolean; roleLabel: string | null; bmpToken?: string | string[]; bmpAllowed: boolean };
type BmpCoordinates = NonNullable<ReturnType<typeof takeMedicationPlanOrderHandoff>>;
type BmpSource = { coords: BmpCoordinates; prefill: Extract<MedicationPlanOrderPrefill, { scheduleStatus: 'manual' }>; fileName: string };
type BmpLoad = { ticket: symbol; source?: BmpSource; linkedId?: string; error?: string };

const yesNo = [{ key: 'no', label: 'Nein' }, { key: 'yes', label: 'Ja' }];
const initialForm: Form = {
  clientSearch: '', clientId: '', name: '', activeIngredient: '', strength: '', form: '', dosage: '', route: '',
  productPzn: '', productBrand: '', productManufacturer: '', productCatalogSource: '', productCatalogVersion: '',
  prescriberDirectoryId: '', bmpStartDate: '',
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

function preparePayload(value: Form, bmp?: BmpSource): CreateMedicationInput {
  if (!validForm(value) || !woundUuid(value.clientId) || !value.name.trim()) throw Error('Klient:in und Präparat sind erforderlich.');
  if (value.isPrn && !value.prnReason.trim()) throw Error('Für Bedarfsmedikation ist eine eindeutige Indikation erforderlich.');
  if (value.pumpRequired && !value.infusionRate.trim()) throw Error('Bei Pumpengabe ist die Laufgeschwindigkeit erforderlich.');
  if (bmp) {
    const date = value.bmpStartDate;
    if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      throw Error('Bitte den bestätigten Therapiebeginn als gültiges Datum (JJJJ-MM-TT) eintragen.');
    }
    if (!value.dosage.trim() || !value.route.trim() || !value.prescribedBy.trim()) {
      throw Error('Bitte Einzeldosis mit Einheit, Applikationsweg und verordnende Person anhand der Verordnung ergänzen.');
    }
    if (value.clientId !== bmp.coords.clientId || value.isPrn || value.dosage.trim() !== bmp.prefill.expectedDose
      || !(['morning', 'noon', 'evening', 'night'] as const).every(slot => value.schedule[slot] === bmp.prefill.expectedSchedule[slot])) {
      throw Error('Einzeldosis mit Einheit und die vier Tageswerte müssen mit der geprüften Position übereinstimmen.');
    }
  }
  return {
    clientId: value.clientId, name: value.name, activeIngredient: value.activeIngredient, strength: value.strength, form: value.form,
    dosage: value.dosage, route: value.route, prescribedBy: value.prescribedBy, indication: value.indication, notes: value.notes,
    productPzn: value.productPzn, productBrand: value.productBrand, productManufacturer: value.productManufacturer,
    productCatalogSource: value.productCatalogSource, productCatalogVersion: value.productCatalogVersion,
    prescriberDirectoryId: value.prescriberDirectoryId,
    startDate: bmp ? value.bmpStartDate : new Date().toISOString().slice(0, 10),
    ...(bmp ? { bmpImportId: bmp.coords.importId, bmpRowIndex: bmp.coords.rowIndex } : {}),
    schedule: value.isPrn ? 'Bei Bedarf' : formatIntakeSchemaShort(value.schedule.morning, value.schedule.noon, value.schedule.evening, value.schedule.night),
    morningDose: String(value.schedule.morning || ''), noonDose: String(value.schedule.noon || ''), eveningDose: String(value.schedule.evening || ''), nightDose: String(value.schedule.night || ''),
    isPrn: value.isPrn, prnReason: value.prnReason, isHighAlert: value.isHighAlert, isControlledSubstance: value.isControlled,
    intensiveCareRelevant: value.intensive, infusionRate: value.infusionRate, dilution: value.dilution, pumpRequired: value.pumpRequired,
  };
}

export function MedicationCreateScreen() {
  const { bmp } = useLocalSearchParams<{ bmp?: string | string[] }>();
  const { profile } = useAuth();
  const runtimeTenant = useServiceTenantId();
  const permissions = usePermissions();
  const owner: Owner | null = profile && woundUuid(profile.tenantId) && woundUuid(profile.id) && profile.roleKey
    ? { tenantId: profile.tenantId!, profileId: profile.id, role: profile.roleKey } : null;
  // Permission/runtime readiness is deliberately absent from this native mount key.
  return <MedicationCreateEditor key={JSON.stringify([owner, bmp])} owner={owner} runtimeTenant={runtimeTenant}
    runtimeRole={permissions.roleKey} canView={permissions.can('pflege.medications.view')}
    canManage={permissions.can('pflege.medications.manage')} roleLabel={permissions.roleLabel} bmpToken={bmp}
    bmpAllowed={bmp !== undefined && permissions.can('pflege.access') && permissions.can('office.clients.view') && permissions.can('office.clients.view_sensitive')} />;
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
  const [bmpLoad, setBmpLoad] = useState<BmpLoad | null>(null);
  const bmpCoords = useRef<BmpCoordinates | null | undefined>(undefined);
  const bmpLoadedTicket = useRef<symbol | null>(null);
  const bmpMode = props.bmpToken !== undefined;
  const confirmingWrite = useRef(false);
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
  const queryKey = JSON.stringify([owner, props.runtimeTenant, props.runtimeRole, props.canView, props.canManage, canLoadClients, props.bmpAllowed]);
  const readBoundary = useRef({ key: queryKey, ticket: Symbol('medication-client-read') });
  if (readBoundary.current.key !== queryKey) readBoundary.current = { key: queryKey, ticket: Symbol('medication-client-read') };
  const ownReadKey = JSON.stringify([owner, props.owner, props.runtimeTenant, props.runtimeRole, props.canView, access.canRead, props.bmpAllowed]);
  const ownReadBoundary = useRef({ key: ownReadKey, ticket: Symbol('medication-original-read') });
  if (ownReadBoundary.current.key !== ownReadKey) ownReadBoundary.current = { key: ownReadKey, ticket: Symbol('medication-original-read') };
  const runtime = useRef({ owner: props.owner, access, canLoadClients, bmpAllowed: props.bmpAllowed, ticket: readBoundary.current.ticket });
  runtime.current = { owner: props.owner, access, canLoadClients, bmpAllowed: props.bmpAllowed, ticket: readBoundary.current.ticket };
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
  const bmpSource = bmpLoad?.ticket === runtime.current.ticket && props.bmpAllowed ? bmpLoad.source : undefined;
  function writable() { return nativeCurrent() && runtime.current.access.canManage && latest.current.ready
    && (!bmpMode || (!!bmpSource && runtime.current.bmpAllowed && bmpLoad?.ticket === runtime.current.ticket))
    && !confirmingWrite.current && !flight.current && !readFlight.current && statusRef.current === 'idle'; }
  useEffect(() => {
    if (!bmpMode || !props.bmpAllowed || !ready || !owner || statusRef.current !== 'idle') return;
    const ticket = runtime.current.ticket;
    if (bmpLoadedTicket.current === ticket) return;
    let stopped = false;
    const current = () => !stopped && readCurrent(ticket) && runtime.current.bmpAllowed && latest.current.ready;
    if (bmpCoords.current === undefined) bmpCoords.current = typeof props.bmpToken === 'string'
      ? takeMedicationPlanOrderHandoff(props.bmpToken, { tenantId: owner.tenantId, actorId: owner.profileId }) : null;
    const coords = bmpCoords.current;
    function publish(result: Omit<BmpLoad, 'ticket'>) {
      if (!current()) return;
      bmpLoadedTicket.current = ticket;
      setBmpLoad({ ticket, ...result });
    }
    if (!coords || !latest.current.clients.some(client => client.id === coords.clientId)) {
      publish({ error: 'Die Übergabe ist abgelaufen oder die zugeordnete Akte ist nicht im aktuellen Pflegebestand. Bitte die Position erneut in der Akte öffnen.' });
      return;
    }
    void (async () => {
      try {
        const scope = { tenantId: owner.tenantId, actorId: owner.profileId, isCurrent: current };
        const original = await getMedicationPlanImport(scope, coords.importId, coords.clientId);
        const row = original.plan.rows[coords.rowIndex];
        const prefill = row && original.confirmed.some(item => item.rowIndex === coords.rowIndex) ? prepareMedicationPlanOrderPrefill(row) : null;
        if (!prefill || prefill.scheduleStatus === 'unsupported') {
          publish({ error: prefill?.scheduleMessage ?? 'Diese Position ist nicht als einzeln bestätigte Verordnung verfügbar.' });
          return;
        }
        if (!current()) return;
        const linkedId = await getMedicationPlanOrderLink(scope, coords.importId, coords.clientId, coords.rowIndex);
        if (!current()) return;
        if (linkedId) { publish({ linkedId }); return; }
        setValue(clone({ ...initialForm, ...prefill.fields, clientId: coords.clientId }));
        publish({ source: { coords, prefill, fileName: original.fileName } });
      } catch (cause) {
        publish({ error: cause instanceof Error ? cause.message : 'Die geprüfte Position konnte nicht gelesen werden.' });
      }
    })();
    return () => { stopped = true; };
  }, [bmpMode, owner, props.bmpAllowed, props.bmpToken, queryKey, ready]);
  function update(patch: Partial<Form>) {
    if (!writable()) return;
    const nextValue = clone({ ...latest.current.value, ...patch });
    if (!validForm(nextValue)) return;
    if (patch.clientId !== undefined && (bmpMode || !validateClients(latest.current.clients).some(client => client.id === patch.clientId))) return;
    latest.current.value = nextValue;
    setValue(nextValue); setError(null);
  }
  const withoutPackage = { productPzn: '', productBrand: '', productManufacturer: '', productCatalogSource: '', productCatalogVersion: '' };
  function change<K extends keyof Form>(key: K, next: Form[K]) {
    const changed = latest.current.value[key] !== next;
    const unlinkPackage = changed && (['name', 'activeIngredient', 'strength', 'form'] as readonly string[]).includes(key);
    update({
      ...(unlinkPackage ? withoutPackage : {}),
      ...(changed && key === 'prescribedBy' ? { prescriberDirectoryId: '' } : {}),
      [key]: next,
    });
  }
  function pickPackage(item: MedicationPackageOption) {
    // Identification only; catalog rows must never supply the dose, route or schedule.
    update({
      name: item.name, activeIngredient: item.ingredient ?? '', strength: item.strength ?? '', form: item.dosageForm ?? '',
      productPzn: item.pzn, productBrand: item.brand ?? '', productManufacturer: item.manufacturer ?? '',
      productCatalogSource: item.source, productCatalogVersion: item.sourceVersion,
    });
  }
  function pickPhysician(item: PhysicianOption) {
    if (!woundUuid(item.id)) return;
    update({ prescribedBy: item.displayName, prescriberDirectoryId: item.id });
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
    return originalCurrent(captured) && runtime.current.access.canRead && ownReadBoundary.current.ticket === ticket
      && (!captured.payload.bmpImportId || runtime.current.bmpAllowed);
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
      const form = clone(latest.current.value), pool = validateClients(latest.current.clients), payload = preparePayload(form, bmpSource);
      const client = pool.find(row => row.id === form.clientId);
      if (!client) throw Error('Der gewählte native Klient ist im aktuellen Benutzerbezug nicht enthalten.');
      captured = { owner: clone(owner), ticket: runtime.current.ticket, form, clients: pool, client: clone(client), payload: clone(payload), receiptId: null, saved: null };
    } catch (cause) { if (nativeCurrent()) setError(cause instanceof Error ? cause.message : 'Die Angaben konnten nicht vorbereitet werden.'); return; }
    if (bmpSource) {
      confirmingWrite.current = true;
      let accepted = false;
      try {
        accepted = await latest.current.confirm({ title: 'Aktive Verordnung anlegen?',
          message: 'Bitte bestätigen: Präparat, Einzeldosis mit Einheit, Tageswerte, Applikationsweg, verordnende Person, Therapiebeginn und Sicherheitsangaben wurden geprüft.',
          confirmLabel: 'Aktive Verordnung speichern', cancelLabel: 'Weiter prüfen' });
      } catch { return; }
      finally { confirmingWrite.current = false; }
      if (!accepted || !writable() || !readCurrent(captured.ticket) || !same(captured.form, latest.current.value)
        || !same(captured.clients, latest.current.clients)) return;
    }
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
    if (!captured || (!woundUuid(captured.receiptId) && !captured.payload.bmpImportId) || flight.current || readFlight.current
      || (statusRef.current !== 'uncertain' && statusRef.current !== 'confirmed') || !ownOriginalRead(captured, ticket)) return;
    // Read only: preserve the original write and returned identity, without invoking creation again.
    readFlight.current = true; if (nativeCurrent()) setConfirmingRead(true);
    try {
      if (!captured.receiptId && captured.payload.bmpImportId && captured.payload.bmpRowIndex !== undefined) {
        const linkedId = await getMedicationPlanOrderLink({ tenantId: captured.owner.tenantId, actorId: captured.owner.profileId,
          isCurrent: () => ownOriginalRead(captured, ticket) }, captured.payload.bmpImportId, captured.client.id, captured.payload.bmpRowIndex);
        if (!linkedId || !ownOriginalRead(captured, ticket) || originalWrite.current?.attempt !== captured) throw Error('Noch kein eigener Anlagenbeleg verfügbar.');
        captured.receiptId = linkedId;
        originalWrite.current.receiptId = linkedId;
      }
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
  function canLeave() { return nativeCurrent() && !confirmingWrite.current && !flight.current && !readFlight.current
    && statusRef.current !== 'busy' && (statusRef.current !== 'uncertain' || !!attempt.current?.payload.bmpImportId); }
  async function handleLeave(action?: () => void) {
    if (!canLeave() || leaving.current) return;
    const captured = leaveSnapshot(), ticket = runtime.current.ticket; leaving.current = true;
    try {
      const dirty = statusRef.current !== 'confirmed' && !same(latest.current.value, initialForm);
      const accepted = !dirty || await latest.current.confirm(statusRef.current === 'uncertain'
        ? { title: 'Speicherergebnis noch offen', message: 'Sie können die Position später in der Akte erneut öffnen und prüfen, ob bereits eine Verordnung dazu besteht.', confirmLabel: 'Zurück zur Akte', cancelLabel: 'Hier bleiben' }
        : { title: 'Ungespeicherte Eingaben', message: 'Möchten Sie die unveränderten Eingaben verwerfen und die Seite verlassen?', confirmLabel: 'Eingaben verwerfen', cancelLabel: 'Weiter bearbeiten' });
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
  const writeBlocked = !ready || !access.canManage || status !== 'idle' || (bmpMode && !bmpSource);
  const { clientSearch, clientId, name, activeIngredient, strength, form, dosage, route, prescribedBy, indication, notes,
    schedule, schemaKey, isPrn, prnReason, isHighAlert, isControlled, intensive, pumpRequired, infusionRate, dilution } = value;
  const directoryAccess = { tenantId: owner?.tenantId ?? '', enabled: !writeBlocked, canEditNow: writable };
  const productSummary = value.productPzn ? [
    `PZN ${value.productPzn}`, value.productBrand ? `Marke: ${value.productBrand}` : '',
    value.productManufacturer ? `Hersteller: ${value.productManufacturer}` : '',
    [value.productCatalogSource, value.productCatalogVersion].filter(Boolean).join(' · '),
  ].filter(Boolean).join(' · ') : '';
  const roleLabel = props.roleLabel;
  const filteredClients = useMemo(() => {
    const needle = clientSearch.trim().toLocaleLowerCase('de-DE');
    return clients.filter(client => !needle || client.label.toLocaleLowerCase('de-DE').includes(needle)).slice(0, 40);
  }, [clients, clientSearch]);
  const selectedClient = clients.find(client => client.id === clientId);
  const knownOriginal = attempt.current;
  const readableReceipt = currentOriginalReceipt();
  const canConfirmKnown = !!knownOriginal && (woundUuid(knownOriginal.receiptId) || !!knownOriginal.payload.bmpImportId) && ownOriginalRead(knownOriginal, ownReadBoundary.current.ticket)
    && !flight.current && !readFlight.current;
  if (status === 'uncertain' || status === 'confirmed') return <ScreenShell title={readableReceipt ? 'Anlagenbeleg gelesen' : 'Anlagenbeleg prüfen'} showBack={false}>
    {access.canRead && nativeCurrent() ? <>
      {readableReceipt ? <SuccessState message="Der ursprüngliche Anlageninhalt wurde unter seiner nativen Kennung im eigenen Mandanten- und Klientenbezug gelesen. Eine ärztliche Freigabe oder tatsächliche Durchführung ist damit nicht bestätigt." /> : status === 'confirmed' ? <InfoBanner variant="info" title="Frühere Rücklesung erhalten" message="Der frühere Anlagenbeleg ist keine aktuelle Lesebestätigung. Bitte das Speicherergebnis unter den aktuellen eigenen Leserechten erneut prüfen." /> : <ErrorState message={error ?? 'Das Speicherergebnis ist nicht bestätigt.'} />}
      <InfoBanner variant="warning" title="Ursprüngliche Angaben erhalten" message={knownOriginal?.payload.bmpImportId
        ? 'Das Speicherergebnis lässt sich anhand der Position im Originalplan erneut lesen. Dabei wird keine weitere Verordnung angelegt.'
        : 'Eine sichere erneute Anlage ist nicht verfügbar. Eine bereits zurückgegebene Kennung kann ausschließlich lesend mit dem ursprünglichen Auftrag abgeglichen werden. Ohne Kennung bleibt das Ergebnis ungeklärt. Der lokale Originalauftrag kann bei Neuladen verloren gehen.'} />
    </> : <ErrorState message="Der aktuelle eigene Benutzerbezug oder das erforderliche Leserecht ist nicht verfügbar. Der ursprüngliche Speicherstand bleibt gesperrt." />}
    <PremiumButton title={confirmingRead ? 'Anlagenbeleg wird gelesen…' : 'Speicherergebnis erneut lesen'} disabled={!canConfirmKnown} onPress={() => { void confirmKnownOriginal(); }} />
    <PremiumButton title="Gespeicherte Verordnung öffnen" disabled={!readableReceipt} onPress={openCreated} />
    <PremiumButton title="Zurück" disabled={(status === 'uncertain' && !knownOriginal?.payload.bmpImportId) || confirmingRead} variant="secondary" onPress={() => { void handleLeave(); }} />
  </ScreenShell>;
  if (!canLoadClients || !ready) return <ScreenShell title="Medikation anlegen" onBack={() => { void handleLeave(); }}>
    {canLoadClients && clientsQuery.loading ? <LoadingState message="Klientenbestand wird geladen…" /> : <ErrorState message={poolError ?? clientsQuery.error ?? clientsQuery.refreshError ?? 'Der aktuelle Benutzerbezug oder die erforderlichen Rechte sind nicht verfügbar.'} />}
    <PremiumButton title="Klientenbestand erneut laden" disabled={!canLoadClients} onPress={reloadClients} />
    <PremiumButton title="Zurück" disabled={(['busy','uncertain'] as readonly string[]).includes(status)} variant="secondary" onPress={() => { void handleLeave(); }} />
  </ScreenShell>;
  if (bmpMode && !bmpSource) {
    const result = bmpLoad?.ticket === runtime.current.ticket && props.bmpAllowed ? bmpLoad : null;
    return <ScreenShell title="Position aus Medikationsplan" onBack={() => { void handleLeave(); }}>
      {!props.bmpAllowed ? <ErrorState message="Der Zugriff auf den bestätigten Medikationsplan fehlt." />
        : result?.error ? <ErrorState message={result.error} />
          : result?.linkedId ? <>
            <InfoBanner variant="info" title="Position bereits übernommen" message="Zu dieser Planposition besteht bereits eine Verordnung." />
            <PremiumButton title="Vorhandene Verordnung öffnen" onPress={() => {
              if (readCurrent(result.ticket) && runtime.current.bmpAllowed && result.linkedId) latest.current.open(result.linkedId);
            }} />
          </> : <LoadingState message="Geprüfte Position wird aus der Akte geladen…" />}
      <PremiumButton title="Zurück" variant="secondary" onPress={() => { void handleLeave(); }} />
    </ScreenShell>;
  }
  return (
    <ScreenShell title="Medikation anlegen" subtitle={`Ambulante Pflege und Intensivpflege · ${roleLabel ?? 'Pflegefachkraft'}`} onBack={() => { void handleLeave(); }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <InfoBanner variant="info" title="Verordnung erfassen" message="Gespeicherte Angaben sind keine ärztliche Freigabe oder bestätigte Durchführung. Originalquelle und fachliche Prüfung bleiben gesondert erforderlich." />
        {error ? <ErrorState message={error} /> : null}
        <SectionPanel title="Klient:in" subtitle={bmpSource ? 'Mit der geprüften Planposition verknüpft' : 'Aktiver Versorgungsfall'}>
          {bmpSource ? <Text style={styles.originalValue}>{selectedClient?.label}</Text> : <>
            <PremiumInput label="Klient:in suchen" placeholder="Name eingeben" value={clientSearch} onChangeText={value => change("clientSearch", value)} editable={!writeBlocked} />
            <FilterChipGroup options={filteredClients.map((client) => ({ key: client.id, label: client.label }))} value={clientId} onChange={value => change("clientId", value)} />
          </>}
          {selectedClient?.allergies ? <InfoBanner variant="warning" title="Allergien / Unverträglichkeiten" message={selectedClient.allergies} /> : null}
        </SectionPanel>
        {bmpSource ? <SectionPanel title={`Geprüfte Originalposition ${bmpSource.coords.rowIndex + 1}`} subtitle={bmpSource.fileName}>
          <View style={styles.twoCols}>
            {bmpSource.prefill.originalFields.filter(item => item.value.trim()).map(item => <View key={item.label} style={styles.column}>
              <Text style={styles.fieldLabel}>{item.label}</Text><Text selectable style={styles.originalValue}>{item.value}</Text>
            </View>)}
          </View>
          <PremiumInput label="Bestätigter Therapiebeginn *" placeholder="JJJJ-MM-TT" value={value.bmpStartDate} maxLength={10}
            onChangeText={date => change('bmpStartDate', date)} editable={!writeBlocked} />
        </SectionPanel> : null}
        <SectionPanel title="Präparat" subtitle="Passende Packung auswählen oder Angaben aus der Verordnung erfassen">
          <MedicationPackagePicker {...directoryAccess} selectedKey={value.productPzn
            ? medicationPackageKey({ pzn: value.productPzn, source: value.productCatalogSource }) : undefined} onPick={pickPackage} />
          {productSummary ? <InfoBanner variant="info" title="Ausgewählter Präparateintrag" message={productSummary} /> : null}
          {productSummary ? <PremiumButton title="Verzeichnisbezug lösen" variant="ghost" size="sm"
            disabled={writeBlocked} onPress={() => update(withoutPackage)} /> : null}
          <PremiumInput label="Präparat *" accessibilityLabel="Präparat" value={name} onChangeText={value => change("name", value)} editable={!writeBlocked} />
          <View style={styles.twoCols}>
            <View style={styles.column}><PremiumInput label="Wirkstoff" accessibilityLabel="Wirkstoff" value={activeIngredient} onChangeText={value => change("activeIngredient", value)} editable={!writeBlocked} /></View>
            <View style={styles.column}><PremiumInput label="Stärke" accessibilityLabel="Stärke" placeholder="Angabe aus der Verordnung" value={strength} onChangeText={value => change("strength", value)} editable={!writeBlocked} /></View>
          </View>
          <View style={styles.field}>
            <PremiumInput label="Darreichungsform" accessibilityLabel="Darreichungsform" value={form} onChangeText={value => change("form", value)} editable={!writeBlocked} />
            <MedicationOrderFieldOptions kind="form" value={form} enabled={!writeBlocked} onSelect={next => change("form", next)} />
          </View>
        </SectionPanel>
        <SectionPanel title="Ärztliche Verordnung" subtitle="Verordnende Person, Gabe und Indikation">
          <MedicationPhysicianPicker {...directoryAccess} prescribedBy={prescribedBy} selectedId={value.prescriberDirectoryId} onPick={pickPhysician} />
          <PremiumInput label="Verordnet durch" accessibilityLabel="Verordnet durch" placeholder="Ärztin oder Arzt" value={prescribedBy}
            hint={value.prescriberDirectoryId ? 'Aus dem Verzeichnis ausgewählt. Eine manuelle Namensänderung löst den Verzeichnisbezug.' : undefined}
            onChangeText={value => change("prescribedBy", value)} editable={!writeBlocked} />
          <View style={styles.field}>
            <PremiumInput label="Applikationsweg" accessibilityLabel="Applikationsweg" value={route} onChangeText={value => change("route", value)} editable={!writeBlocked} />
            <MedicationOrderFieldOptions kind="route" value={route} enabled={!writeBlocked} onSelect={next => change("route", next)} />
          </View>
          <View style={styles.field}>
            <PremiumInput label="Dosierung" accessibilityLabel="Dosierung" placeholder="Einzeldosis aus der Verordnung" value={dosage} onChangeText={value => change("dosage", value)} editable={!writeBlocked} />
            <MedicationOrderFieldOptions kind="dose" value={dosage} enabled={!writeBlocked} onSelect={next => change("dosage", next)} />
          </View>
          <PremiumInput label="Indikation" value={indication} onChangeText={value => change("indication", value)} editable={!writeBlocked} />
          <PremiumInput label="Einnahme- und Pflegehinweise" value={notes} onChangeText={value => change("notes", value)} editable={!writeBlocked} multiline />
        </SectionPanel>
        <SectionPanel title="Gabeplan" subtitle="Morgens · mittags · abends · nachts">
          {bmpSource ? <>
            <Text style={styles.originalValue}>Einzeldosis aus dem Original: {bmpSource.prefill.expectedDose}</Text>
            <PremiumButton title="Tageswerte aus dem Original übernehmen" variant="secondary"
              disabled={writeBlocked || dosage.trim() !== bmpSource.prefill.expectedDose}
              onPress={() => update({ schedule: clone(bmpSource.prefill.expectedSchedule), schemaKey: 'individuell' })} />
            {dosage.trim() !== bmpSource.prefill.expectedDose ? <Text style={styles.fieldLabel}>Zuerst die geprüfte Einzeldosis mit Einheit im Feld Dosierung eintragen.</Text> : null}
          </> : null}
          <View pointerEvents={writeBlocked ? "none" : "auto"}><CareMedicationScheduleInput label="Regelmedikation" value={schedule} onChange={value => change("schedule", value)} schemaKey={schemaKey} onSchemaKeyChange={value => change("schemaKey", value)} /></View>
          {!bmpSource ? <><Text style={styles.fieldLabel}>Bedarfsmedikation</Text><FilterChipGroup options={yesNo} value={isPrn ? 'yes' : 'no'} onChange={value => change("isPrn", value === "yes")} /></> : null}
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
  originalValue: { ...typography.body, color: colors.textPrimary },
  twoCols: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flexBasis: 200, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  field: { gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
