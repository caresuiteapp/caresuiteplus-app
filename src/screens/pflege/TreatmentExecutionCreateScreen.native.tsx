// Generated native presentation from src/screens/pflege/TreatmentExecutionCreateScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useMedicationSubmission } from "../../hooks/useMedicationSubmission.native.ts";
import { emptyTreatmentExecution, emptyTreatmentDetails, treatmentProfiles, validateTreatmentExecutionSources, type TreatmentExecutionDraft } from '@/lib/pflege/treatmentExecutionDomain';
import { fetchTreatmentClients, fetchTreatmentExecutionSources, writeTreatmentExecution, type TreatmentExecutionSources } from '@/lib/pflege/treatmentExecutionService';
import { OriginalTreatmentSection, treatmentOutcome, useTreatmentCorrectionStyles } from "./TreatmentCorrectionScreen.native.tsx";
import { SourcePicker } from "./TreatmentSourcePicker.native.tsx";
type Row = Record<string, unknown>;
const display = (v: unknown) => typeof v === 'string' && v.trim() ? v : 'Nicht bestätigt';
export function TreatmentExecutionCreateScreen() { const tenant = useServiceTenantId(), { profile } = useAuth(), p = usePermissions(); return <ClientSelection key={`${tenant}:${profile?.id}:${p.roleKey}`} tenant={tenant ?? ''} role={p.roleKey} canWrite={p.can('pflege.treatment.view') && p.can('pflege.treatment.manage') && p.can('pflege.orders.view')}/>; }
function ClientSelection({ tenant, role, canWrite }: {
    tenant: string;
    role: ReturnType<typeof usePermissions>['roleKey'];
    canWrite: boolean;
}) {
    const [client, setClient] = useState(''), styles = useTreatmentCorrectionStyles(), router = useRouter(), q = useAsyncQuery(() => fetchTreatmentClients(tenant, role), [tenant, role], { enabled: !!tenant && canWrite, queryKey: `${tenant}:${role}:structured-treatment-clients` });
    if (!canWrite)
        return <ScreenShell title="Behandlungspflege dokumentieren"><ErrorState message="Behandlungspflege-Lese-/Schreibrecht und Anordnungsleserecht erforderlich."/></ScreenShell>;
    if (client)
        return <ExecutionForm key={client} tenant={tenant} client={client} clientName={q.data?.find(p => p.id === client)?.name ?? 'Name nicht bestätigt'} role={role} onClientChange={() => setClient('')}/>;
    return <ScreenShell title="Behandlungspflege dokumentieren" subtitle="Aktiven Pflegefall und tatsächliche Behandlungsart ausdrücklich wählen"><ScrollView contentContainerStyle={styles.content}>{q.loading && !q.data ? <LoadingState message="Aktive zugängliche Pflegefälle werden vollständig geladen…"/> : !q.data ? <ErrorState message={q.error ?? 'Pflegefälle nicht verfügbar.'} onRetry={q.refresh}/> : <SourcePicker label="Pflegefall" rows={q.data.map(p => ({ id: p.id, label: p.name }))} value="" disabled={q.loading || !!q.refreshError} onChange={setClient}/>} {q.refreshError ? <ErrorState message={q.refreshError} onRetry={q.refresh}/> : null}<PremiumButton title="Zur Behandlungspflegeliste" variant="secondary" onPress={() => router.replace('/pflege/behandlungspflege' as never)}/></ScrollView></ScreenShell>;
}
function ExecutionForm({ tenant, client, clientName, role, onClientChange }: {
    tenant: string;
    client: string;
    clientName: string;
    role: ReturnType<typeof usePermissions>['roleKey'];
    onClientChange: () => void;
}) {
    const styles = useTreatmentCorrectionStyles(), router = useRouter(), [draft, setDraft] = useState<TreatmentExecutionDraft>(() => ({ ...emptyTreatmentExecution(), clientId: client })), [confirmed, setConfirmed] = useState(false), baseline = useRef<TreatmentExecutionSources | null>(null), perType = useRef<Record<string, Record<string, string>>>({});
    const q = useAsyncQuery(() => fetchTreatmentExecutionSources(tenant, client, role), [tenant, client, role], { enabled: !!tenant, queryKey: `${tenant}:${client}:${role}:structured-treatment-sources` }), ctx = baseline.current ?? q.data;
    const dirty = Object.entries(draft).some(([k, v]) => !['clientId', 'profileVersion', 'detailsJson'].includes(k) && !!v.trim()), write = useMedicationSubmission<TreatmentExecutionDraft>(dirty && !confirmed, async (id, payload, replay) => writeTreatmentExecution(tenant, id, payload, role, replay), () => setConfirmed(true));
    const profile = treatmentProfiles[draft.treatmentType], actual = ['performed', 'partial'].includes(draft.outcome), details = JSON.parse(draft.detailsJson) as Record<string, string>;
    function change(k: keyof TreatmentExecutionDraft, v: string) { if (write.locked)
        return; baseline.current ??= q.data ?? null; setDraft(d => ({ ...d, [k]: v })); }
    function chooseType(type: string) { if (write.locked)
        return; baseline.current ??= q.data ?? null; if (draft.treatmentType)
        perType.current[draft.treatmentType] = details; setDraft(d => ({ ...d, treatmentType: type, detailsJson: JSON.stringify(perType.current[type] ?? emptyTreatmentDetails(type)), administrationId: '', expectedAdministrationJson: '', medicationState: '', medicationReason: '', measurementId: '', expectedMeasurementJson: '', measurementState: '', measurementReason: '', measurementMaxAgeMinutes: '' })); }
    const input = (k: keyof TreatmentExecutionDraft, label: string) => <PremiumInput key={k} label={label} accessibilityLabel={label} value={draft[k]} onChangeText={v => change(k, v)} editable={!write.locked} multiline maxLength={2000}/>;
    const choice = (k: keyof TreatmentExecutionDraft, options: {
        key: string;
        label: string;
    }[], after?: (v: string) => void) => <FilterChipGroup wrap options={options} value={draft[k]} onChange={write.locked ? undefined : v => { change(k, v); after?.(v); }}/>;
    const order = ctx?.orders.find(o => o.id === draft.orderId), administration = ctx?.administrations.find(a => a.id === draft.administrationId), measurement = ctx?.measurements.find(m => m.id === draft.measurementId);
    async function save() { if (write.uncertain) {
        await write.retry();
        return;
    } if (!ctx || !q.data || q.loading || q.refreshError) {
        write.setError('Quellen vollständig laden und prüfen.');
        return;
    } const p = { ...draft, detailsJson: JSON.stringify(actual ? details : emptyTreatmentDetails(draft.treatmentType)), expectedOrderJson: order ? JSON.stringify(order) : '', expectedAdministrationJson: administration ? JSON.stringify(administration) : '', expectedMeasurementJson: measurement ? JSON.stringify(measurement) : '' }; const error = validateTreatmentExecutionSources(p, tenant, q.data.orders.find(o => o.id === p.orderId) ?? null, q.data.administrations.find(a => a.id === p.administrationId) ?? null, q.data.measurements.find(m => m.id === p.measurementId) ?? null, q.data.invalidations); if (error) {
        write.setError(error);
        return;
    } await write.submit(p); }
    if (confirmed)
        return <ScreenShell title="Durchführungsnachweis gespeichert"><SuccessState message="Tatsächliche Behandlung mit Quellenbezügen gespeichert. Dieser Nachweis erzeugt keine zweite Medikamentengabe, keine automatische Dosierung und keine Abrechnung."/><PremiumButton title="Zum aktualisierten Behandlungspflegeverlauf" disabled={write.busy} onPress={() => router.replace('/pflege/behandlungspflege' as never)}/></ScreenShell>;
    return <ScreenShell title="Tatsächliche Behandlungspflege dokumentieren" subtitle={clientName}><ScrollView contentContainerStyle={styles.content}>
 <InfoBanner variant="info" message="Tatsächliche Handlung oder Nichtdurchführung dokumentieren. Ein dokumentierter Qualifikationsbezug und eine gespeicherte Anordnung ersetzen keine fachliche Freigabe. Ungeklärte Grundlagen mit Abweichung und Rücksprache festhalten."/>
 {q.loading && !q.data ? <LoadingState message="Anordnungen, zugängliche Gaben und Messungen werden vollständig geladen…"/> : !q.data ? <ErrorState message={q.error ?? 'Quellen nicht verfügbar.'} onRetry={q.refresh}/> : null}{q.refreshError ? <ErrorState message={q.refreshError} onRetry={q.refresh}/> : null}{write.error ? <ErrorState message={write.error}/> : null}{write.uncertain ? <InfoBanner variant="warning" message="Speicherbestätigung fehlt. Angaben bleiben gesperrt; dieselbe unveränderte Anfrage erneut prüfen."/> : null}
 <SectionPanel title="Art, tatsächlicher Zeitpunkt und Ergebnis"><FilterChipGroup wrap options={Object.entries(treatmentProfiles).map(([key, p]) => ({ key, label: p.label }))} value={draft.treatmentType} onChange={write.locked ? undefined : chooseType}/>{input('title', 'Konkrete Bezeichnung *')}{input('occurredAt', 'Tatsächlicher Zeitpunkt als ISO-Datum mit Zeitzone *')} {choice('outcome', ['performed', 'partial', 'omitted', 'refused', 'failed'].map(key => ({ key, label: treatmentOutcome(key) })))}<Text style={styles.body}>Beim Wechsel der Art bleiben eingegebene Artangaben innerhalb dieser Bearbeitung erhalten. Gabe- und Messzuordnung danach ausdrücklich neu prüfen. Bei Nichtdurchführung werden keine Mengen oder tatsächlichen Versorgungsangaben gespeichert.</Text></SectionPanel>
 <SectionPanel title="Ärztliche Grundlage und Versicherungsentscheidung">{choice('orderState', [{ key: 'linked', label: 'Vorhandene Anordnung ausdrücklich zuordnen' }, { key: 'unconfirmed', label: 'Anordnungsgrundlage ungeklärt' }], v => { if (v !== 'linked') {
        change('orderId', '');
        change('orderRelation', '');
    }
    else
        change('basisReason', ''); })}{draft.orderState === 'linked' && ctx ? <><SourcePicker label="Anordnung" rows={ctx.orders.map(o => ({ id: String(o.id), label: `${display(o.title)} · ${display(o.status)} · ${display(o.valid_from)} bis ${o.valid_until ?? 'ohne Enddatum'} · ${display(o.ordering_physician)}` }))} value={draft.orderId} disabled={write.locked} onChange={v => change('orderId', v)}/>{order ? <OriginalTreatmentSection value={{ description: order.description, execution_instructions: order.execution_instructions, frequency: order.frequency, qualification_requirement: order.qualification_requirement, source_document: order.source_document, insurer_approval_status: order.insurer_approval_status, insurer_approval_reference: order.insurer_approval_reference }}/> : null}{input('orderRelation', 'Tatsächlicher Bezug dieser Behandlung zur gewählten Anordnung *')}</> : draft.orderState === 'unconfirmed' ? input('basisReason', 'Tatsächliche Unklarheit und Klärungsbedarf *') : null}</SectionPanel>
 <SectionPanel title="Qualifikation und Delegation">{choice('qualificationState', [{ key: 'documented', label: 'Tatsächliche Qualifikations-/Delegationsbasis dokumentiert' }, { key: 'unconfirmed', label: 'Qualifikation / Delegation ungeklärt' }])}{input('qualificationBasis', 'Konkreter Qualifikations-/Delegationsbezug, Quelle und tatsächliche Grenze *')}</SectionPanel>
 {profile ? <SectionPanel title={`${profile.label}: tatsächliche Angaben`}>{actual ? profile.fields.filter(f => f.key !== 'volumeReason' || details.volumeState === 'not_measured').filter(f => f.key !== 'volume' || details.volumeState === 'measured').map(f => f.key === 'volumeState' ? <View key={f.key} style={styles.group}><Text style={styles.body}>Tatsächliche Mengenmessung *</Text><FilterChipGroup wrap options={[{ key: 'measured', label: 'Menge tatsächlich gemessen (ml)' }, { key: 'not_measured', label: 'Menge nicht erhoben – begründen' }]} value={details.volumeState} onChange={write.locked ? undefined : v => change('detailsJson', JSON.stringify({ ...details, volumeState: v, volume: '', volumeReason: '' }))}/></View> : <PremiumInput key={`${draft.treatmentType}:${f.key}`} label={`${f.label}${f.key === 'volume' ? ' (bei Messung)' : f.key === 'volumeReason' ? ' (bei fehlender Messung)' : ' *'}`} accessibilityLabel={f.label} value={details[f.key] ?? ''} editable={!write.locked} multiline maxLength={2000} onChangeText={v => change('detailsJson', JSON.stringify({ ...details, [f.key]: v }))}/>) : <InfoBanner variant="info" message="Bei Nichtdurchführung keine tatsächliche Dosis, Menge oder Versorgung eintragen. Beobachtung und Abweichungsgrund unten dokumentieren."/>}</SectionPanel> : null}
 {profile ? <SectionPanel title="Bezug zum vorhandenen Medikamentengabenachweis">{choice('medicationState', profile.drug ? [{ key: 'linked', label: 'Bereits dokumentierte tatsächliche Gabe zuordnen' }, { key: 'unconfirmed', label: 'Gabenachweis / Zuordnung ungeklärt' }] : [{ key: 'not_applicable', label: 'Kein Medikamentengabevorgang in dieser Behandlung' }], v => { if (v !== 'linked')
        change('administrationId', ''); })}{draft.medicationState === 'linked' && ctx ? <>{ctx.medicationReadable ? <SourcePicker label="Tatsächliche Gabe" rows={ctx.administrations.map(a => ({ id: String(a.id), label: `${display((a.order_snapshot as Row | null)?.name)} · ${display(a.status)} · ${display(a.occurred_at)} · ${display(a.administered_dose)} · ${display(a.route)}` }))} value={draft.administrationId} disabled={write.locked} onChange={v => change('administrationId', v)}/> : <InfoBanner variant="warning" message="Medikationsleserecht fehlt; vorhandene Gaben können nicht zugeordnet werden."/>}{administration ? <OriginalTreatmentSection value={{ medicationName: (administration.order_snapshot as Row | null)?.name, administeredDose: administration.administered_dose, route: administration.route, occurredAt: administration.occurred_at }}/> : null}</> : null}{input('medicationReason', 'Tatsächlicher Gabenbezug / Unklarheit / begründet kein Gabevorgang *')}</SectionPanel> : null}
 {profile ? <SectionPanel title="Messwert als tatsächliche Entscheidungsgrundlage">{choice('measurementState', [{ key: 'linked', label: 'Vorhandene tatsächliche Messung zuordnen' }, { key: profile === treatmentProfiles.insulin ? 'unconfirmed' : 'not_required', label: profile === treatmentProfiles.insulin ? 'Erforderlicher Messbezug ungeklärt' : 'Kein Messbezug erforderlich – begründen' }], v => { if (v !== 'linked') {
        change('measurementId', '');
        change('measurementMaxAgeMinutes', '');
    } })}{draft.measurementState === 'linked' && ctx ? <>{ctx.measurementReadable ? <SourcePicker label="Messung" rows={ctx.measurements.map(m => ({ id: String(m.id), label: `${display(m.vital_key)} · ${display(m.display_value)} ${display(m.unit)} · ${display(m.occurred_at)}${ctx.invalidations.some(i => i.measurement_id === m.id) ? ' · ALS UNGÜLTIG GEKENNZEICHNET' : ''}` }))} value={draft.measurementId} disabled={write.locked} onChange={v => change('measurementId', v)}/> : <InfoBanner variant="warning" message="Vitalwertleserecht fehlt; vorhandene Messungen können nicht zugeordnet werden."/>}{measurement ? <OriginalTreatmentSection value={{ measurementType: measurement.vital_key, measurementValue: measurement.display_value, measurementUnit: measurement.unit, occurredAt: measurement.occurred_at }}/> : null}{input('measurementMaxAgeMinutes', 'Für diesen konkreten Anlass begründete maximale Messwertalterung in Minuten *')}</> : null}{input('measurementReason', 'Tatsächlicher Messwertbezug, zeitliche Eignung, Quelle / Klärungsbedarf *')}</SectionPanel> : null}
 <SectionPanel title="Beobachtung, Abweichung und nächste Kontrolle">{input('observation', 'Tatsächlich beobachtetes Ergebnis / Verträglichkeit / Nichtdurchführung *')}{input('deviation', 'Tatsächliche Abweichung / ungeklärte Grundlage / Nichtdurchführungsgrund')}{input('communication', 'Erfolgte Rücksprache, offene Klärung oder begründet kein Bedarf *')}{input('personDecision', 'Tatsächliche Einbeziehung / Entscheidung der Person oder Grenze *')}{choice('reviewState', [{ key: 'scheduled', label: 'Kontrolle tatsächlich vereinbart' }, { key: 'pending', label: 'Kontrollabstimmung offen' }, { key: 'not_required', label: 'Kontrolle nicht erforderlich – begründen' }], v => { if (v !== 'scheduled')
        change('nextReviewAt', ''); })}{draft.reviewState === 'scheduled' ? input('nextReviewAt', 'Tatsächlich vereinbarter Kontrollzeitpunkt mit Zeitzone *') : null}{input('reviewReason', 'Kontrollabstimmung, zuständige Person und nächste Handlung / Begründung *')}</SectionPanel>
 <View style={styles.actions}><PremiumButton title={write.busy ? 'Nachweis wird gespeichert…' : write.uncertain ? 'Dieselbe Anfrage erneut prüfen' : 'Tatsächlichen Nachweis mit Quellenbezügen speichern'} disabled={write.busy || (!write.uncertain && (!q.data || q.loading || !!q.refreshError))} onPress={save}/><PremiumButton title="Pflegefall wechseln" variant="secondary" disabled={write.locked} onPress={async () => { if (await write.confirmLeave())
        onClientChange(); }}/><PremiumButton title="Zurück zur Liste" variant="secondary" disabled={write.locked} onPress={async () => { if (await write.confirmLeave())
        router.replace('/pflege/behandlungspflege' as never); }}/></View>
 {!write.locked ? <><PremiumButton title="Quellen aktualisieren" variant="secondary" onPress={q.refresh}/>{baseline.current ? <PremiumButton title="Geladene Quellen nach eigener Prüfung übernehmen" variant="secondary" disabled={!q.data || q.loading || !!q.refreshError} onPress={() => { if (q.data) {
        baseline.current = q.data;
        setDraft(d => ({ ...d }));
        write.setError(null);
    } }}/> : null}</> : null}
 </ScrollView></ScreenShell>;
}
