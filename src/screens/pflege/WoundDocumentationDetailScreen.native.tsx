// Generated native presentation from src/screens/pflege/WoundDocumentationDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { isKnownWoundEditorRole } from "../../lib/pflege/woundEditorRequestGuard.native.ts";
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { CarePermissionStatus } from "./CarePermissionStatus.native.tsx";
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { spacing, typography } from '@/theme';
import { fetchWoundWithCorrections } from '@/lib/pflege/woundAssessmentCorrectionService';
import { WoundAssessmentCorrectionScreen, WoundAssessmentCorrectionHistory } from "./WoundAssessmentCorrectionScreen.native.tsx";
import { TreatmentCorrectionScreen } from "./TreatmentCorrectionScreen.native.tsx";
import { WoundLifecycleScreen } from "./WoundLifecycleScreen.native.tsx";
import { WoundCareScreen, WoundCareHistoryPanel } from "./WoundCareScreen.native.tsx";
import { WoundAssessmentComparison } from "../../components/pflege/WoundAssessmentComparison.native.tsx";
import { WoundPhotoReferenceEvidence } from "../../components/pflege/WoundPhotoReferenceEvidence.native.tsx";
import { WoundPathWorkspacePanel } from "../../components/pflege/WoundPathWorkspacePanel.native.tsx";
import { captureWoundComparisonOriginals, sameWoundComparisonOriginal, type WoundComparisonOriginals } from "../../lib/pflege/woundAssessmentComparison.native.ts";
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import type { WoundEditorOwner } from "../../lib/pflege/woundEditorAccess.native.ts";
const time = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }).format(new Date(v)) : 'Zeitpunkt nicht bestätigt';
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v : 'Nicht bestätigt / nicht dokumentiert';
const details = (v: unknown) => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const labels: Record<string, string> = { bodyLocation: 'Lokalisation', side: 'Körperseite', woundType: 'Fachliche Einordnung', etiology: 'Ursache / Klärungsstand', onsetDate: 'Entstehungsdatum', onsetUnknownReason: 'Kenntnisstand zum Entstehungsdatum', acquiredWhere: 'Entstehungsumstände', description: 'Wundsituation', basisStatus: 'Ärztliche Grundlage – Status', basisReference: 'Anordnungsbezug / Begründung / offener Status', physician: 'Ärztliche Person', reviewStatus: 'Kontrollabstimmung', reviewPendingReason: 'Offener Abstimmungsbedarf', carePlan: 'Geplante Versorgung', measurementMethod: 'Messmethode / Einschränkungen', woundBed: 'Wundbett', exudate: 'Exsudat', odor: 'Geruch', woundEdge: 'Wundrand', surroundingSkin: 'Wundumgebung', infectionObservation: 'Infektionsbeobachtungen / Beurteilbarkeit', personalImpact: 'Persönliche Auswirkungen', preferences: 'Wünsche und Entscheidungen', selfManagement: 'Ressourcen und Unterstützungsbedarf', actualAction: 'Tatsächliche Reaktion', response: 'Beobachtetes Ergebnis' };
const translate: Record<string, string> = { left: 'Links', right: 'Rechts', midline: 'Mittig', bilateral: 'Beidseitig', not_applicable: 'Nicht anwendbar', documented: 'Dokumentiert', scheduled: 'Termin vereinbart', pending: 'Klärung offen', not_required: 'Als nicht erforderlich begründet' };
export function WoundDocumentationDetailScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), { profile } = useAuth();
    const nativeOwner = isKnownWoundEditorRole(profile?.roleKey) && woundUuid(profile?.tenantId) && woundUuid(profile?.id) ? { tenantId: profile.tenantId, profileId: profile.id, role: profile.roleKey } : null;
    const workspaceOwner = useRef<WoundEditorOwner | null>(nativeOwner);
    if (nativeOwner)
        workspaceOwner.current = nativeOwner;
    return <WoundDocumentationWorkspace key={JSON.stringify([id, workspaceOwner.current])}/>;
}
function WoundDocumentationWorkspace() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>(), tenant = useServiceTenantId(), { profile } = useAuth(), permissions = usePermissions(), router = useRouter(), styles = useStyles(), [treatmentCorrectionId, setTreatmentCorrectionId] = useState<string | null>(null), [correctionAssessmentId, setCorrectionAssessmentId] = useState<string | null>(null), [showLifecycle, setShowLifecycle] = useState(false), [careMode, setCareMode] = useState<'plan' | 'dressing' | null>(null), [careRefresh, setCareRefresh] = useState(0);
    const editorOwner = useRef<WoundEditorOwner | null>(isKnownWoundEditorRole(profile?.roleKey) && woundUuid(profile?.tenantId) && woundUuid(profile?.id) ? { tenantId: profile.tenantId, profileId: profile.id, role: profile.roleKey } : null).current;
    const editorScope = JSON.stringify([id, isKnownWoundEditorRole(profile?.roleKey) && woundUuid(profile?.tenantId) && woundUuid(profile?.id) ? { tenantId: profile.tenantId, profileId: profile.id, role: profile.roleKey } : editorOwner]);
    const editorLifetime = useRef({ scope: editorScope, token: Symbol('native wound editor owner') });
    if (editorLifetime.current.scope !== editorScope)
        editorLifetime.current = { scope: editorScope, token: Symbol('changed wound editor owner') };
    const renderEditorLifetime = editorLifetime.current.token;
    const nativeRead = isKnownWoundEditorRole(profile?.roleKey) && woundUuid(profile?.id) && woundUuid(profile?.tenantId) && profile.tenantId === tenant && permissions.tenantId === tenant && permissions.roleKey === profile.roleKey && permissions.can('pflege.wounds.view') === true && woundUuid(id);
    const readScope = JSON.stringify([tenant, profile?.tenantId, profile?.id, profile?.roleKey, permissions.tenantId, permissions.roleKey, id, nativeRead]);
    const readLifetime = useRef({ scope: readScope, token: Symbol('wound read lifetime') });
    if (readLifetime.current.scope !== readScope)
        readLifetime.current = { scope: readScope, token: Symbol('changed wound lifetime') };
    const renderReadLifetime = readLifetime.current.token;
    const readAlive = useRef(true), readBoundary = useRef({ scope: readScope, ticket: Symbol('wound read') }), readLatest = useRef({ scope: readScope, allowed: nativeRead });
    readLatest.current = { scope: readScope, allowed: nativeRead };
    const readReceipt = useRef<{
        ticket: symbol;
        scope: string;
        source: WoundComparisonOriginals;
        original: WoundComparisonOriginals;
    } | null>(null), readClient = useRef<{
        scope: string;
        id: string;
    } | null>(null);
    if (readBoundary.current.scope !== readScope) {
        readBoundary.current = { scope: readScope, ticket: Symbol('changed wound read') };
        readReceipt.current = null;
    }
    useEffect(() => { readAlive.current = true; return () => { readAlive.current = false; editorLifetime.current = { scope: 'disposed', token: Symbol('disposed editor owner') }; readLifetime.current = { scope: 'disposed', token: Symbol('disposed lifetime') }; readBoundary.current = { scope: 'disposed', ticket: Symbol('disposed wound read') }; readReceipt.current = null; }; }, []);
    async function readComparisonContext() {
        if (!readAlive.current || readLifetime.current.token !== renderReadLifetime || !readLatest.current.allowed || readLatest.current.scope !== readScope)
            return { ok: false as const, error: 'Eigener Wund-Lesebezug geändert.' };
        const ticket = Symbol('complete wound read');
        readBoundary.current = { scope: readScope, ticket };
        readReceipt.current = null;
        const stillCurrent = () => readAlive.current && readLifetime.current.token === renderReadLifetime && readLatest.current.allowed && readLatest.current.scope === readScope && readBoundary.current.ticket === ticket;
        const result = await fetchWoundWithCorrections(tenant ?? '', id, permissions.roleKey);
        if (!stillCurrent())
            return { ok: false as const, error: 'Eigener Wund-Lesebezug geändert.' };
        if (result.ok) {
            try {
                const source = result.data, clientId = String(source.row.client_id);
                if (readClient.current?.scope === readScope && readClient.current.id !== clientId)
                    throw Error('Nativer Pflegefall des Wundfalls geändert.');
                const original = captureWoundComparisonOriginals(source, { tenantId: tenant ?? '', clientId, woundId: id });
                readClient.current = { scope: readScope, id: clientId };
                readReceipt.current = { ticket, scope: readScope, source, original };
            }
            catch {
                return { ok: false as const, error: 'Vollständigen nativen Wund-Originalstand erneut prüfen.' };
            }
        }
        return result;
    }
    const q = useAsyncQuery(readComparisonContext, [tenant, profile?.id, profile?.roleKey, permissions.roleKey, id, nativeRead], { enabled: nativeRead, queryKey: `${readScope}:wound-detail` });
    const comparisonBlocked = useRef(true);
    comparisonBlocked.current = q.loading || q.refreshing || !!q.error || !!q.refreshError || q.previewData || q.tableMissing || q.cacheMeta.fromCache || !!q.cacheMeta.partialDetail;
    function isCurrentComparisonReceipt(ticket: symbol, source: WoundComparisonOriginals) { const receipt = readReceipt.current; return readAlive.current && readLatest.current.allowed && !comparisonBlocked.current && !!receipt && receipt.ticket === ticket && readBoundary.current.ticket === ticket && receipt.scope === readLatest.current.scope && receipt.source === source && sameWoundComparisonOriginal(receipt.original, source); }
    const comparisonTicket = readReceipt.current?.source === q.data ? readReceipt.current.ticket : null;
    const activeEditor = treatmentCorrectionId ? `treatment:${treatmentCorrectionId}` : correctionAssessmentId ? `assessment:${correctionAssessmentId}` : careMode ? careMode : showLifecycle ? 'lifecycle' : null;
    const actionLatest = useRef({ editor: activeEditor, manage: false, orders: false, treatmentRead: false, treatmentManage: false });
    const editorGeneration = useRef(Symbol('wound editor')), renderEditorGeneration = editorGeneration.current;
    actionLatest.current = { editor: activeEditor, manage: permissions.can('pflege.wounds.manage'), orders: permissions.can('pflege.orders.view'), treatmentRead: permissions.can('pflege.treatment.view'), treatmentManage: permissions.can('pflege.treatment.manage') };
    function currentDetail() { return q.data && comparisonTicket && isCurrentComparisonReceipt(comparisonTicket, q.data) ? q.data : null; }
    function refreshDetail() {
        if (!readAlive.current || readLifetime.current.token !== renderReadLifetime || !readLatest.current.allowed || readLatest.current.scope !== readScope)
            return;
        readReceipt.current = null;
        void q.refresh();
    }
    const refreshLatest = useRef(refreshDetail);
    refreshLatest.current = refreshDetail;
    function openDetailEditor(kind: 'assessment' | 'lifecycle' | 'plan' | 'dressing' | 'assessment_correction' | 'treatment_correction', value?: string) {
        const source = currentDetail(), access = actionLatest.current;
        if (!source || !access.manage || access.editor !== null)
            return;
        const active = ['draft', 'active', 'healing', 'deteriorated'].includes(String(source.row.status));
        if (['assessment', 'plan'].includes(kind) && !active)
            return;
        if (kind === 'assessment') {
            router.push(`/pflege/wunden/${id}/assessment` as never);
            return;
        }
        if (['plan', 'dressing'].includes(kind) && !access.orders)
            return;
        if (['dressing', 'treatment_correction'].includes(kind) && (!access.treatmentRead || !access.treatmentManage))
            return;
        if (kind === 'assessment_correction') {
            if (!value || !woundUuid(value) || !source.assessments.some(a => a.id === value))
                return;
            editorGeneration.current = Symbol('assessment editor');
            actionLatest.current.editor = `assessment:${value}`;
            setCorrectionAssessmentId(value);
        }
        else if (kind === 'treatment_correction') {
            if (!value || !woundUuid(value))
                return;
            editorGeneration.current = Symbol('treatment editor');
            actionLatest.current.editor = `treatment:${value}`;
            setTreatmentCorrectionId(value);
        }
        else if (kind === 'lifecycle') {
            editorGeneration.current = Symbol('lifecycle editor');
            actionLatest.current.editor = kind;
            setShowLifecycle(true);
        }
        else {
            editorGeneration.current = Symbol('care editor');
            actionLatest.current.editor = kind;
            setCareMode(kind);
        }
    }
    function closeDetailEditor(expected: string) {
        if (!readAlive.current || editorLifetime.current.token !== renderEditorLifetime || editorLifetime.current.scope !== editorScope || editorGeneration.current !== renderEditorGeneration || actionLatest.current.editor !== expected)
            return;
        editorGeneration.current = Symbol('closed wound editor');
        actionLatest.current.editor = null;
        setTreatmentCorrectionId(null);
        setCorrectionAssessmentId(null);
        setCareMode(null);
        setShowLifecycle(false);
        if (expected === 'plan' || expected === 'dressing' || expected.startsWith('treatment:'))
            setCareRefresh(n => n + 1);
        refreshLatest.current();
    }
    if (activeEditor) {
        const editor = treatmentCorrectionId ? <TreatmentCorrectionScreen sessionOwner={editorOwner} accessBlocked={!nativeRead} woundId={id} executionId={treatmentCorrectionId} onClose={() => closeDetailEditor(`treatment:${treatmentCorrectionId}`)}/> : correctionAssessmentId ? <WoundAssessmentCorrectionScreen sessionOwner={editorOwner} accessBlocked={!nativeRead} woundId={id} assessmentId={correctionAssessmentId} onClose={() => closeDetailEditor(`assessment:${correctionAssessmentId}`)}/> : careMode ? <WoundCareScreen sessionOwner={editorOwner} accessBlocked={!nativeRead} mode={careMode} onClose={() => closeDetailEditor(careMode)}/> : <WoundLifecycleScreen sessionOwner={editorOwner} accessBlocked={!nativeRead} onClose={() => closeDetailEditor('lifecycle')}/>;
        return <View style={{ minWidth: 0 }}>{!nativeRead ? <ScreenShell title="Wunddokumentation"><ErrorState message="Der aktuelle Wund-Lesezugriff fehlt. Die ursprüngliche Bearbeitung und eine unbestätigte Anfrage bleiben für denselben Benutzer erhalten."/></ScreenShell> : null}<View style={!nativeRead ? { display: 'none' } : undefined}>{editor}</View></View>;
    }
    if (!permissions.can('pflege.wounds.view'))
        return <ScreenShell title="Wunddokumentation"><CarePermissionStatus state={permissions}/></ScreenShell>;
    if (!nativeRead)
        return <ScreenShell title="Wunddokumentation"><ErrorState message="Der aktuelle Zugriff auf diesen Wundfall fehlt."/></ScreenShell>;
    if (!currentDetail() || !q.data)
        return <ScreenShell title="Wunddokumentation">{q.loading || q.refreshing ? <LoadingState message="Aktueller Wundfall und Verlauf werden geladen…"/> : <ErrorState message={q.error ?? q.refreshError ?? 'Der aktuelle Wundverlauf ist nicht vollständig bestätigt. Bitte neu laden.'} onRetry={refreshDetail}/>}</ScreenShell>;
    const w = q.data.row, d = details(w.documentation_details);
    return <ScreenShell title="Wundfall und Verlauf" subtitle={`${q.data.clientName} · ${text(w.body_location)}`}><ScrollView contentContainerStyle={styles.content}>
 {q.refreshError ? <ErrorState message={`Letzter erfolgreich geladener Stand: ${q.refreshError}`} onRetry={refreshDetail}/> : null}
 <SectionPanel title="Wundzuordnung"><Text style={styles.body}>Wund-ID: {text(w.id)}</Text><Text style={styles.body}>Fallstatus: {({ draft: 'Entwurf', active: 'Aktiv', healing: 'Heilend', healed: 'Abgeheilt', deteriorated: 'Verschlechtert', archived: 'Archiviert' } as Record<string, string>)[String(w.status)] ?? 'Status nicht bestätigt'}</Text><Text style={styles.body}>Angelegt: {time(w.created_at)} · {text(w.recorded_by_name)}</Text>
 {d ? Object.entries(labels).filter(([k]) => k in d).map(([k, label]) => <Text key={k} style={styles.body}>{label}: {translate[String(d[k])] ?? text(d[k])}</Text>) : <><InfoBanner variant="warning" message="Historischer Wundfall ohne neue strukturierte Herkunftsangaben. Es wird keine ärztliche Grundlage, Messung oder BodyMap-Markierung ergänzt oder behauptet."/><Text style={styles.body}>Lokalisation: {text(w.body_location)}</Text><Text style={styles.body}>Wundtyp: {text(w.wound_type)}</Text><Text style={styles.body}>Gespeicherter historischer Plantext: {text(w.treatment_plan)}</Text></>}
 <Text style={styles.body}>Geplanter Fall-Kontrolltermin: {time(w.next_review_at)}</Text></SectionPanel>
 {permissions.can('pflege.wounds.manage') ? <PremiumButton title="Tatsächliches Wundassessment ergänzen" disabled={!!q.refreshError || !['draft', 'active', 'healing', 'deteriorated'].includes(String(w.status))} onPress={() => openDetailEditor('assessment')}/> : null}
 {permissions.can('pflege.wounds.manage') ? <PremiumButton title={['healed', 'archived'].includes(String(w.status)) ? 'Wundfall begründet wiederöffnen' : 'Wundfall begründet abschließen'} variant="secondary" disabled={!!q.refreshError || q.loading || !['draft', 'active', 'healing', 'deteriorated', 'healed', 'archived'].includes(String(w.status))} onPress={() => openDetailEditor('lifecycle')}/> : null}
 {permissions.can('pflege.wounds.manage') && permissions.can('pflege.orders.view') ? <PremiumButton title="Wundplan als neue Fassung dokumentieren" variant="secondary" disabled={!!q.refreshError || q.loading || !['draft', 'active', 'healing', 'deteriorated'].includes(String(w.status))} onPress={() => openDetailEditor('plan')}/> : null}
 {permissions.can('pflege.wounds.manage') && permissions.can('pflege.orders.view') && permissions.can('pflege.treatment.view') && permissions.can('pflege.treatment.manage') ? <PremiumButton title="Tatsächlichen Verbandwechsel / Versorgung dokumentieren" disabled={!!q.refreshError || q.loading} onPress={() => openDetailEditor('dressing')}/> : null}
 <WoundCareHistoryPanel key={`${tenant}:${profile?.id}:${permissions.roleKey}:${id}:${careRefresh}`} id={id} onCorrect={value => openDetailEditor('treatment_correction', value)}/>
 <WoundPathWorkspacePanel key={`${tenant}:${profile?.id}:${permissions.roleKey}:${permissions.permissions.join(',')}:${id}:path`} tenantId={tenant ?? ''} clientId={String(q.data.row.client_id)} woundId={id} actorId={profile?.id ?? ''} source={q.data} canRead={nativeRead} canWrite={permissions.can('pflege.wounds.manage')} canPlan={permissions.can('pflege.wounds.manage') && permissions.can('pflege.orders.view')} canDress={permissions.can('pflege.wounds.manage') && permissions.can('pflege.orders.view') && permissions.can('pflege.treatment.view') && permissions.can('pflege.treatment.manage')} canContact={permissions.can('pflege.treatment.manage')} canReview={permissions.can('pflege.documentation.sign')} readBlocked={comparisonBlocked.current} onAssessment={() => openDetailEditor('assessment')} onPlan={() => openDetailEditor('plan')} onDressing={() => openDetailEditor('dressing')} onLifecycle={() => openDetailEditor('lifecycle')}/>
 <SectionPanel title="Begründeter Fallstatusverlauf">{!q.data.lifecycle.length ? <InfoBanner variant="info" message="Keine neuen Fallstatusereignisse dokumentiert. Ein historischer Status wird nicht rückwirkend als begründeter Abschluss bestätigt."/> : q.data.lifecycle.map(e => <SectionPanel key={String(e.id)} title={e.action === 'reopen' ? 'Wiederöffnung im Entwurfsstatus' : 'Begründeter Abschluss'}>
 <Text style={styles.body}>Entschieden: {time(e.occurred_at)} · erfasst: {time(e.created_at)} · {text(e.recorded_by_name)}</Text>
 <Text style={styles.body}>Abschlussart: {({ healed: 'Abheilung festgestellt', transfer: 'Versorgung übergeben', care_ended: 'Versorgung beendet', other: 'Anderer begründeter Abschluss' } as Record<string, string>)[String(e.closure_kind)] ?? 'Wiederöffnung'}</Text>
 <Text style={styles.body}>Grund: {text(e.reason)}</Text><Text style={styles.body}>Entscheidungsgrundlage: {text(e.decision_basis)}</Text><Text style={styles.body}>Weitere Versorgung / Übergabe: {text(e.handover)}</Text>
 <Text style={styles.body}>Befundbezug: {e.assessment_id ? text(e.assessment_id) : 'Kein zugeordneter Befund – keine Abheilung bestätigt'}</Text>
 </SectionPanel>)}</SectionPanel>
 <WoundPhotoReferenceEvidence key={`${tenant}:${profile?.id}:${profile?.roleKey}:${id}:${String(q.data.row.client_id)}`} source={q.data} tenantId={tenant ?? ''} profileId={profile?.id ?? ''} profileRole={profile?.roleKey ?? null} runtimeTenantId={permissions.tenantId} runtimeRole={permissions.roleKey} woundId={id} canRead={nativeRead} readBlocked={comparisonBlocked.current} readTicket={comparisonTicket} isCurrentReceipt={isCurrentComparisonReceipt}/>
 <WoundAssessmentComparison key={`${tenant}:${profile?.id}:${profile?.roleKey}:${id}:${String(q.data.row.client_id)}`} source={q.data} tenantId={tenant ?? ''} profileId={profile?.id ?? ''} profileRole={profile?.roleKey ?? null} runtimeTenantId={permissions.tenantId} runtimeRole={permissions.roleKey} woundId={id} canRead={nativeRead} readBlocked={comparisonBlocked.current} readTicket={comparisonTicket} isCurrentReceipt={isCurrentComparisonReceipt}/>
 <Text style={styles.body}>{q.data.assessments.length} vollständig geladene Assessments · neueste Erfassung zuerst. Tatsächliche Beobachtungszeit bleibt jeweils gesondert sichtbar.</Text>
 {!q.data.assessments.length ? <InfoBanner variant="info" message="Noch kein tatsächlich dokumentiertes Erstassessment vorhanden."/> : q.data.assessments.map(a => {
            const ad = details(a.documentation_details);
            return <SectionPanel key={String(a.id)} title={q.data!.corrections.some(c => c.assessment_id === a.id) ? "Originalassessment mit Berichtigungsvermerken" : "Eigenständiges Wundassessment"}>
 <Text style={styles.body}>Beobachtet: {a.observed_at ? time(a.observed_at) : 'Historisch nicht gesondert bestätigt'}</Text><Text style={styles.body}>Erfasst: {time(a.created_at)} · {text(a.recorded_by_name)}</Text>
 {(['length', 'width', 'depth'] as const).map((k, i) => <Text key={k} style={styles.body}>{['Länge', 'Breite', 'Tiefe'][i]}: {ad?.[k + 'State'] === 'not_measurable' ? `Nicht messbar – ${text(ad[k + 'Reason'])}` : a[k + '_cm'] != null ? `${String(a[k + '_cm'])} cm` : 'Nicht bestätigt'}</Text>)}
 <Text style={styles.body}>Schmerz: {ad?.painState === 'not_assessable' ? `Nicht beurteilbar – ${text(ad.painReason)}` : a.pain_score != null ? `${String(a.pain_score)}${ad?.painState === 'NRS' ? ' (NRS 0–10)' : ' (historische Skala nicht gesondert bestätigt)'}` : 'Kein bestätigter Score'}</Text>
 {ad ? Object.entries(labels).filter(([k]) => k in ad).map(([k, label]) => <Text key={k} style={styles.body}>{label}: {text(ad[k])}</Text>) : ['wound_bed', 'exudate', 'odor', 'wound_edge', 'surrounding_skin', 'infection_signs', 'intervention', 'response'].map(k => <Text key={k} style={styles.body}>{({ wound_bed: 'Wundbett', exudate: 'Exsudat', odor: 'Geruch', wound_edge: 'Wundrand', surrounding_skin: 'Wundumgebung', infection_signs: 'Infektionsbeobachtung', intervention: 'Gespeicherte Intervention', response: 'Reaktion' } as Record<string, string>)[k]}: {text(a[k])}</Text>)}
 <WoundAssessmentCorrectionHistory key={`${tenant}:${profile?.id}:${permissions.roleKey}:${String(a.id)}`} corrections={q.data!.corrections.filter(c => c.assessment_id === a.id)} source={a}/>{permissions.can('pflege.wounds.manage') ? <PremiumButton title="Dieses Originalassessment begründet berichtigen" variant="secondary" disabled={q.loading || !!q.refreshError} onPress={() => openDetailEditor('assessment_correction', String(a.id))}/> : null}
 <Text style={styles.body}>Weitere Kontrolle dieses Assessments: {time(ad?.nextReviewAt)}</Text>
 </SectionPanel>;
        })}
 <InfoBanner variant="info" message="Assessment und Planfreigabe sind getrennte Vorgänge. Eine Beobachtung löst keine automatische Behandlung, Diagnose, Fallfreigabe oder Kontrollerledigung aus."/>
 <PremiumButton title="Wundfall und Verlauf aktualisieren" variant="secondary" onPress={refreshDetail}/>
 </ScrollView></ScreenShell>;
}
function useStyles() { const { c } = useCareLightPalette(); return useMemo(() => StyleSheet.create({ content: { gap: spacing.md, paddingBottom: spacing.xxl, minWidth: 0 }, body: { ...typography.body, color: c.text, flexShrink: 1, maxWidth: '100%' } }), [c]); }
