// Generated native presentation from src/screens/careAssessment/PlanAmendmentHistory.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { ErrorState, InfoBanner, LoadingState, PremiumButton, SectionPanel } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { careAssessmentRuntimeAccess } from "../../lib/careAssessment/careAssessmentRuntimeAccess.native.ts";
import { woundUuid } from '@/lib/pflege/woundCareDomain';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchPlanAmendmentHistory } from "../../lib/careAssessment/planAmendmentHistoryService.native.ts";
import { exportPlanAmendmentHistory } from "../../lib/careAssessment/planAmendmentHistoryExport.native.ts";
import { amendmentFieldLabels } from "../../lib/careAssessment/planAmendmentHistoryExport.native.ts";
import { planAmendmentDifferences } from '@/lib/careAssessment/planAmendmentDomain';
import { amendmentSourceStates, amendmentSourceStateLabels, type AmendmentSourceState } from '@/lib/careAssessment/planAmendmentSourceState';
import type { EvaluationRecord } from '@/lib/careAssessment/planEvaluationDomain';
import { decodePlanAmendmentHistory, planAmendmentHistoryVersion, type PlanAmendmentHistoryRecord } from '@/lib/careAssessment/planAmendmentHistoryDomain';
import type { CareAssessment } from '@/types/modules/careAssessment';
import type { RoleKey } from '@/types';
import { PlanDetails, EntryDetails } from "./PlanEvaluationDetails.native.tsx";
const body = { ...typography.body, color: colors.textSecondary };
function AmendmentOriginal({ record: r, sourceState }: {
    record: PlanAmendmentHistoryRecord;
    sourceState: AmendmentSourceState | null;
}) {
    const [expanded, setExpanded] = useState(false), p = r.payload;
    return <SectionPanel title={p.target.measures[0].title ?? 'Maßnahme ohne Titel'}>
  <Text style={body}>{r.actorName} · gespeichert {r.recordedAt}</Text>
  <Text style={body}>Planversion {String(r.result.planVersion)} · Änderungsstand {String(r.result.previousRevision)} → {String(r.result.draftRevision)} · Status {String(r.result.status)}</Text>
  {sourceState ? <InfoBanner variant={sourceState.state === 'unchanged' ? 'info' : 'warning'} message={`${amendmentSourceStateLabels[sourceState.state]}.${sourceState.currentHeadId ? ` Damaliger Kopf: ${sourceState.originalHeadId}. Aktueller Kopf: ${sourceState.currentHeadId}.` : ''} Der damalige Änderungsbeleg bleibt erhalten.`}/> : <InfoBanner variant="warning" message="Der aktuelle Zustand der Evaluationsquelle ist noch nicht geprüft. Die hier gezeigte damalige Originalquelle bleibt erhalten."/>}
  <Text style={body}>Begründung: {p.reason}</Text><Text style={body}>Personenentscheidung: {p.personDecision}</Text>
  {planAmendmentDifferences(p).map(d => <View key={d.field} style={{ gap: spacing.xs }}><Text style={{ ...body, fontWeight: '600' }}>{amendmentFieldLabels[d.field] ?? d.field}</Text><Text style={body}>Vorher: {d.before ?? 'Nicht angegeben'}</Text><Text style={body}>Bestätigte Änderung: {d.after ?? 'Nicht angegeben'}</Text></View>)}
  <PremiumButton title={expanded ? 'Originalquelle einklappen' : 'Damals verwendete Originalquelle anzeigen'} variant="secondary" onPress={() => setExpanded(v => !v)}/>
  {expanded ? <View style={{ gap: spacing.md }}><Text style={body}>Änderungsbeleg: {r.id}{'\n'}Originalanfrage: {r.requestId}{'\n'}Fachperson: {r.actorId}{'\n'}Vorbereitet: {p.preparedAt}{'\n'}Originalmaßnahme: {p.measureId}{'\n'}Evaluationsquelle: {p.source.headId}</Text><PlanDetails plan={p.source.root.snapshot}/><EntryDetails entry={p.source.events.at(-1)!.draft.entry!} plan={p.source.root.snapshot}/><InfoBanner variant="info" message="Hier steht die bei der Änderung verwendete Evaluationsfassung. Spätere Berichtigungen oder Rücknahmen stehen im Evaluationsverlauf. Das Änderungsoriginal bleibt erhalten."/></View> : null}
 </SectionPanel>;
}
export function PlanAmendmentHistory({ assessment, role, readBlocked, evaluations, sourceUnavailable }: {
    assessment: CareAssessment;
    role: RoleKey | null;
    readBlocked: boolean;
    evaluations: EvaluationRecord[] | null;
    sourceUnavailable: boolean;
}) {
    const { profile, user, portalSession } = useAuth(), runtimeTenantId = useServiceTenantId(), runtimeRole = resolveEffectiveRoleKey(profile, user, portalSession), [count, setCount] = useState(10), [error, setError] = useState('');
    // The parent's readBlocked includes its actual plans.view decision; resolving Auth context here performs no permissions query.
    const access = careAssessmentRuntimeAccess({ tenantId: assessment.tenantId, profileId: profile?.id, profileRole: profile?.roleKey, runtimeTenantId, runtimeRole, canView: !readBlocked && role === profile?.roleKey, canManage: false });
    const [owner] = useState(() => ({ tenantId: assessment.tenantId, assessmentId: assessment.id, clientId: assessment.subjectId, subjectType: assessment.subjectType, profileId: profile?.id ?? '', profileRole: profile?.roleKey ?? null })), alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const owned = assessment.tenantId === owner.tenantId && assessment.id === owner.assessmentId && assessment.subjectId === owner.clientId && assessment.subjectType === owner.subjectType && owner.subjectType === 'client' && profile?.id === owner.profileId && profile?.roleKey === owner.profileRole && role === owner.profileRole && runtimeTenantId === owner.tenantId && runtimeRole === owner.profileRole && [owner.tenantId, owner.assessmentId, owner.clientId, owner.profileId].every(woundUuid);
    const readScope = `${assessment.tenantId}:${profile?.id}:${profile?.roleKey}:${role}:${runtimeTenantId}:${runtimeRole}:${assessment.id}:${assessment.subjectId}:${assessment.subjectType}:${readBlocked}:${access.canRead}:${assessment.version}:${assessment.draftRevision}:${assessment.updatedAt}`;
    const q = useAsyncQuery(() => fetchPlanAmendmentHistory(assessment.tenantId, assessment.id, assessment.subjectId, role), [assessment.tenantId, assessment.id, assessment.subjectId, assessment.updatedAt, profile?.id, role], { enabled: owned && access.canRead, queryKey: `${readScope}:plan-amendments` });
    const previousScope = useRef(readScope), scopeChanged = previousScope.current !== readScope;
    previousScope.current = readScope;
    const pool = scopeChanged || !owned || !access.canRead ? null : q.data;
    const referenceNow = useMemo(() => Date.now(), [pool, evaluations, readScope]);
    const originals = useMemo(() => { if (!pool)
        return { records: null, error: '' }; try {
        return { records: decodePlanAmendmentHistory({ version: planAmendmentHistoryVersion, tenantId: assessment.tenantId, assessmentId: assessment.id, count: pool.length, records: pool }, assessment.tenantId, assessment.id, assessment.subjectId, referenceNow), error: '' };
    }
    catch (e) {
        return { records: null, error: e instanceof Error ? e.message : 'Vollständige Änderungsoriginale nicht bestätigt.' };
    } }, [pool, assessment.tenantId, assessment.id, assessment.subjectId, referenceNow]);
    const unavailable = !owned || !access.canRead || q.loading || q.refreshing || !!q.error || !!q.refreshError || !originals.records;
    const sourceComparison = useMemo(() => { if (unavailable || sourceUnavailable || !originals.records || !evaluations)
        return { states: null, error: '' }; try {
        return { states: new Map(amendmentSourceStates(originals.records, evaluations, assessment.tenantId, assessment.id, assessment.subjectId, referenceNow).map(s => [s.amendmentId, s])), error: '' };
    }
    catch (e) {
        return { states: null, error: e instanceof Error ? e.message : 'Aktueller Quellenverlauf nicht abgleichbar.' };
    } }, [unavailable, sourceUnavailable, originals.records, evaluations, assessment.tenantId, assessment.id, assessment.subjectId, referenceNow]);
    const exportState = useRef({ unavailable, assessment, profileId: profile?.id ?? '', profileRole: profile?.roleKey ?? null, role, runtimeTenantId, runtimeRole, canRead: access.canRead, records: originals.records, evaluations, sourceConfirmed: !!sourceComparison.states, refresh: q.refresh });
    exportState.current = { unavailable, assessment, profileId: profile?.id ?? '', profileRole: profile?.roleKey ?? null, role, runtimeTenantId, runtimeRole, canRead: access.canRead, records: originals.records, evaluations, sourceConfirmed: !!sourceComparison.states, refresh: q.refresh };
    function sameOwner(current: typeof exportState.current) { return alive.current && owner.subjectType === 'client' && [owner.tenantId, owner.assessmentId, owner.clientId, owner.profileId].every(woundUuid) && current.assessment.tenantId === owner.tenantId && current.assessment.id === owner.assessmentId && current.assessment.subjectId === owner.clientId && current.assessment.subjectType === owner.subjectType && current.profileId === owner.profileId && !!owner.profileRole && current.profileRole === owner.profileRole && current.role === owner.profileRole && current.runtimeTenantId === owner.tenantId && current.runtimeRole === owner.profileRole; }
    function currentRead(requireOriginals = true) { const current = exportState.current; if (!sameOwner(current) || !current.canRead)
        throw Error('Eigenen zugänglichen Pflegefall vor dem Lesen bestätigen.'); if (requireOriginals) {
        if (current.unavailable || !current.records)
            throw Error('Zugängliche vollständige Änderungsoriginale vor dem Auszug bestätigen.');
        decodePlanAmendmentHistory({ version: planAmendmentHistoryVersion, tenantId: owner.tenantId, assessmentId: owner.assessmentId, count: current.records.length, records: current.records }, owner.tenantId, owner.assessmentId, owner.clientId, Date.now());
    } return current; }
    async function output(mode: 'print' | 'html' | 'json') { try {
        const current = currentRead();
        setError('');
        await exportPlanAmendmentHistory(current.records!, owner.tenantId, owner.assessmentId, owner.clientId, mode, current.sourceConfirmed ? current.evaluations ?? undefined : undefined);
    }
    catch (e) {
        if (sameOwner(exportState.current) && exportState.current.canRead)
            setError(e instanceof Error ? e.message : 'Änderungsauszug nicht verfügbar.');
    } }
    async function refresh() { try {
        const current = currentRead(false);
        await current.refresh();
        currentRead(false);
    }
    catch (e) {
        if (sameOwner(exportState.current) && exportState.current.canRead)
            setError(e instanceof Error ? e.message : 'Änderungshistorie erneut laden.');
    } }
    if (!owned || !access.canRead)
        return <SectionPanel title="Historische Einzelmaßnahmenänderungen"><ErrorState message="Eigenen zugänglichen Pflegefall und Pflegeplan-Leserecht zuerst bestätigen."/></SectionPanel>;
    return <SectionPanel title="Historische Einzelmaßnahmenänderungen">
  <InfoBanner variant="info" message="Bestätigte Änderungen aus Einzelbewertungen mit ihrer damaligen Originalquelle. Dieser Bestand umfasst keine allgemeinen Planspeicherungen und bescheinigt keine Durchführung oder fachliche Freigabe."/>
  {readBlocked ? <InfoBanner variant="warning" message="Der Pflegefall wird aktualisiert oder ist nicht verfügbar. Änderungsverlauf und Export bleiben gesperrt."/> : null}
  {q.loading && !q.data ? <LoadingState message="Vollständige Änderungsoriginale werden geladen…"/> : null}
  {q.error || q.refreshError ? <ErrorState message={q.refreshError ?? q.error!} onRetry={refresh}/> : null}{error ? <ErrorState message={error}/> : null}
  {originals.error ? <ErrorState message={originals.error}/> : null}
  {sourceComparison.error ? <ErrorState message={sourceComparison.error}/> : null}
  {sourceUnavailable ? <InfoBanner variant="warning" message="Der aktuelle Evaluationsbestand wird geladen oder ist nicht fehlerfrei verfügbar. Spätere Quellenentscheidungen sind noch nicht geprüft. Der Originalauszug umfasst weiterhin die damals gespeicherten Quellen."/> : null}
  {!unavailable && originals.records ? <><Text style={body}>{originals.records.length} bestätigte Änderungsoriginale vollständig geladen.</Text>{!originals.records.length ? <InfoBanner variant="info" message="Keine bestätigten Einzelmaßnahmenänderungen in diesem Bestand."/> : null}{originals.records.slice(0, count).map(r => <AmendmentOriginal key={r.id} record={r} sourceState={sourceComparison.states?.get(r.id) ?? null}/>)}{count < originals.records.length ? <PremiumButton title="Weitere Änderungsoriginale anzeigen" variant="secondary" onPress={() => setCount(n => n + 10)}/> : null}</> : null}
  <Text style={body}>Der Auszug enthält alle geladenen Originale. Ein fehlerfrei geladener aktueller Quellenverlauf wird getrennt beigefügt. Ohne diesen Abgleich bleibt der aktuelle Quellenzustand ausdrücklich ungeprüft. Dateien enthalten vertrauliche Pflegeinformationen.</Text>
  {(['print', 'html', 'json'] as const).map(mode => <PremiumButton key={mode} title={{ print: 'Änderungsoriginale drucken', html: 'Änderungsauszug als HTML herunterladen', json: 'Änderungsoriginale als JSON herunterladen' }[mode]} variant="secondary" disabled={unavailable} onPress={() => output(mode)}/>)}
  <PremiumButton title="Vollständige Änderungshistorie neu laden" variant="secondary" disabled={readBlocked || q.loading || q.refreshing} onPress={refresh}/>
 </SectionPanel>;
}
