// Generated native presentation from src/screens/pflege/WoundCareScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { woundEditorAccess as captureWoundEditorAccess, isKnownWoundEditorRole, WoundEditorRequestGuard, type WoundEditorAccess } from "../../lib/pflege/woundEditorRequestGuard.native.ts";
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useWoundSubmission } from "../../hooks/pflege/useWoundSubmission.native.ts";
import { woundEditorAccess, type WoundEditorOwner } from "../../lib/pflege/woundEditorAccess.native.ts";
import { MedicationEventTimeInput, currentMedicationEventTime, medicationEventInstant } from "../../components/pflege/MedicationEventTimeInput.native.tsx";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { emptyWoundPlan, emptyWoundDressing, validateWoundCare, validateWoundOrder, validateWoundPlanChange, validateWoundDressingSnapshot, woundPlanAt, type WoundCareRequest, type WoundPlanDraft, type WoundDressingDraft, type WoundMaterial } from '@/lib/pflege/woundCareDomain';
import { fetchWoundCareContext, writeWoundCare, type WoundCareContext } from '@/lib/pflege/woundCareService';
import { fetchWoundCareWithTreatmentCorrections } from '@/lib/pflege/treatmentCorrectionService';
import { TreatmentCorrectionHistory } from "./TreatmentCorrectionScreen.native.tsx";
const display = (v: unknown) => typeof v === 'string' && v.trim() ? v : 'Nicht bestätigt / nicht dokumentiert';
const insurer = (v: unknown) => ({ not_required: 'Als nicht erforderlich gespeichert', pending: 'Entscheidung offen', approved: 'Genehmigt', rejected: 'Abgelehnt', expired: 'Abgelaufen' } as Record<string, string>)[String(v)] ?? 'Nicht bestätigt';
const time = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : 'Zeitpunkt nicht bestätigt';
export function WoundCareScreen({ mode, onClose, sessionOwner, accessBlocked = false }: {
    mode: 'plan' | 'dressing';
    onClose: () => void;
    sessionOwner?: WoundEditorOwner | null;
    accessBlocked?: boolean;
}) {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), tenant = useServiceTenantId(), { profile } = useAuth(), permissions = usePermissions();
    const stableOwner = useRef<WoundEditorOwner | null>(null);
    if (isKnownWoundEditorRole(profile?.roleKey) && woundUuid(profile?.tenantId) && woundUuid(profile?.id))
        stableOwner.current = { tenantId: profile.tenantId, profileId: profile.id, role: profile.roleKey };
    const latestNative = useRef({ tenant, profile, permissions, sessionOwner, accessBlocked, id, mode, owner: stableOwner.current });
    latestNative.current = { tenant, profile, permissions, sessionOwner, accessBlocked, id, mode, owner: stableOwner.current };
    const liveAccess = useRef<() => WoundEditorAccess>(() => {
        const { tenant, profile, permissions, sessionOwner, accessBlocked, id, mode, owner } = latestNative.current;
        const can = Object.getOwnPropertyDescriptor(permissions, 'can');
        if (!can || !Object.hasOwn(can, 'value') || typeof can.value !== 'function')
            throw Error('Aktuelle native Berechtigungsabfrage fehlt.');
        const grant = (key: Parameters<typeof permissions.can>[0]) => can.value(key) === true;
        const current = woundEditorAccess({ owner: sessionOwner === undefined ? owner : sessionOwner, profile, serviceTenant: tenant, runtimeTenant: permissions.tenantId, runtimeRole: permissions.roleKey, blocked: accessBlocked, canView: grant('pflege.wounds.view') && grant('pflege.orders.view') && (mode === 'plan' || grant('pflege.treatment.view')), canManage: grant('pflege.wounds.manage') && (mode === 'plan' || grant('pflege.treatment.manage')) });
        return captureWoundEditorAccess({ originalOwner: current.owner, tenantId: tenant, profileTenantId: profile?.tenantId, profileId: profile?.id, profileRole: profile?.roleKey, runtimeTenantId: permissions.tenantId, runtimeRole: permissions.roleKey, sourceId: id ?? '', woundId: id ?? '', kind: 'care', action: mode, canRead: current.canView, canManage: grant('pflege.wounds.manage') && (mode === 'plan' || grant('pflege.treatment.manage')), readDressings: grant('pflege.treatment.view') });
    });
    const access = woundEditorAccess({ owner: sessionOwner === undefined ? stableOwner.current : sessionOwner, profile, serviceTenant: tenant, runtimeTenant: permissions.tenantId, runtimeRole: permissions.roleKey, blocked: accessBlocked, canView: permissions.can('pflege.wounds.view') && permissions.can('pflege.orders.view') && (mode === 'plan' || permissions.can('pflege.treatment.view')), canManage: permissions.can('pflege.wounds.manage') && (mode === 'plan' || permissions.can('pflege.treatment.manage')) });
    const guardAccess = { ...captureWoundEditorAccess({ originalOwner: access.owner, tenantId: tenant, profileTenantId: profile?.tenantId, profileId: profile?.id, profileRole: profile?.roleKey, runtimeTenantId: permissions.tenantId, runtimeRole: permissions.roleKey, sourceId: id ?? '', woundId: id ?? '', kind: 'care', action: mode, canRead: access.canView, canManage: permissions.can('pflege.wounds.manage') && (mode === 'plan' || permissions.can('pflege.treatment.manage')), readDressings: permissions.can('pflege.treatment.view') }), liveAccess: liveAccess.current };
    return <CareForm access={guardAccess} key={`${access.key}:${id}:${mode}`} id={id ?? ''} tenant={access.owner?.tenantId ?? ''} mode={mode} role={access.owner?.role ?? null} readDressings={access.canView && permissions.can('pflege.treatment.view')} canView={access.canView} canManage={access.canManage} onClose={onClose}/>;
}
function CareForm({ access, id, tenant, mode, role, canView, canManage, onClose, readDressings }: {
    access: WoundEditorAccess;
    readDressings: boolean;
    id: string;
    tenant: string;
    mode: 'plan' | 'dressing';
    role: ReturnType<typeof usePermissions>['roleKey'];
    canView: boolean;
    canManage: boolean;
    onClose: () => void;
}) {
    const guard = useRef(new WoundEditorRequestGuard<WoundCareRequest>(access));
    guard.current.update(access);
    const readEpoch = guard.current.readEpoch;
    useEffect(() => { guard.current.mount(); return () => guard.current.dispose(); }, []);
    const styles = useStyles(), [draft, setDraft] = useState<Record<string, string>>(() => mode === 'plan' ? { ...emptyWoundPlan() } : { ...emptyWoundDressing() }), [at, setAt] = useState(currentMedicationEventTime), [until, setUntil] = useState(currentMedicationEventTime), [hasEnd, setHasEnd] = useState(false), [review, setReview] = useState(currentMedicationEventTime), [edited, setEdited] = useState(false), [confirmed, setConfirmed] = useState(false);
    const [materials, setMaterials] = useState<(WoundMaterial & {
        key: string;
    })[]>([]), baseline = useRef<WoundCareContext | null>(null);
    const q = useAsyncQuery(() => guard.current.read(readEpoch, () => fetchWoundCareContext(tenant, id, role, readDressings)), [access.readScope, tenant, id, role, mode, readDressings], { enabled: guard.current.canRead() && !!tenant && !!id && canView, queryKey: `${tenant}:${role}:${id}:${access.readScope}:wound-care-${mode}:${readDressings}` });
    guard.current.setView(q.data, q.loading || q.refreshing || !!q.error || !!q.refreshError || q.previewData || q.tableMissing || q.cacheMeta.fromCache || !!q.cacheMeta.partialDetail);
    const readTicket = guard.current.readTicket;
    const dirty = edited || materials.length > 0 || Object.entries(draft).some(([k, v]) => k !== 'materialsJson' && !!v);
    const write = useWoundSubmission<WoundCareRequest>(dirty && !confirmed, guard.current.canRead(), async (requestId, payload, replay) => guard.current.execute(requestId, payload, replay, () => writeWoundCare(tenant, requestId, payload, role, replay), readEpoch, readTicket, q.data), () => setConfirmed(true));
    function touch() { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
        return; baseline.current ??= q.data ?? null; setEdited(true); }
    function change(key: string, value: string) { if (write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed)
        return; touch(); setDraft(d => { const next = { ...d, [key]: value }; if (key === 'basisState') {
        if (Object.hasOwn(next, 'medicalOrderId'))
            next.medicalOrderId = '';
        if (Object.hasOwn(next, 'planId'))
            next.planId = '';
        next.basisReason = '';
    } for (const moment of ['painBefore', 'painAfter'])
        if (key === moment + 'State') {
            next[moment + 'Score'] = '';
            next[moment + 'Reason'] = '';
        } if (key === 'reviewStatus')
        next.reviewPendingReason = ''; return next; }); }
    const field = (key: string, label: string) => <PremiumInput key={key} label={label} accessibilityLabel={label} value={draft[key] ?? ''} onChangeText={v => change(key, v)} editable={!write.locked && guard.current.mayWrite(readEpoch, readTicket, q.data) && !confirmed} multiline maxLength={2000}/>;
    const choices = (key: string, options: {
        key: string;
        label: string;
    }[]) => <FilterChipGroup wrap options={options} value={draft[key] ?? ''} onChange={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed ? undefined : v => change(key, v)}/>;
    const source = guard.current.canShow(readEpoch, readTicket, q.data) ? (baseline.current && guard.current.sameCurrentOriginal(baseline.current) ? baseline.current : q.data) : null, order = source?.orders.find(o => o.id === draft.medicalOrderId);
    let candidate: Record<string, unknown> | null = null, planError: string | null = null;
    if (mode === 'dressing' && guard.current.canShow(readEpoch, readTicket, q.data) && q.data) {
        try {
            candidate = woundPlanAt(q.data.plans, medicationEventInstant(at));
        }
        catch (e) {
            planError = e instanceof Error ? e.message : 'Planzeitpunkt ungültig.';
        }
    }
    async function save() {
        if (!guard.current.canRead())
            return;
        if (write.uncertain) {
            await write.retry();
            return;
        }
        if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed) {
            write.setError('Aktuellen eigenen Originalstand und Schreibzugriff zuerst prüfen.');
            return;
        }
        if (baseline.current && !guard.current.sameCurrentOriginal(baseline.current)) {
            write.setError('Geladenen vollständigen Originalstand zuerst ausdrücklich als Grundlage prüfen.');
            return;
        }
        if (!q.data || q.refreshError || q.loading) {
            write.setError('Vollständigen Fall- und Versorgungsverlauf zuerst laden.');
            return;
        }
        const ctx = baseline.current ?? q.data, instant = medicationEventInstant(at);
        const d: Record<string, string> = { ...draft, nextReviewAt: draft.reviewStatus === 'scheduled' ? medicationEventInstant(review) : '' };
        if (mode === 'plan') {
            if (!['draft', 'active', 'healing', 'deteriorated'].includes(String(q.data.wound.row.status))) {
                write.setError('Planänderung benötigt einen offenen Wundfall.');
                return;
            }
            d.expectedPreviousId = String(ctx.plans[0]?.id ?? '');
            d.effectiveFrom = instant;
            d.effectiveUntil = hasEnd ? medicationEventInstant(until) : '';
            d.expectedOrderJson = d.basisState === 'linked' && order ? JSON.stringify(order) : '';
            const changeError = validateWoundPlanChange(d as unknown as WoundPlanDraft, q.data.plans[0] ?? null, q.data.dressings);
            if (changeError) {
                write.setError(changeError);
                return;
            }
            if (d.basisState === 'linked') {
                if (!order) {
                    write.setError('Vorhandene Anordnung auswählen.');
                    return;
                }
                const error = validateWoundOrder(order, tenant, String(ctx.wound.row.client_id), d.medicalOrderId, instant, d.effectiveUntil);
                if (error) {
                    write.setError(error);
                    return;
                }
            }
        }
        else {
            d.occurredAt = instant;
            d.materialsJson = JSON.stringify(materials.map(({ key, ...m }) => m));
            if (d.basisState === 'linked' && (!candidate || candidate.id !== d.planId || candidate.basis_state !== 'linked')) {
                write.setError('Zum tatsächlichen Zeitpunkt passende Planfassung mit zugeordneter Anordnung auswählen oder ungeklärte Grundlage ausdrücklich dokumentieren.');
                return;
            }
            const snapshotError = validateWoundDressingSnapshot(d as unknown as WoundDressingDraft, tenant, String(q.data.wound.row.client_id), id, q.data.plans, q.data.orders, q.data.wound.row.status, q.data.wound.lifecycle[0] ?? null);
            if (snapshotError) {
                write.setError(snapshotError);
                return;
            }
        }
        const payload: WoundCareRequest = { action: mode, woundId: id, dataJson: JSON.stringify(d) }, error = validateWoundCare(payload);
        if (error) {
            write.setError(error);
            return;
        }
        await write.submit(payload);
    }
    if (!guard.current.canRead() || (!canManage && !write.uncertain))
        return <ScreenShell title="Wundplanung und Versorgung"><ErrorState message="Wund-Lese-/Schreibrecht und Anordnungsleserecht erforderlich; für tatsächliche Versorgung zusätzlich Behandlungspflege-Lese-/Schreibrecht."/><PremiumButton title="Zur Wundakte" variant="secondary" onPress={() => { if (guard.current.mayClose(readEpoch) && !write.locked)
            onClose(); }}/></ScreenShell>;
    if (confirmed)
        return <ScreenShell title={mode === 'plan' ? 'Neue Planfassung gespeichert' : 'Tatsächliche Versorgung dokumentiert'}><SuccessState message={mode === 'plan' ? 'Neue dokumentierte Planfassung mit eigenem Änderungsgrund gespeichert. Vorherige Fassungen und bereits ausgeführte Versorgung bleiben erhalten. Das Speichern ist keine automatische Anordnung oder Qualifikationsfreigabe.' : 'Eigenständige Wundversorgung und zugehöriger Behandlungspflegenachweis gespeichert. Planbezug, Materialverbrauch, tatsächliches Ergebnis und Abweichungen bleiben erhalten; keine automatische Abrechnung.'}/><PremiumButton title="Gespeicherten Wundverlauf öffnen" disabled={write.busy} onPress={() => { if (guard.current.mayClose(readEpoch) && !write.locked)
            onClose(); }}/></ScreenShell>;
    if (!guard.current.canShow(readEpoch, readTicket, q.data))
        return <ScreenShell title="Ursprüngliche Wundanfrage"><ErrorState message={q.error ?? q.refreshError ?? 'Aktuellen vollständigen eigenen Originalbestand zuerst laden.'}/>{write.error ? <ErrorState message={write.error}/> : null}{write.uncertain ? <><InfoBanner variant="warning" message="Speicherbestätigung fehlt. Die ursprüngliche Anfrage bleibt erhalten; derselbe Originalauftrag kann mit eigenen aktuellen Leserechten erneut geprüft werden."/><PremiumButton title="Dieselbe ursprüngliche Anfrage erneut prüfen" disabled={write.busy} onPress={save}/></> : <PremiumButton title="Eigenen vollständigen Originalbestand laden" variant="secondary" onPress={q.refresh}/>}</ScreenShell>;
    return <ScreenShell title={mode === 'plan' ? 'Wundplan als neue Fassung dokumentieren' : 'Verbandwechsel / tatsächliche Versorgung dokumentieren'} subtitle={q.data ? `${q.data.wound.clientName} · ${display(q.data.wound.row.body_location)}` : undefined}><ScrollView contentContainerStyle={styles.content}>
 {q.loading && !q.data ? <LoadingState message="Wundfall, Planfassungen und Anordnungen werden vollständig geladen…"/> : !q.data ? <ErrorState message={q.error ?? 'Wundfall nicht zugänglich.'} onRetry={q.refresh}/> : null}
 {q.refreshError ? <ErrorState message={q.refreshError} onRetry={q.refresh}/> : null}{write.error ? <ErrorState message={write.error}/> : null}
 {write.uncertain ? <InfoBanner variant="warning" message="Speicherbestätigung fehlt. Angaben und Verlassen bleiben gesperrt; dieselbe unveränderte Anfrage erneut prüfen."/> : null}
 <SectionPanel title={mode === 'plan' ? 'Planzeitraum und Grundlage' : 'Tatsächlicher Zeitpunkt und Ergebnis'}>
 <MedicationEventTimeInput label={mode === 'plan' ? 'Beginn der neuen Planfassung' : 'Tatsächlicher Versorgungszeitpunkt'} value={at} disabled={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed} onChange={v => { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
        return; touch(); setAt(v); }}/>
 {mode === 'plan' ? <>
 <FilterChipGroup wrap options={[{ key: 'open', label: 'Kein gesondertes Planende festgelegt' }, { key: 'end', label: 'Gesondertes Planende festgelegt' }]} value={hasEnd ? 'end' : 'open'} onChange={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed ? undefined : v => { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
            return; touch(); setHasEnd(v === 'end'); }}/>{hasEnd ? <MedicationEventTimeInput label="Gesondertes Planende" value={until} disabled={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed} onChange={v => { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
            return; touch(); setUntil(v); }}/> : null}
 {choices('basisState', [{ key: 'linked', label: 'Vorhandene ärztliche Anordnung zuordnen' }, { key: 'pending', label: 'Grundlage / Abstimmung offen' }, { key: 'not_required', label: 'Nicht erforderlich – begründen' }])}
 {draft.basisState === 'linked' ? <>{choices('medicalOrderId', (source?.orders ?? []).map(o => ({ key: String(o.id), label: `${display(o.title)} · ${display(o.ordering_physician)} · ${display(o.valid_from)} bis ${o.valid_until ? display(o.valid_until) : 'ohne gespeichertes Ende'}` })))}{order ? <><Text style={styles.body}>Anordnungsinhalt: {display(order.description)}</Text><Text style={styles.body}>Ausführungsanweisungen: {display(order.execution_instructions)}</Text><Text style={styles.body}>Qualifikationsanforderung: {display(order.qualification_requirement)}</Text><Text style={styles.body}>Anordnungsstatus: {display(order.status)} · Kassenstatus: {insurer(order.insurer_approval_status)}</Text></> : null}</> : null}
 {field('basisReason', 'Wundbezug der Anordnung bzw. tatsächlicher Klärungsstand / Begründung *')}
 {field('professionalBasis', 'Tatsächlich erfolgte fachliche Beurteilung, Abstimmung und verantwortliche Personen *')}{field('changeReason', 'Tatsächlicher Grund für diese neue Planfassung *')}
 <InfoBanner variant="info" message="Die Anordnung wird mit ihrer vorhandenen Fassung zugeordnet. Häufigkeit, Dauer und Materialwahl werden fachlich dokumentiert; die Software leitet keine Behandlung oder Qualifikation automatisch ab."/>
 </> : <>
 {choices('outcome', [{ key: 'performed', label: 'Durchgeführt' }, { key: 'partial', label: 'Teilweise durchgeführt' }, { key: 'omitted', label: 'Nicht durchgeführt' }, { key: 'refused', label: 'Abgelehnt' }, { key: 'failed', label: 'Fehlgeschlagen' }])}
 {choices('basisState', [{ key: 'linked', label: 'Passende dokumentierte Planfassung zuordnen' }, { key: 'unconfirmed', label: 'Grundlage ungeklärt – tatsächlichen Vorgang dokumentieren' }])}
 {planError ? <ErrorState message={planError}/> : null}
 {draft.basisState === 'linked' ? candidate ? <>{choices('planId', [{ key: String(candidate.id), label: `Planfassung ${String(candidate.version)} · ab ${time(candidate.effective_from)}` }])}<Text style={styles.body}>Geplante Versorgung: {display((candidate.details as Record<string, unknown>)?.plannedCare)}</Text><Text style={styles.body}>Geplantes Material: {display((candidate.details as Record<string, unknown>)?.plannedMaterials)}</Text><Text style={styles.body}>Wechselintervall: {display((candidate.details as Record<string, unknown>)?.frequency)}</Text><Text style={styles.body}>Anordnungsbezug: {display(candidate.medical_order_id)}</Text></> : <InfoBanner variant="warning" message="Für den angegebenen Zeitpunkt wurde keine passende Planfassung gefunden. Tatsächliche Versorgung mit ungeklärter Grundlage ausdrücklich dokumentieren."/> : draft.basisState === 'unconfirmed' ? field('basisReason', 'Tatsächlicher Kenntnisstand zur fehlenden / ungeklärten Grundlage *') : null}
 {field('personDecision', 'Tatsächliche Zustimmung, Ablehnung, Wünsche oder Erhebungsgrenze *')}{field('qualificationBasis', 'Tatsächliche Qualifikations-/Delegationsgrundlage bzw. ausdrücklich ungeklärter Status *')}
 </>}
 </SectionPanel>
 {mode === 'plan' ? <SectionPanel title="Individuell abgestimmte geplante Versorgung">{field('goal', 'Individuelles Versorgungsziel *')}{field('plannedCare', 'Geplante Versorgung / Reinigung / Technik gemäß tatsächlicher Grundlage *')}{field('plannedMaterials', 'Tatsächlich vorgesehenes Material mit Anordnungs-/Abstimmungsbezug *')}{field('frequency', 'Tatsächlich festgelegtes Wechselintervall und verantwortliche Festlegung *')}{field('hygienePlan', 'Vorgesehenes hygienisches Vorgehen und Voraussetzungen *')}{field('painPlan', 'Abgestimmtes Schmerzmanagement / tatsächlicher Klärungsbedarf *')}{field('warningSigns', 'Abgestimmte Beobachtungen / Warnzeichen *')}{field('escalationPath', 'Verantwortliche Kontakte und vereinbartes Vorgehen bei Veränderung *')}{field('personDecision', 'Einbezogene Wünsche, Ressourcen und tatsächliche Entscheidung der Person *')}</SectionPanel> : <>
 <SectionPanel title="Tatsächliche Durchführung und Materialverbrauch">{field('actualCleaning', 'Tatsächlich erfolgte Reinigung oder begründete Nichtdurchführung *')}{field('actualTechnique', 'Tatsächlich erfolgte Versorgung / Verbandtechnik oder Nichtdurchführung *')}{field('hygiene', 'Tatsächliche hygienische Bedingungen, Maßnahmen und Abweichungen *')}
 {materials.map((m, i) => <View key={m.key} style={styles.group}><Text style={styles.body}>Materialposition {i + 1}</Text>{(['name', 'quantity', 'unit'] as const).map((key, j) => <PremiumInput key={key} label={['Tatsächliche Materialbezeichnung', 'Tatsächlich verbrauchte Menge', 'Einheit'][j]} value={m[key]} editable={!write.locked && guard.current.mayWrite(readEpoch, readTicket, q.data) && !confirmed} maxLength={200} onChangeText={value => { if (write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed)
            return; touch(); setMaterials(rows => rows.map(r => r.key === m.key ? { ...r, [key]: value } : r)); }}/>)}<FilterChipGroup wrap options={[{ key: 'wound', label: 'An der Wunde verwendet' }, { key: 'preparation', label: 'Zur Vorbereitung verbraucht' }, { key: 'waste', label: 'Verworfen' }]} value={m.purpose} onChange={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed ? undefined : value => { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
            return; touch(); setMaterials(rows => rows.map(r => r.key === m.key ? { ...r, purpose: value } : r)); }}/><PremiumButton title="Diese Materialposition entfernen" variant="secondary" disabled={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed} onPress={() => { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
            return; touch(); setMaterials(rows => rows.filter(r => r.key !== m.key)); }}/></View>)}
 <PremiumButton title="Tatsächliches Material ergänzen" variant="secondary" disabled={write.locked || materials.length >= 20} onPress={() => { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
            return; touch(); change('noMaterialReason', ''); setMaterials(rows => [...rows, { key: crypto.randomUUID(), name: '', quantity: '', unit: '', purpose: '' }]); }}/>
 {!materials.length ? field('noMaterialReason', 'Falls kein Material verbraucht: tatsächlicher Grund *') : null}
 </SectionPanel><SectionPanel title="Schmerz, Verträglichkeit und Abweichungen">{['painBefore', 'painAfter'].map((moment, i) => <View key={moment} style={styles.group}><Text style={styles.body}>{i === 0 ? 'Vor' : 'Nach'} der Versorgung</Text>{choices(moment + 'State', [{ key: 'NRS', label: 'NRS 0–10 tatsächlich erhoben' }, { key: 'not_assessable', label: 'Nicht beurteilbar / nicht erhoben – begründen' }])}{draft[moment + 'State'] === 'NRS' ? field(moment + 'Score', 'Tatsächlich erhobene ganze Zahl 0–10') : draft[moment + 'State'] === 'not_assessable' ? field(moment + 'Reason', 'Tatsächlicher Grund für fehlende Schmerzerhebung *') : null}</View>)}
 {field('response', 'Tatsächlich beobachtetes Ergebnis / Verträglichkeit oder Beurteilungsgrenze *')}{field('deviation', 'Tatsächliche Abweichung, Teil-/Nichtdurchführung, Ablehnung oder Fehlschlag (bei Abweichung erforderlich)')}{field('contact', 'Tatsächliche Rücksprache, offene Klärung / Eskalation oder begründet kein Kontaktbedarf *')}
 <InfoBanner variant="info" message="Geplantes Material wird nicht als verbraucht übernommen. Dieser Nachweis dokumentiert den tatsächlichen Vorgang und erstellt keine automatische Freigabe, Bestandsbuchung oder Abrechnung."/>
 </SectionPanel></>}
 <SectionPanel title="Weitere Kontrolle und Abstimmung">{choices('reviewStatus', [{ key: 'scheduled', label: 'Kontrolltermin vereinbart' }, { key: 'pending', label: 'Terminabstimmung offen' }])}{draft.reviewStatus === 'scheduled' ? <MedicationEventTimeInput label="Tatsächlich vereinbarter Kontrolltermin" value={review} disabled={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed} onChange={v => { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
        return; touch(); setReview(v); }}/> : draft.reviewStatus === 'pending' ? field('reviewPendingReason', 'Tatsächlicher Grund / weiterer Abstimmungsbedarf *') : null}</SectionPanel>
 <View style={styles.actions}><PremiumButton title={write.busy ? 'Wundversorgung wird gespeichert…' : write.uncertain ? 'Dieselbe Anfrage erneut prüfen' : mode === 'plan' ? 'Als neue Planfassung speichern' : 'Tatsächliche Versorgung speichern'} disabled={write.busy || (!write.uncertain && (!q.data || !!q.refreshError || q.loading))} onPress={save}/><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={write.locked} onPress={async () => { if (guard.current.mayClose(readEpoch) && !write.locked && await write.confirmLeave() && guard.current.mayClose(readEpoch) && !write.locked)
        onClose(); }}/></View>
 {!write.locked ? <><PremiumButton title="Aktuellen Fall- und Versorgungsverlauf neu laden" variant="secondary" onPress={q.refresh}/>{baseline.current && q.data ? <PremiumButton title="Geladenen Plan- und Anordnungsstand nach eigener Prüfung übernehmen" variant="secondary" onPress={() => { if (!guard.current.mayWrite(readEpoch, readTicket, q.data) || write.locked || confirmed)
        return; baseline.current = q.data; setEdited(true); setDraft(d => ({ ...d })); write.setError(null); }}/> : null}</> : null}
 </ScrollView></ScreenShell>;
}
import { useEffect } from 'react';
import { captureWoundCareHistoricalOriginals, sameWoundCareHistoricalOriginals, type WoundCareHistoricalOriginals, type WoundCareHistorySource, type WoundCareHistoryField } from "../../lib/pflege/woundCareHistoricalOriginals.native.ts";
import { careAssessmentRuntimeAccess } from "../../lib/careAssessment/careAssessmentRuntimeAccess.native.ts";
import { woundUuid } from '@/lib/pflege/woundCareDomain';
export function WoundCareHistoryPanel({ id, onCorrect }: {
    id: string;
    onCorrect?: (executionId: string) => void;
}) {
    const tenant = useServiceTenantId(), { profile } = useAuth(), p = usePermissions(), styles = useStyles();
    const access = careAssessmentRuntimeAccess({ tenantId: tenant, profileId: profile?.id, profileRole: profile?.roleKey, runtimeTenantId: p.tenantId, runtimeRole: p.roleKey, canView: p.can('pflege.wounds.view') && p.can('pflege.orders.view'), canManage: p.can('pflege.wounds.manage') && p.can('pflege.treatment.manage') });
    const read = access.canRead && profile?.tenantId === tenant && woundUuid(id), dressing = read && p.can('pflege.treatment.view') === true;
    const scope = JSON.stringify([tenant, profile?.tenantId, profile?.id, profile?.roleKey, p.tenantId, p.roleKey, id, read, dressing]);
    const alive = useRef(true), lifetime = useRef({ scope, token: Symbol('wound care lifetime') }), boundary = useRef({ scope, ticket: Symbol('wound care read') });
    const receipt = useRef<{
        scope: string;
        ticket: symbol;
        source: WoundCareHistorySource;
        capture: WoundCareHistoricalOriginals;
    } | null>(null), client = useRef<{
        scope: string;
        id: string;
    } | null>(null);
    const latest = useRef({ scope, read, dressing, manage: access.canManage, onCorrect });
    latest.current = { scope, read, dressing, manage: access.canManage, onCorrect };
    if (lifetime.current.scope !== scope) {
        lifetime.current = { scope, token: Symbol('changed wound care lifetime') };
        boundary.current = { scope, ticket: Symbol('changed wound care read') };
        receipt.current = null;
    }
    const renderLifetime = lifetime.current.token;
    const [planCount, setPlanCount] = useState(10), [dressingCount, setDressingCount] = useState(20), [open, setOpen] = useState<{
        ticket: symbol | null;
        details: string[];
        raw: string[];
    }>({ ticket: null, details: [], raw: [] });
    useEffect(() => { alive.current = true; return () => { alive.current = false; lifetime.current = { scope: 'disposed', token: Symbol('disposed wound care') }; boundary.current = { scope: 'disposed', ticket: Symbol('disposed wound read') }; receipt.current = null; }; }, []);
    async function readOriginals() {
        if (!alive.current || lifetime.current.token !== renderLifetime || !latest.current.read || latest.current.scope !== scope)
            return { ok: false as const, error: 'Der eigene Wund-Lesebezug ist nicht aktuell.' };
        const ticket = Symbol('complete wound care read');
        boundary.current = { scope, ticket };
        receipt.current = null;
        const current = () => alive.current && lifetime.current.token === renderLifetime && latest.current.read && latest.current.scope === scope && boundary.current.ticket === ticket;
        const result = await fetchWoundCareWithTreatmentCorrections(tenant ?? '', id, p.roleKey, dressing);
        if (!current())
            return { ok: false as const, error: 'Der eigene Wund-Lesebezug hat sich geändert.' };
        if (result.ok) {
            try {
                const source = result.data, clientId = String(source.wound.row.client_id);
                if (client.current?.scope === scope && client.current.id !== clientId)
                    throw Error('Nativer Pflegefall geändert.');
                const capture = captureWoundCareHistoricalOriginals(source, { tenantId: tenant ?? '', clientId, woundId: id, dressings: dressing });
                client.current = { scope, id: clientId };
                receipt.current = { scope, ticket, source, capture };
            }
            catch {
                return { ok: false as const, error: 'Der ganze native Plan- und Versorgungsbestand ist nicht bestätigt. Originale erneut laden.' };
            }
        }
        return result;
    }
    const q = useAsyncQuery(readOriginals, [tenant, profile?.id, profile?.roleKey, id, p.roleKey, read, dressing], { enabled: read, queryKey: `${scope}:wound-care-history` });
    const blocked = useRef(true);
    blocked.current = q.loading || q.refreshing || !!q.error || !!q.refreshError || q.previewData || q.tableMissing || q.cacheMeta.fromCache || !!q.cacheMeta.partialDetail;
    const currentReceipt = receipt.current?.source === q.data ? receipt.current : null, ticket = currentReceipt?.ticket ?? null, source = q.data;
    function currentOriginals() { const now = receipt.current; if (!alive.current || lifetime.current.token !== renderLifetime || latest.current.scope !== scope || !latest.current.read || blocked.current || !now || now.scope !== scope || now.ticket !== ticket || boundary.current.ticket !== ticket || now.source !== source || !sameWoundCareHistoricalOriginals(now.capture.source, source))
        return null; return now.capture; }
    function visibleOriginal(current: WoundCareHistoricalOriginals, entryId: string, care: boolean) { return (care ? current.dressings.slice(0, dressingCount) : current.plans.slice(0, planCount)).find(entry => entry.id === entryId); }
    function toggle(kind: 'details' | 'raw', entryId: string, care: boolean) { const current = currentOriginals(); if (!current || (care && !latest.current.dressing) || !visibleOriginal(current, entryId, care))
        return; const key = `${care ? 'dressing' : 'plan'}:${entryId}`; setOpen(previous => { const own = previous.ticket === ticket ? previous : { ticket, details: [], raw: [] }; return { ...own, [kind]: own[kind].includes(key) ? own[kind].filter(value => value !== key) : [...own[kind], key] }; }); }
    function more(care: boolean) { if (!currentOriginals() || (care && !latest.current.dressing))
        return; if (care)
        setDressingCount(count => count + 20);
    else
        setPlanCount(count => count + 10); }
    function correct(entryId: string) { const current = currentOriginals(); if (!current || !latest.current.dressing || !latest.current.manage || !latest.current.onCorrect)
        return; const entry = visibleOriginal(current, entryId, true); if (entry && woundUuid(entry.original.execution_id))
        latest.current.onCorrect(entry.original.execution_id); }
    function refreshHistory() {
        if (!alive.current || lifetime.current.token !== renderLifetime || !latest.current.read || latest.current.scope !== scope)
            return;
        boundary.current = { scope, ticket: Symbol('requested wound care refresh') };
        receipt.current = null;
        void q.refresh();
    }
    const captured = currentOriginals(), isOpen = (kind: 'details' | 'raw', key: string) => open.ticket === ticket && open[kind].includes(key);
    const fields = (items: WoundCareHistoryField[]) => items.map(value => <Text key={value.key} style={styles.body}>{value.label}: {value.display}</Text>);
    if (!read)
        return <InfoBanner variant="info" message="Eigene aktuelle Wund- und Anordnungsleserechte im nativen Benutzerkontext erforderlich."/>;
    if (q.loading || q.refreshing)
        return <LoadingState message="Planfassungen und Versorgungsoriginale werden vollständig neu geprüft…"/>;
    if (!captured)
        return <ErrorState message={q.error ?? q.refreshError ?? 'Aktueller vollständiger Plan- und Versorgungsbestand nicht bestätigt.'} onRetry={refreshHistory}/>;
    return <>
 <InfoBanner variant="info" message="Historische Planvereinbarung und tatsächlicher Originalbericht werden getrennt gelesen. Rücksprache und Rückmeldung sind dokumentierte Originaltexte; ein eigener Kontaktzeitpunkt, Empfänger oder Eskalationsabschluss wird daraus nicht ergänzt. Gespeicherte Belege bestätigen keine rückwirkende ärztliche Gültigkeit, Durchführung oder Freigabe."/>
 <SectionPanel title={`${captured.plans.length} dokumentierte Planfassungen`}>
 {!captured.plans.length ? <InfoBanner variant="info" message="Keine eigene versionierte Planfassung dokumentiert. Historischer Freitext bestätigt keine Planfassung."/> : captured.plans.slice(0, planCount).map(entry => {
            const plan = entry.original, key = `plan:${entry.id}`;
            return <SectionPanel key={entry.id} title={`Planfassung ${String(plan.version)}`}>
 <Text style={styles.body}>Plan-ID: {entry.id} · Vorgänger: {plan.previous_id ? String(plan.previous_id) : 'Erstfassung'}</Text>
 {fields(entry.times)}{fields(entry.author)}
 <Text style={styles.body}>Gespeicherte Grundlage: {String(plan.basis_state)} · native Anordnungs-ID: {plan.medical_order_id == null ? 'Keine zugeordnete Anordnung' : String(plan.medical_order_id)}</Text>
 {fields(entry.fields.filter(value => ['warningSigns', 'escalationPath', 'reviewStatus', 'reviewPendingReason'].includes(value.key)))}
 <PremiumButton title={isOpen('details', key) ? 'Weitere Planangaben einklappen' : 'Alle gelieferten Planangaben lesen'} variant="secondary" onPress={() => toggle('details', entry.id, false)}/>
 {isOpen('details', key) ? fields(entry.fields.filter(value => !['warningSigns', 'escalationPath', 'reviewStatus', 'reviewPendingReason'].includes(value.key))) : null}
 <Text style={styles.body}>Kassenstatus im gespeicherten Anordnungsbeleg: {insurer((plan.order_snapshot as Record<string, unknown> | null)?.insurer_approval_status)}</Text>
 <PremiumButton title={isOpen('raw', key) ? 'Ganzes Planoriginal einklappen' : 'Ganzes geliefertes Planoriginal mit Anordnungsbeleg lesen'} variant="secondary" onPress={() => toggle('raw', entry.id, false)}/>
 {isOpen('raw', key) ? <Text selectable style={styles.body}>{JSON.stringify(plan, null, 2)}</Text> : null}
 </SectionPanel>;
        })}
 {captured.plans.length > planCount ? <PremiumButton title="Weitere dokumentierte Planfassungen anzeigen" variant="secondary" onPress={() => more(false)}/> : null}
 </SectionPanel>
 {dressing ? <SectionPanel title={`${captured.dressings.length} tatsächliche Versorgungsoriginale`}>
 {!captured.dressings.length ? <InfoBanner variant="info" message="Noch kein eigener tatsächlicher Verbandwechsel dokumentiert."/> : captured.dressings.slice(0, dressingCount).map(entry => {
                const e = entry.original, d = e.details as Record<string, unknown>, key = `dressing:${entry.id}`, materials = JSON.parse(String(d.materialsJson)) as WoundMaterial[];
                return <SectionPanel key={entry.id} title={({ performed: 'Durchgeführt', partial: 'Teilweise durchgeführt', omitted: 'Nicht durchgeführt', refused: 'Abgelehnt', failed: 'Fehlgeschlagen' } as Record<string, string>)[String(e.outcome)] ?? 'Ergebnis unbestätigt'}>
 <Text style={styles.body}>Native Verbandwechsel-ID: {entry.id} · Behandlungspflegenachweis: {String(e.execution_id)}</Text>
 {fields(entry.times)}{fields(entry.author)}
 <SectionPanel title="Damals zugeordnetes Planoriginal">
 {entry.plan ? <><Text style={styles.body}>Plan-ID: {entry.plan.id} · Fassung {String(entry.plan.original.version)}</Text>{fields(entry.plan.times)}{fields(entry.plan.fields.filter(value => ['plannedCare', 'plannedMaterials', 'warningSigns', 'escalationPath', 'reviewStatus', 'reviewPendingReason'].includes(value.key)))}</> : <InfoBanner variant="warning" message="Keine zugeordnete native Planfassung. Der aktuelle Plan ersetzt keinen damaligen Beleg."/>}
 </SectionPanel>
 <SectionPanel title="Tatsächlich dokumentierter Originalbericht">
 {fields(entry.fields.filter(value => ['contact', 'response', 'deviation', 'reviewStatus', 'reviewPendingReason'].includes(value.key)))}
 <PremiumButton title={isOpen('details', key) ? 'Weitere Versorgungsangaben einklappen' : 'Alle gelieferten Versorgungsangaben lesen'} variant="secondary" onPress={() => toggle('details', entry.id, true)}/>
 {isOpen('details', key) ? <>{fields(entry.fields.filter(value => !['contact', 'response', 'deviation', 'reviewStatus', 'reviewPendingReason'].includes(value.key)))}{materials.map((material, i) => <Text key={i} style={styles.body}>Dokumentierter Materialverbrauch: {material.name} · {material.quantity} {material.unit} · {material.purpose}</Text>)}{['painBefore', 'painAfter'].map((moment, i) => <Text key={moment} style={styles.body}>Dokumentierter Schmerz {i === 0 ? 'vor' : 'nach'} der Versorgung: {d[moment + 'State'] === 'NRS' ? `${String(d[moment + 'Score'])} (NRS 0–10)` : `Nicht erhoben / beurteilbar – ${display(d[moment + 'Reason'])}`}</Text>)}</> : null}
 </SectionPanel>
 <TreatmentCorrectionHistory key={`${scope}:${entry.id}`} corrections={captured.source.corrections.filter(c => c.execution_id === e.execution_id)} links={captured.source.correctionLinks.filter(link => link.dressing_id === e.id)} dressing={e}/>
 <PremiumButton title={isOpen('raw', key) ? 'Ganzes Versorgungsoriginal einklappen' : 'Ganzes geliefertes Versorgungsoriginal mit damaligem Plan und Berichtigungen lesen'} variant="secondary" onPress={() => toggle('raw', entry.id, true)}/>
 {isOpen('raw', key) ? <Text selectable style={styles.body}>{JSON.stringify({ dressing: e, corrections: captured.source.corrections.filter(c => c.execution_id === e.execution_id), correctionLinks: captured.source.correctionLinks.filter(link => link.dressing_id === e.id) }, null, 2)}</Text> : null}
 {onCorrect && access.canManage ? <PremiumButton title="Verbandwechsel und Behandlungspflegenachweis gemeinsam berichtigen" variant="secondary" onPress={() => correct(entry.id)}/> : null}
 </SectionPanel>;
            })}
 {captured.dressings.length > dressingCount ? <PremiumButton title="Weitere tatsächliche Versorgungsoriginale anzeigen" variant="secondary" onPress={() => more(true)}/> : null}
 </SectionPanel> : <InfoBanner variant="info" message="Versorgungsoriginale erfordern zusätzlich eigenes Behandlungspflege-Leserecht."/>}
 <PremiumButton title="Plan- und Versorgungsverlauf aktualisieren" variant="secondary" onPress={refreshHistory}/>
 </>;
}
function useStyles() { const { c } = useCareLightPalette(); return useMemo(() => StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xxl, minWidth: 0 }, body: { ...typography.body, color: c.text }, group: { gap: spacing.sm, padding: spacing.sm, minWidth: 0 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } }), [c]); }
