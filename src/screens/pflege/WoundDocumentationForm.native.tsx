// Generated native presentation from src/screens/pflege/WoundDocumentationForm.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useMedicationSubmission } from "../../hooks/useMedicationSubmission.native.ts";
import { MedicationEventTimeInput, currentMedicationEventTime, medicationEventInstant } from "../../components/pflege/MedicationEventTimeInput.native.tsx";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { emptyWoundCase, emptyWoundAssessment, validateWoundRequest, type WoundRequest } from '@/lib/pflege/woundDocumentationDomain';
import { fetchWoundClients, fetchAmbulatoryWound, writeAmbulatoryWound } from "../../lib/pflege/ambulatoryWoundService.native.ts";
export function WoundCreateScreen() { return <WoundFormBoundary mode="create"/>; }
export function WoundAssessmentCreateScreen() { return <WoundFormBoundary mode="assessment"/>; }
function WoundFormBoundary({ mode }: {
    mode: 'create' | 'assessment';
}) {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), tenant = useServiceTenantId(), { profile } = useAuth(), permissions = usePermissions();
    return <WoundForm key={`${tenant}:${profile?.id}:${permissions.roleKey}:${id}:${mode}`} mode={mode} woundId={id ?? ''} tenant={tenant ?? ''} role={permissions.roleKey} canView={permissions.can('pflege.wounds.view')} canManage={permissions.can('pflege.wounds.manage')}/>;
}
function WoundForm({ mode, woundId, tenant, role, canView, canManage }: {
    mode: 'create' | 'assessment';
    woundId: string;
    tenant: string;
    role: ReturnType<typeof usePermissions>['roleKey'];
    canView: boolean;
    canManage: boolean;
}) {
    const styles = useStyles(), router = useRouter(), [clientId, setClientId] = useState(''), [confirmed, setConfirmed] = useState(''), receipt = useRef('');
    const [observed, setObserved] = useState(currentMedicationEventTime), [review, setReview] = useState(currentMedicationEventTime);
    const [draft, setDraft] = useState<Record<string, string>>(() => mode === 'create' ? { ...emptyWoundCase() } : { ...emptyWoundAssessment() });
    const [search, setSearch] = useState(''), [timeEdited, setTimeEdited] = useState(false);
    const clients = useAsyncQuery(() => fetchWoundClients(tenant, role), [tenant, role], { enabled: !!tenant && canView && mode === 'create', queryKey: `${tenant}:${role}:wound-clients` });
    const wound = useAsyncQuery(() => fetchAmbulatoryWound(tenant, woundId, role), [tenant, woundId, role], { enabled: !!tenant && canView && mode === 'assessment', queryKey: `${tenant}:${role}:${woundId}:wound-form` });
    const dirty = timeEdited || !!clientId || Object.values(draft).some(Boolean);
    const write = useMedicationSubmission<WoundRequest>(dirty && !confirmed, async (id, payload, replay) => { const r = await writeAmbulatoryWound(tenant, id, payload, role, replay); if (r.ok)
        receipt.current = r.data.id; return r; }, () => setConfirmed(receipt.current));
    const change = (key: string, value: string) => { if (!write.locked)
        setDraft(d => { const next = { ...d, [key]: value }; for (const dimension of ['length', 'width', 'depth'])
            if (key === dimension + 'State') {
                next[dimension + 'Cm'] = '';
                next[dimension + 'Reason'] = '';
            } if (key === 'reviewStatus') {
            next.reviewPendingReason = '';
        } if (key === 'painState') {
            next.painScore = '';
            next.painReason = '';
        } return next; }); };
    const field = (key: string, label: string) => <PremiumInput key={key} label={label} accessibilityLabel={label} value={draft[key] ?? ''} onChangeText={value => change(key, value)} editable={!write.locked} maxLength={2000} multiline/>;
    const chips = (key: string, options: {
        key: string;
        label: string;
    }[]) => <FilterChipGroup wrap options={options} value={draft[key] ?? ''} onChange={write.locked ? undefined : value => change(key, value)}/>;
    async function save() { if (write.uncertain) {
        await write.retry();
        return;
    } if (mode === 'assessment' && (!wound.data || wound.refreshError || !['draft', 'active', 'healing', 'deteriorated'].includes(String(wound.data.row.status)))) {
        write.setError('Offenen Wundfall neu laden.');
        return;
    } if (mode === 'create' && (!clients.data?.some(c => c.id === clientId) || clients.refreshError)) {
        write.setError('Aktiven Pflegefall ausdrücklich auswählen.');
        return;
    } const data = { ...draft, nextReviewAt: draft.reviewStatus === 'scheduled' ? medicationEventInstant(review) : '', ...(mode === 'assessment' ? { observedAt: medicationEventInstant(observed) } : {}) }; const payload: WoundRequest = { action: mode, subjectId: mode === 'create' ? clientId : woundId, dataJson: JSON.stringify(data) }; const error = validateWoundRequest(payload); if (error) {
        write.setError(error);
        return;
    } await write.submit(payload); }
    if (!canView || !canManage)
        return <ScreenShell title="Wunddokumentation"><ErrorState message="Lese- und Schreibberechtigung für Wunddokumentation erforderlich."/></ScreenShell>;
    if (confirmed)
        return <ScreenShell title="Wunddokumentation gespeichert"><SuccessState message={mode === 'create' ? 'Wundfall als Entwurf gespeichert. Ein tatsächlich erhobenes Erstassessment muss separat dokumentiert werden.' : 'Eigenständiges Wundassessment gespeichert. Der bestehende Versorgungsplan und Fallstatus wurden dadurch nicht automatisch freigegeben oder geändert.'}/><PremiumButton title="Gespeicherten Wundfall und Verlauf öffnen" disabled={write.busy} onPress={() => router.replace(`/pflege/wunden/${mode === 'create' ? confirmed : woundId}` as never)}/></ScreenShell>;
    return <ScreenShell title={mode === 'create' ? 'Wundfall anlegen' : 'Wundassessment dokumentieren'} subtitle={wound.data ? `${wound.data.clientName} · ${String(wound.data.row.body_location)}` : undefined}><ScrollView contentContainerStyle={styles.content}>
 {write.error ? <ErrorState message={write.error}/> : null}{write.uncertain ? <InfoBanner variant="warning" message="Speicherergebnis unklar. Dieselbe unveränderte Anfrage erneut prüfen. Angaben und Schließen bleiben bis zur Klärung gesperrt."/> : null}
 {mode === 'create' ? <>
 <SectionPanel title="Richtige Akte und Wunde"><PremiumInput label="Pflegeklient:innen suchen" value={search} onChangeText={setSearch} editable={!write.locked}/>{clients.loading && !clients.data ? <LoadingState message="Pflegefälle werden geladen…"/> : clients.error ? <ErrorState message={clients.error} onRetry={clients.refresh}/> : <FilterChipGroup wrap options={(clients.data ?? []).filter(c => c.name.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))).map(c => ({ key: c.id, label: c.name }))} value={clientId} onChange={write.locked ? undefined : setClientId}/>}{clients.refreshError ? <ErrorState message={clients.refreshError}/> : null}
 {field('bodyLocation', 'Genaue Lokalisation *')}{chips('side', [{ key: 'left', label: 'Links' }, { key: 'right', label: 'Rechts' }, { key: 'midline', label: 'Mittig' }, { key: 'bilateral', label: 'Beidseitig' }, { key: 'not_applicable', label: 'Seite nicht anwendbar' }])}
 {field('woundType', 'Fachliche Wundeinordnung / ausdrücklich ungeklärt *')}{field('etiology', 'Bekannte Ursache / tatsächlicher Klärungsstand *')}{field('acquiredWhere', 'Ort / Umstände der Entstehung bzw. Kenntnisstand *')}{field('onsetDate', 'Bekanntes Entstehungsdatum (JJJJ-MM-TT, Kalenderdatum Berlin)')}{field('onsetUnknownReason', 'Falls Datum unbekannt: tatsächlicher Kenntnisstand')}{field('description', 'Beschreibung der Wundsituation *')}
 </SectionPanel><SectionPanel title="Grundlage und geplante Versorgung">{chips('basisStatus', [{ key: 'documented', label: 'Ärztliche Grundlage dokumentiert' }, { key: 'pending', label: 'Grundlage / Klärung offen' }, { key: 'not_required', label: 'Nicht erforderlich – begründen' }])}{field('basisReference', 'Anordnungsbezug oder offener/begründet nicht erforderlicher Status *')}{field('physician', 'Anordnende ärztliche Person (bei dokumentierter Grundlage erforderlich)')}{field('carePlan', 'Geplante Versorgung – keine ausgeführte Handlung')}<InfoBanner variant="info" message="Die Beschreibung wird nicht als ärztliche Anordnung oder ausgeführte Versorgung übernommen. Der neue Wundfall bleibt ein Entwurf."/></SectionPanel>
 </> : <>
 {wound.loading && !wound.data ? <LoadingState message="Wundfall und vorhandener Verlauf werden geladen…"/> : wound.error ? <ErrorState message={wound.error} onRetry={wound.refresh}/> : null}{wound.refreshError ? <ErrorState message={wound.refreshError}/> : null}
 <SectionPanel title="Tatsächlich erhobene Wundsituation"><MedicationEventTimeInput label="Tatsächlicher Assessmentzeitpunkt" value={observed} disabled={write.locked} onChange={value => { setObserved(value); setTimeEdited(true); }}/>{field('measurementMethod', 'Verwendete Messmethode / Einschränkungen *')}
 {(['length', 'width', 'depth'] as const).map((k, i) => <View key={k} style={styles.group}><Text style={styles.body}>{['Länge', 'Breite', 'Tiefe'][i]}</Text>{chips(k + 'State', [{ key: 'measured', label: 'Tatsächlich gemessen' }, { key: 'not_measurable', label: 'Nicht messbar' }])}{draft[k + 'State'] === 'measured' ? field(k + 'Cm', 'Tatsächlich gemessener Wert in cm') : field(k + 'Reason', 'Falls nicht messbar: tatsächlicher Grund')}</View>)}
 {field('woundBed', 'Wundbett / Beurteilbarkeit *')}{field('exudate', 'Exsudat / tatsächliche Beurteilung *')}{field('odor', 'Geruch / tatsächliche Beurteilung *')}{field('woundEdge', 'Wundrand / Beurteilbarkeit *')}{field('surroundingSkin', 'Wundumgebung / Beurteilbarkeit *')}{field('infectionObservation', 'Tatsächliche Infektionsbeobachtungen / Beurteilbarkeit *')}
 </SectionPanel><SectionPanel title="Schmerz und persönliche Situation">{chips('painState', [{ key: 'NRS', label: 'NRS 0–10 tatsächlich erhoben' }, { key: 'not_assessable', label: 'Nicht beurteilbar' }])}{draft.painState === 'NRS' ? field('painScore', 'Erhobener ganzzahliger NRS-Wert 0–10') : field('painReason', 'Tatsächlicher Grund für fehlende Schmerzerhebung')}{field('personalImpact', 'Wund-/therapiebedingte Auswirkungen auf Alltag und Wohlbefinden *')}{field('preferences', 'Wünsche / Entscheidungen der Person bzw. tatsächliche Erhebungsgrenze *')}{field('selfManagement', 'Vorhandene Ressourcen und Unterstützungsbedarf *')}</SectionPanel>
 <SectionPanel title="Tatsächliche Reaktion und Ergebnis">{field('actualAction', 'Tatsächliche Reaktion / ausdrücklich keine Handlung mit Begründung *')}{field('response', 'Beobachtetes Ergebnis / ausstehende Rückmeldung *')}<InfoBanner variant="info" message="Eine Beobachtung ist keine automatische Infektionsdiagnose. Verbandwechsel, Anordnungsänderung, Fallabschluss und Eskalationsabschluss werden nicht aus diesem Assessment abgeleitet."/></SectionPanel>
 </>}
 <SectionPanel title="Weitere Kontrolle / tatsächlicher Abstimmungsstand">{chips('reviewStatus', [{ key: 'scheduled', label: 'Termin tatsächlich vereinbart' }, { key: 'pending', label: 'Terminabstimmung offen' }])}{draft.reviewStatus === 'pending' ? field('reviewPendingReason', 'Tatsächlicher Grund / weiterer Abstimmungsbedarf *') : draft.reviewStatus === 'scheduled' ? <MedicationEventTimeInput label="Tatsächlich vereinbarter nächster Kontrolltermin" value={review} disabled={write.locked} onChange={value => { setReview(value); setTimeEdited(true); }}/> : null}</SectionPanel>
 <View style={styles.actions}><PremiumButton title={write.busy ? 'Wunddokumentation wird gespeichert…' : write.uncertain ? 'Dieselbe Anfrage erneut prüfen' : 'Wunddokumentation speichern'} disabled={write.busy} onPress={save}/><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={write.locked} onPress={async () => { if (await write.confirmLeave())
        router.back(); }}/></View>
 </ScrollView></ScreenShell>;
}
function useStyles() { const { c } = useCareLightPalette(); return useMemo(() => StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xxl, minWidth: 0 }, group: { gap: spacing.sm, minWidth: 0 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, body: { ...typography.body, color: c.text } }), [c]); }
