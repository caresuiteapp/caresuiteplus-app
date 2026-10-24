// Generated native presentation from src/screens/careAssessment/PlanLifecyclePanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto,nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { readPlanLifecycleSnapshot } from "../../lib/careAssessment/planLifecycleRepository.supabase.native.ts";
import { makePlanLifecyclePacket, planLifecyclePacketIssue, type PlanDayRoutine, type PlanLifecyclePacket, type PlanQualityVisit, type PlanSupportBoundary } from "../../lib/careAssessment/planLifecyclePacket.native.ts";
import type { CareAssessmentMeasure, CareAssessmentTopicKey } from '@/types/modules/careAssessment';
import type { RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';
type State = {
    packet: PlanLifecyclePacket | null;
    issue: string | null;
    dirty: boolean;
    loading: boolean;
};
const id = () => crypto.randomUUID();
const topicLabels: Record<CareAssessmentTopicKey, string> = { cognition_communication: 'Kognition und Kommunikation', mobility: 'Mobilität', disease_demands: 'Krankheitsbezogene Anforderungen', self_care: 'Selbstversorgung', social_relationships: 'Soziale Beziehungen', living_environment: 'Haushaltsführung' };
export function PlanLifecyclePanel({ tenantId, assessmentId, subjectId, actorId, role, measures, topicKeys, editable, reviewRequested, onState }: {
    tenantId: string;
    assessmentId: string;
    subjectId: string;
    actorId: string;
    role?: RoleKey | null;
    measures: CareAssessmentMeasure[];
    topicKeys: CareAssessmentTopicKey[];
    editable: boolean;
    reviewRequested: boolean;
    onState: (state: State) => void;
}) {
    const query = useAsyncQuery(() => readPlanLifecycleSnapshot({ tenantId, assessmentId, subjectId, actorId, role }), [tenantId, assessmentId, subjectId, actorId, role], { enabled: !!tenantId && !!assessmentId && !!subjectId && !!actorId, queryKey: `${tenantId}:${assessmentId}:${subjectId}:${actorId}:${role}:plan-lifecycle` });
    const [routines, setRoutines] = useState<PlanDayRoutine[]>([]), [supports, setSupports] = useState<PlanSupportBoundary[]>([]), [visit, setVisit] = useState<PlanQualityVisit | null>(null), [reason, setReason] = useState('');
    const adopted = useRef('');
    const snapshot = query.data;
    const identity = snapshot ? `${snapshot.packetRevision}:${snapshot.packetUpdatedAt ?? ''}:${snapshot.planVersion}` : '';
    useEffect(() => { if (!snapshot || adopted.current === identity)
        return; adopted.current = identity; setRoutines(structuredClone(snapshot.dayRoutines)); setSupports(structuredClone(snapshot.supportBoundaries)); setVisit(snapshot.qualityVisit ? structuredClone(snapshot.qualityVisit) : null); setReason(''); }, [snapshot, identity]);
    const computed = useMemo(() => { if (!snapshot)
        return { packet: null, issue: query.error ?? query.refreshError ?? 'Planlebenszyklus vollständig laden.', dirty: false }; try {
        const packet = makePlanLifecyclePacket(snapshot, measures, routines, supports, visit, reason), issue = planLifecyclePacketIssue(packet, measures, reviewRequested), dirty = JSON.stringify({ measures, routines, supports, visit }) !== JSON.stringify({ measures: snapshot.measureOriginals, routines: snapshot.dayRoutines, supports: snapshot.supportBoundaries, visit: snapshot.qualityVisit }) || !!reason.trim();
        return { packet, issue, dirty };
    }
    catch (error) {
        return { packet: null, issue: error instanceof Error ? error.message : 'Planlebenszyklus prüfen.', dirty: true };
    } }, [snapshot, measures, routines, supports, visit, reason, reviewRequested, query.error, query.refreshError]);
    const callback = useRef(onState);
    callback.current = onState;
    useEffect(() => { callback.current({ ...computed, loading: query.loading || query.refreshing }); }, [computed.packet, computed.issue, computed.dirty, query.loading, query.refreshing]);
    const patchRoutine = (index: number, next: Partial<PlanDayRoutine>) => setRoutines(current => current.map((item, i) => i === index ? { ...item, ...next } : item));
    const patchSupport = (index: number, next: Partial<PlanSupportBoundary>) => setSupports(current => current.map((item, i) => i === index ? { ...item, ...next } : item));
    const patchVisit = (next: Partial<PlanQualityVisit>) => setVisit(current => current ? { ...current, ...next } : current);
    if (query.loading)
        return <SectionPanel title="Planlebenszyklus"><LoadingState message="Tagesstruktur, Unterstützungsgrenzen und Pflegevisite laden…"/></SectionPanel>;
    if (query.error || !snapshot)
        return <SectionPanel title="Planlebenszyklus"><ErrorState message={query.error ?? 'Planlebenszyklus fehlt.'}/><PremiumButton title="Planstand erneut laden" onPress={query.refresh}/></SectionPanel>;
    return <SectionPanel title="Planlebenszyklus" subtitle={`Planversion ${snapshot.planVersion} · Paketrevision ${snapshot.packetRevision}`}>
  <InfoBanner variant="info" title="Gemeinsamer Planstand" message="Ziele und Maßnahmen, Tagesstruktur, Unterstützungsgrenzen, Evaluationsfristen und Pflegevisite werden gemeinsam mit derselben Assessment-Anfrage gespeichert. Geplante Hilfe bleibt von tatsächlicher Durchführung getrennt."/>
  {query.refreshError ? <InfoBanner variant="warning" title="Aktualisierung nicht bestätigt" message={query.refreshError}/> : null}
  <Text style={{ ...typography.h3 }}>Tagesstruktur und Gewohnheiten</Text>
  {!routines.length ? <EmptyState title="Noch keine Tagesstruktur" message="Zeitfenster und Präferenzen werden nicht aus Maßnahmenfreitext erfunden."/> : routines.map((item, index) => <View key={item.id} style={{ gap: spacing.sm, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, padding: spacing.md }}>
   <PremiumInput label="Situation / Ablauf" value={item.label} onChangeText={next => patchRoutine(index, { label: next })} editable={editable}/><PremiumInput label="Zeitfenster" value={item.timeWindow} onChangeText={next => patchRoutine(index, { timeWindow: next })} editable={editable}/><PremiumInput label="Ritual" value={item.ritual} onChangeText={next => patchRoutine(index, { ritual: next })} editable={editable}/><PremiumInput label="Individuelle Präferenz" value={item.preference} onChangeText={next => patchRoutine(index, { preference: next })} multiline editable={editable}/><PremiumInput label="Abhängigkeit / Reihenfolge" value={item.dependency} onChangeText={next => patchRoutine(index, { dependency: next })} multiline editable={editable}/><PremiumInput label="Verantwortliche Rolle" value={item.responsibleRole} onChangeText={next => patchRoutine(index, { responsibleRole: next })} editable={editable}/>
   <FilterChipGroup wrap options={[{ key: 'planned', label: 'Geplant' }, { key: 'active', label: 'Aktiv' }, { key: 'paused', label: 'Pausiert' }]} value={item.status} onChange={editable ? next => patchRoutine(index, { status: next as PlanDayRoutine['status'] }) : undefined}/>{editable ? <PremiumButton title="Tagesstruktureintrag entfernen" variant="ghost" onPress={() => setRoutines(current => current.filter((_, i) => i !== index).map((entry, i) => ({ ...entry, sequence: i })))}/> : null}
  </View>)}
  <PremiumButton title="+ Tagesstruktureintrag" variant="secondary" disabled={!editable} onPress={() => setRoutines(current => [...current, { id: id(), sequence: current.length, label: '', timeWindow: '', ritual: '', preference: '', dependency: '', responsibleRole: '', status: 'planned' }])}/>
  <Text style={{ ...typography.h3 }}>Ressourcen und Unterstützungsgrenzen</Text>
  {!supports.length ? <EmptyState title="Noch keine Unterstützungsgrenze" message="Eigenleistung, Anleitung, Teilhilfe und vollständige Übernahme bleiben ausdrücklich unterscheidbar."/> : supports.map((item, index) => <View key={item.id} style={{ gap: spacing.sm, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, padding: spacing.md }}>
   <FilterChipGroup wrap options={topicKeys.map(key => ({ key, label: topicLabels[key] }))} value={item.topicKey} onChange={editable ? next => patchSupport(index, { topicKey: next as CareAssessmentTopicKey }) : undefined}/><PremiumInput label="Eigenleistung" value={item.ownContribution} onChangeText={next => patchSupport(index, { ownContribution: next })} multiline editable={editable}/><PremiumInput label="Anleitung" value={item.guidance} onChangeText={next => patchSupport(index, { guidance: next })} multiline editable={editable}/><PremiumInput label="Teilunterstützung" value={item.partialSupport} onChangeText={next => patchSupport(index, { partialSupport: next })} multiline editable={editable}/><PremiumInput label="Vollständige Übernahme" value={item.fullSupport} onChangeText={next => patchSupport(index, { fullSupport: next })} multiline editable={editable}/><PremiumInput label="Grenze / Abbruchkriterium" value={item.stopBoundary} onChangeText={next => patchSupport(index, { stopBoundary: next })} multiline editable={editable}/><PremiumInput label="Verantwortliche Rolle" value={item.responsibleRole} onChangeText={next => patchSupport(index, { responsibleRole: next })} editable={editable}/>{editable ? <PremiumButton title="Unterstützungsgrenze entfernen" variant="ghost" onPress={() => setSupports(current => current.filter((_, i) => i !== index))}/> : null}
  </View>)}
  <PremiumButton title="+ Unterstützungsgrenze" variant="secondary" disabled={!editable || !topicKeys.length} onPress={() => setSupports(current => [...current, { id: id(), topicKey: topicKeys[0], ownContribution: '', guidance: '', partialSupport: '', fullSupport: '', stopBoundary: '', responsibleRole: '' }])}/>
  <Text style={{ ...typography.h3 }}>Pflegevisite und Rückkopplung</Text>
  {!visit ? <EmptyState title="Keine Pflegevisite geplant" message="Eine Visite wird nur nach ausdrücklicher Planung angelegt und nicht durch Öffnen abgeschlossen."/> : <View style={{ gap: spacing.sm, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 16, padding: spacing.md }}>
   <PremiumInput label="Geplanter Termin (ISO)" value={visit.plannedAt} onChangeText={next => patchVisit({ plannedAt: next })} editable={editable}/><PremiumInput label="Beteiligte" value={visit.participants} onChangeText={next => patchVisit({ participants: next })} multiline editable={editable}/><PremiumInput label="Prüfpunkte" value={visit.checkpoints} onChangeText={next => patchVisit({ checkpoints: next })} multiline editable={editable}/><PremiumInput label="Festgestellte Abweichungen" value={visit.deviations} onChangeText={next => patchVisit({ deviations: next })} multiline editable={editable}/><PremiumInput label="Beschluss" value={visit.decision} onChangeText={next => patchVisit({ decision: next })} multiline editable={editable}/><PremiumInput label="Umsetzung bis (ISO)" value={visit.implementationDueAt} onChangeText={next => patchVisit({ implementationDueAt: next })} editable={editable}/><PremiumInput label="Nachhalten am (ISO)" value={visit.followUpAt} onChangeText={next => patchVisit({ followUpAt: next })} editable={editable}/><InfoBanner variant="info" message="Planung oder Dokumentation der Visite bestätigt weder Durchführung noch Umsetzung. Beides benötigt spätere eigene Originalbelege."/>{editable ? <PremiumButton title="Visitenentwurf entfernen" variant="ghost" onPress={() => setVisit(null)}/> : null}
  </View>}
  {!visit ? <PremiumButton title="+ Pflegevisite planen" variant="secondary" disabled={!editable} onPress={() => setVisit({ id: id(), plannedAt: '', participants: '', checkpoints: '', deviations: '', decision: '', implementationDueAt: '', followUpAt: '', state: 'planned' })}/> : null}
  <PremiumInput label="Änderungs- oder Freigabegrund" value={reason} onChangeText={setReason} multiline maxLength={4000} editable={editable}/>
  {computed.issue ? <InfoBanner variant="danger" title="Speicher- oder Prüfsperre" message={computed.issue}/> : null}
  <Text style={{ ...typography.body, color: computed.dirty ? colors.warning : colors.success }}>{computed.dirty ? 'Planlebenszyklus geändert – wird erst mit dem gesamten Assessment gespeichert.' : 'Planlebenszyklus entspricht dem vollständig gelesenen nativen Stand.'}</Text>
  <PremiumButton title="Nativen Planstand neu laden" variant="ghost" disabled={query.refreshing} loading={query.refreshing} onPress={query.refresh}/>
 </SectionPanel>;
}
