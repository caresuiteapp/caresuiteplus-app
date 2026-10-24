// Generated native presentation from src/screens/pflege/WoundAssessmentCorrectionScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { woundEditorAccess as captureWoundEditorAccess, isKnownWoundEditorRole, WoundEditorRequestGuard, type WoundEditorAccess } from "../../lib/pflege/woundEditorRequestGuard.native.ts";
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useWoundSubmission } from "../../hooks/pflege/useWoundSubmission.native.ts";
import { woundEditorAccess, type WoundEditorOwner } from "../../lib/pflege/woundEditorAccess.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { sameWoundJson } from '@/lib/pflege/woundCareDomain';
import { emptyWoundAssessmentCorrection, woundCorrectionSections, woundAssessmentSection, validateWoundAssessmentCorrectionSnapshot, type WoundAssessmentCorrectionRequest } from '@/lib/pflege/woundAssessmentCorrectionDomain';
import { fetchWoundCorrectionContext, writeWoundAssessmentCorrection, type WoundCorrectionContext } from '@/lib/pflege/woundAssessmentCorrectionService';
type Row = Record<string, unknown>;
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v : 'Nicht dokumentiert / nicht bestätigt';
const time = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : 'Nicht bestätigt';
const sectionLabels: Record<string, string> = { observed_at: 'Gespeicherte tatsächliche Beobachtungszeit', wound_case_id: 'Wundfall-ID', client_id: 'Klienten-ID', measurementMethod: 'Messmethode', lengthState: 'Länge: Erhebungsstatus', lengthCm: 'Länge: dokumentierte Angabe', lengthReason: 'Länge: Erhebungsgrenze', widthState: 'Breite: Erhebungsstatus', widthCm: 'Breite: dokumentierte Angabe', widthReason: 'Breite: Erhebungsgrenze', depthState: 'Tiefe: Erhebungsstatus', depthCm: 'Tiefe: dokumentierte Angabe', depthReason: 'Tiefe: Erhebungsgrenze', length_cm: 'Ursprüngliches Zahlenfeld Länge', width_cm: 'Ursprüngliches Zahlenfeld Breite', depth_cm: 'Ursprüngliches Zahlenfeld Tiefe', unit: 'Einheit der Wundmaße', woundBed: 'Wundbett', wound_bed: 'Historisches Wundbettfeld', exudate: 'Exsudat', legacy_exudate: 'Historisches Exsudatfeld', odor: 'Geruch', legacy_odor: 'Historisches Geruchsfeld', woundEdge: 'Wundrand', wound_edge: 'Historisches Wundrandfeld', surroundingSkin: 'Wundumgebung', surrounding_skin: 'Historisches Wundumgebungsfeld', painState: 'Schmerz: Erhebungsstatus', painScore: 'Dokumentierter Schmerzscore', painReason: 'Grund für fehlende Schmerzerhebung', pain_score: 'Ursprüngliches Zahlenfeld Schmerz', infectionObservation: 'Infektionsbeobachtung', infection_signs: 'Historisches Beobachtungsfeld', personalImpact: 'Persönliche Auswirkungen', preferences: 'Wünsche und Entscheidungen', selfManagement: 'Ressourcen / Unterstützungsbedarf', actualAction: 'Tatsächliche Handlung', response: 'Beobachtetes Ergebnis', intervention: 'Historisches Interventionsfeld', legacy_response: 'Historisches Ergebnisfeld', nextReviewAt: 'Kontrolltermin', reviewStatus: 'Abstimmungsstatus', reviewPendingReason: 'Offene Abstimmung' };
export function OriginalAssessmentSection({ value }: {
    value: Row;
}) {
    const styles = useStyles();
    return <View style={styles.group}>{Object.entries(value).map(([k, v]) => <Text key={k} style={styles.body}>{sectionLabels[k] ?? k}: {v == null ? 'Nicht gesondert bestätigt' : typeof v === 'string' ? text(v) : String(v)}</Text>)}</View>;
}
const headFor = (ctx: WoundCorrectionContext, id: string) => ctx.corrections.filter(c => c.assessment_id === id).sort((a, b) => Number(b.version) - Number(a.version))[0] ?? null;
export function WoundAssessmentCorrectionScreen({ woundId, assessmentId, onClose, sessionOwner, accessBlocked = false }: {
    woundId: string;
    assessmentId: string;
    onClose: () => void;
    sessionOwner?: WoundEditorOwner | null;
    accessBlocked?: boolean;
}) {
    const tenant = useServiceTenantId(), { profile } = useAuth(), permissions = usePermissions();
    const stableOwner = useRef<WoundEditorOwner | null>(null);
    if (isKnownWoundEditorRole(profile?.roleKey) && woundUuid(profile?.tenantId) && woundUuid(profile?.id))
        stableOwner.current = { tenantId: profile.tenantId, profileId: profile.id, role: profile.roleKey };
    const latestNative = useRef({ tenant, profile, permissions, sessionOwner, accessBlocked, woundId, assessmentId, owner: stableOwner.current });
    latestNative.current = { tenant, profile, permissions, sessionOwner, accessBlocked, woundId, assessmentId, owner: stableOwner.current };
    const liveAccess = useRef<() => WoundEditorAccess>(() => {
        const { tenant, profile, permissions, sessionOwner, accessBlocked, woundId, assessmentId, owner } = latestNative.current;
        const can = Object.getOwnPropertyDescriptor(permissions, 'can');
        if (!can || !Object.hasOwn(can, 'value') || typeof can.value !== 'function')
            throw Error('Aktuelle native Berechtigungsabfrage fehlt.');
        const grant = (key: Parameters<typeof permissions.can>[0]) => can.value(key) === true;
        const current = woundEditorAccess({ owner: sessionOwner === undefined ? owner : sessionOwner, profile, serviceTenant: tenant, runtimeTenant: permissions.tenantId, runtimeRole: permissions.roleKey, blocked: accessBlocked, canView: grant('pflege.wounds.view'), canManage: grant('pflege.wounds.manage') });
        return captureWoundEditorAccess({ originalOwner: current.owner, tenantId: tenant, profileTenantId: profile?.tenantId, profileId: profile?.id, profileRole: profile?.roleKey, runtimeTenantId: permissions.tenantId, runtimeRole: permissions.roleKey, sourceId: assessmentId, woundId, kind: 'assessment', action: 'correction', canRead: current.canView, canManage: grant('pflege.wounds.manage') });
    });
    const access = woundEditorAccess({ owner: sessionOwner === undefined ? stableOwner.current : sessionOwner, profile, serviceTenant: tenant, runtimeTenant: permissions.tenantId, runtimeRole: permissions.roleKey, blocked: accessBlocked, canView: permissions.can('pflege.wounds.view'), canManage: permissions.can('pflege.wounds.manage') });
    const guardAccess = { ...captureWoundEditorAccess({ originalOwner: access.owner, tenantId: tenant, profileTenantId: profile?.tenantId, profileId: profile?.id, profileRole: profile?.roleKey, runtimeTenantId: permissions.tenantId, runtimeRole: permissions.roleKey, sourceId: assessmentId, woundId, kind: 'assessment', action: 'correction', canRead: access.canView, canManage: permissions.can('pflege.wounds.manage') }), liveAccess: liveAccess.current };
    return <CorrectionForm access={guardAccess} key={`${access.key}:${woundId}:${assessmentId}`} woundId={woundId} assessmentId={assessmentId} tenant={access.owner?.tenantId ?? ''} role={access.owner?.role ?? null} canView={access.canView} canManage={access.canManage} onClose={onClose}/>;
}
function CorrectionForm({ access, woundId, assessmentId, tenant, role, canView, canManage, onClose }: {
    access: WoundEditorAccess;
    woundId: string;
    assessmentId: string;
    tenant: string;
    role: ReturnType<typeof usePermissions>['roleKey'];
    canView: boolean;
    canManage: boolean;
    onClose: () => void;
}) {
    const guard = useRef(new WoundEditorRequestGuard<WoundAssessmentCorrectionRequest>(access));
    guard.current.update(access);
    const readEpoch = guard.current.readEpoch;
    useEffect(() => { guard.current.mount(); return () => guard.current.dispose(); }, []);
    const styles = useStyles(), [draft, setDraft] = useState(emptyWoundAssessmentCorrection), [confirmed, setConfirmed] = useState(false), baseline = useRef<WoundCorrectionContext | null>(null);
    const q = useAsyncQuery(() => guard.current.read(readEpoch, () => fetchWoundCorrectionContext(tenant, woundId, role)), [access.readScope, tenant, woundId, assessmentId, role], { enabled: guard.current.canRead() && !!tenant && canView, queryKey: `${tenant}:${role}:${woundId}:${assessmentId}:${access.readScope}:correction-form` });
    guard.current.setView(q.data, q.loading || q.refreshing || !!q.error || !!q.refreshError || q.previewData || q.tableMissing || q.cacheMeta.fromCache || !!q.cacheMeta.partialDetail);
    const readTicket = guard.current.readTicket;
    const dirty = Object.values(draft).some(Boolean), write = useWoundSubmission<WoundAssessmentCorrectionRequest>(dirty && !confirmed, guard.current.canRead(), async (requestId, payload, replay) => guard.current.execute(requestId, payload, replay, () => writeWoundAssessmentCorrection(tenant, requestId, payload, role, replay), readEpoch, readTicket, q.data), () => setConfirmed(true));
    const ctx = guard.current.canShow(readEpoch, readTicket, q.data) ? (baseline.current && guard.current.sameCurrentOriginal(baseline.current) ? baseline.current : q.data) : null, source = ctx?.wound.assessments.find(a => a.id === assessmentId), head = ctx ? headFor(ctx, assessmentId) : null;
    function change(key: keyof WoundAssessmentCorrectionRequest, value: string) { if (write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed)
        return; baseline.current ??= q.data ?? null; setDraft(d => ({ ...d, [key]: value })); }
    const field = (key: keyof WoundAssessmentCorrectionRequest, label: string) => <PremiumInput key={key} label={label} accessibilityLabel={label} value={draft[key]} onChangeText={v => change(key, v)} editable={!write.locked && guard.current.mayWrite(readEpoch, readTicket, q.data) && !confirmed} multiline maxLength={2000}/>;
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
        if (!q.data || q.loading || q.refreshError || !source) {
            write.setError('Originalbefund und vollständigen Berichtigungsstand zuerst laden.');
            return;
        }
        const current = q.data.wound.assessments.find(a => a.id === assessmentId);
        if (!current) {
            write.setError('Originalbefund nicht mehr zugänglich.');
            return;
        }
        const payload = { ...draft, woundId, assessmentId, expectedSourceJson: JSON.stringify(source), expectedHeadJson: head ? JSON.stringify(head) : '' };
        const error = validateWoundAssessmentCorrectionSnapshot(payload, tenant, String(q.data.wound.row.client_id), current, headFor(q.data, assessmentId));
        if (error) {
            write.setError(error);
            return;
        }
        await write.submit(payload);
    }
    if (!guard.current.canRead() || (!canManage && !write.uncertain))
        return <ScreenShell title="Assessment berichtigen"><ErrorState message="Wund-Lese- und Schreibberechtigung erforderlich."/></ScreenShell>;
    if (confirmed)
        return <ScreenShell title="Berichtigungsvermerk gespeichert"><SuccessState message="Berichtigung mit Originalbezug gespeichert. Originalbefund, Fallentscheidungen und Versorgungsplan wurden nicht überschrieben. Weitere fachliche Prüfung und notwendige Rücksprache bleiben eigenständige Vorgänge."/><PremiumButton title="Wundfall und vollständigen Verlauf öffnen" disabled={write.busy} onPress={() => { if (guard.current.mayClose(readEpoch) && !write.locked)
            onClose(); }}/></ScreenShell>;
    if (!guard.current.canShow(readEpoch, readTicket, q.data))
        return <ScreenShell title="Ursprüngliche Wundanfrage"><ErrorState message={q.error ?? q.refreshError ?? 'Aktuellen vollständigen eigenen Originalbestand zuerst laden.'}/>{write.error ? <ErrorState message={write.error}/> : null}{write.uncertain ? <><InfoBanner variant="warning" message="Speicherbestätigung fehlt. Die ursprüngliche Anfrage bleibt erhalten; derselbe Originalauftrag kann mit eigenen aktuellen Leserechten erneut geprüft werden."/><PremiumButton title="Dieselbe ursprüngliche Anfrage erneut prüfen" disabled={write.busy} onPress={save}/></> : <PremiumButton title="Eigenen vollständigen Originalbestand laden" variant="secondary" onPress={q.refresh}/>}</ScreenShell>;
    return <ScreenShell title="Wundassessment begründet berichtigen" subtitle={ctx ? `${ctx.wound.clientName} · ${text(ctx.wound.row.body_location)}` : undefined}><ScrollView contentContainerStyle={styles.content}>
 {q.loading && !q.data ? <LoadingState message="Originalassessment und sämtliche Berichtigungen werden geladen…"/> : !q.data ? <ErrorState message={q.error ?? 'Originalbezug nicht verfügbar.'} onRetry={q.refresh}/> : null}
 {q.refreshError ? <ErrorState message={q.refreshError} onRetry={q.refresh}/> : null}{write.error ? <ErrorState message={write.error}/> : null}
 {write.uncertain ? <InfoBanner variant="warning" message="Speicherergebnis unklar. Angaben und Schließen bleiben gesperrt. Dieselbe unveränderte Berichtigungsanfrage erneut prüfen."/> : null}
 <InfoBanner variant="info" message="Dieser Vermerk berichtigt eine frühere Aussage. Er ist keine neue Beobachtung oder Ersatzmessung. Zahlenfelder und frühere Unterschriften werden nicht geändert. Für einen neu erhobenen Befund ein eigenes Assessment dokumentieren."/>
 {source ? <><SectionPanel title="Festgehaltener Originalbezug"><Text style={styles.body}>Assessment-ID: {assessmentId}</Text><Text style={styles.body}>Beobachtet: {time(source.observed_at)} · ursprünglich erfasst: {time(source.created_at)} · {text(source.recorded_by_name)}</Text><Text style={styles.body}>Bisherige Berichtigungen: {String(head?.version ?? 0)}</Text><FilterChipGroup wrap options={Object.entries(woundCorrectionSections).map(([key, label]) => ({ key, label }))} value={draft.section} onChange={write.locked || !guard.current.mayWrite(readEpoch, readTicket, q.data) || confirmed ? undefined : v => change('section', v)}/>{draft.section ? <OriginalAssessmentSection value={woundAssessmentSection(source, draft.section)}/> : null}</SectionPanel>
 {ctx ? <WoundAssessmentCorrectionHistory corrections={ctx.corrections.filter(c => c.assessment_id === assessmentId)} source={source}/> : null}
 <SectionPanel title="Tatsächlich bekannte Berichtigung">{field('correctedStatement', 'Berichtigte Aussage mit Einheit / Skala bzw. ausdrücklich unbekanntem Stand *')}{field('reason', 'Tatsächlicher Grund für diese Berichtigung *')}{field('evidenceBasis', 'Tatsächliche Erkenntnisgrundlage / überprüfter Quellenbezug *')}{field('clinicalImpact', 'Auswirkungen auf bisherige Entscheidungen und weitere Versorgung / offene Prüfung *')}{field('communication', 'Tatsächlich erfolgte Rücksprache, offene Klärung oder begründet kein Bedarf *')}{field('personDecision', 'Einbeziehung, Wünsche / Entscheidung der betroffenen Person oder tatsächliche Grenze *')}</SectionPanel></> : q.data ? <ErrorState message="Gewähltes Originalassessment fehlt in dieser Wundakte."/> : null}
 <View style={styles.actions}><PremiumButton title={write.busy ? 'Berichtigung wird gespeichert…' : write.uncertain ? 'Dieselbe Berichtigungsanfrage erneut prüfen' : 'Begründeten Berichtigungsvermerk speichern'} disabled={write.busy || (!write.uncertain && (!source || q.loading || !!q.refreshError))} onPress={save}/><PremiumButton title="Bearbeitung schließen" variant="secondary" disabled={write.locked} onPress={async () => { if (guard.current.mayClose(readEpoch) && !write.locked && await write.confirmLeave() && guard.current.mayClose(readEpoch) && !write.locked)
        onClose(); }}/></View>
 {!write.locked ? <><PremiumButton title="Aktuellen Original- und Berichtigungsstand laden" variant="secondary" onPress={q.refresh}/>{baseline.current ? <PremiumButton title="Geladenen Stand nach eigener Prüfung als Grundlage übernehmen" variant="secondary" disabled={!q.data || q.loading || !!q.refreshError} onPress={() => { if (guard.current.mayWrite(readEpoch, readTicket, q.data) && !write.locked && !confirmed && q.data) {
        baseline.current = q.data;
        setDraft(d => ({ ...d }));
        write.setError(null);
    } }}/> : null}</> : null}
 </ScrollView></ScreenShell>;
}
export function WoundAssessmentCorrectionHistory({ corrections, source }: {
    corrections: Row[];
    source: Row;
}) {
    const styles = useStyles(), [count, setCount] = useState(10);
    if (!corrections.length)
        return null;
    const ordered = [...corrections].sort((a, b) => Number(a.version) - Number(b.version));
    return <SectionPanel title={`${corrections.length} Berichtigungsvermerke zum Originalbefund`}><InfoBanner variant="warning" message="Zu diesem Originalassessment liegen Berichtigungen vor. Die ursprünglichen Angaben müssen gemeinsam mit sämtlichen Vermerken gelesen werden. Alte Zahlenfelder sind nicht automatisch berichtigte Messwerte. Frühere Entscheidungen und offene Klärungen bleiben zu prüfen."/>{ordered.slice(0, count).map(c => <SectionPanel key={String(c.id)} title={`Berichtigung ${String(c.version)} · ${woundCorrectionSections[c.section as keyof typeof woundCorrectionSections]}`}><Text style={styles.body}>Berichtigt am: {time(c.created_at)} · {text(c.recorded_by_name)}</Text><Text style={styles.body}>Vermerk-ID: {String(c.id)} · Vorgänger: {c.previous_id ? String(c.previous_id) : 'Erster Vermerk'}</Text>{!sameWoundJson(c.original_snapshot, source) ? <InfoBanner variant="warning" message="Der heute geladene Originaldatensatz weicht vom damals gesicherten Original ab. Der ursprüngliche Bezug dieses Vermerks bleibt unten sichtbar; Abweichung gesondert prüfen."/> : null}<Text style={styles.body}>Ursprünglich betroffener Inhalt:</Text><OriginalAssessmentSection value={c.original_section as Row}/><Text style={styles.body}>Berichtigte Aussage: {text(c.corrected_statement)}</Text><Text style={styles.body}>Grund: {text(c.reason)}</Text><Text style={styles.body}>Erkenntnisgrundlage: {text(c.evidence_basis)}</Text><Text style={styles.body}>Auswirkungen / offene fachliche Prüfung: {text(c.clinical_impact)}</Text><Text style={styles.body}>Rücksprache / Klärungsstand: {text(c.communication)}</Text><Text style={styles.body}>Personenbezug: {text(c.person_decision)}</Text></SectionPanel>)}{count < ordered.length ? <PremiumButton title="Weitere Berichtigungsvermerke anzeigen" variant="secondary" onPress={() => setCount(n => n + 10)}/> : null}</SectionPanel>;
}
function useStyles() { const { c } = useCareLightPalette(); return useMemo(() => StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xxl, minWidth: 0 }, body: { ...typography.body, color: c.text }, group: { gap: spacing.sm, minWidth: 0 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm } }), [c]); }
