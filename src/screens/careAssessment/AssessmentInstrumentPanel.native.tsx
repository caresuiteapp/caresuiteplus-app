// Generated native presentation from src/screens/careAssessment/AssessmentInstrumentPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAssessmentNativeDraft } from "../../lib/careAssessment/useAssessmentNativeDraft.native.ts";
import { readAssessmentInstrumentSnapshot } from "../../lib/careAssessment/assessmentInstrumentRepository.supabase.native.ts";
import { assessmentInstrumentPacketIssue, makeAssessmentInstrumentPacket, type AssessmentInstrumentPacket, type AssessmentInstrumentSnapshot } from "../../lib/careAssessment/assessmentInstrumentPacket.native.ts";
import type { RoleKey } from '@/types';
import { colors, spacing, typography } from '@/theme';
type InstrumentPanelState = {
    packet: AssessmentInstrumentPacket | null;
    issue: string | null;
    dirty: boolean;
    loading: boolean;
};
export function AssessmentInstrumentPanel({ tenantId, assessmentId, subjectId, actorId, role, riskKeys, editable, reviewRequested, onState, isCurrent, isLeaving, registerLeave }: {
    tenantId: string;
    assessmentId: string;
    subjectId: string;
    actorId: string;
    role?: RoleKey | null;
    riskKeys: string[];
    editable: boolean;
    reviewRequested: boolean;
    onState: (state: InstrumentPanelState) => void;
    isCurrent?(): boolean;
    isLeaving?(): boolean;
    registerLeave?(guard: (() => Promise<boolean>) | null): void;
}) {
    const callback = useRef(onState);
    callback.current = onState;
    const native = useAssessmentNativeDraft<AssessmentInstrumentSnapshot, {
        selected: string[];
        rationale: string;
    }>({ identity: `${tenantId}:${assessmentId}:${subjectId}:${actorId}:${role}`, editable, isCurrent, isLeaving, registerLeave,
        empty: () => ({ selected: [], rationale: '' }), fromNative: snapshot => ({ selected: [...snapshot.selection.selectedInstrumentIds].sort(), rationale: snapshot.selection.rationale }),
        dirty: (draft, snapshot) => JSON.stringify([...draft.selected].sort()) !== JSON.stringify([...snapshot.selection.selectedInstrumentIds].sort()) || draft.rationale.trim() !== snapshot.selection.rationale.trim(),
        read: current => readAssessmentInstrumentSnapshot({ tenantId, assessmentId, subjectId, actorId, role, isCurrent: current }),
        onPhase: phase => callback.current({ packet: null, issue: phase.busy ? 'Instrumenten- und Modellbestand wird bestätigt.' : phase.stale ? 'Aktuellen nativen Instrumentenstand ausdrücklich bestätigen.' : null, dirty: phase.dirty, loading: phase.busy }),
    });
    const { selected, rationale } = native.draft, snapshot = native.native, editableNow = editable && native.current() && !native.busy && !native.stale && !isLeaving?.();
    const riskSignature = [...new Set(riskKeys)].sort().join('\u001f');
    const computed = useMemo(() => {
        if (!snapshot || native.busy || native.stale || !native.current())
            return { packet: null, issue: native.error ?? 'Instrumenten- und Modellbestand vollständig bestätigen.', dirty: native.dirty };
        try {
            const packet = makeAssessmentInstrumentPacket(snapshot, selected, rationale, riskSignature ? riskSignature.split('\u001f') : []), issue = assessmentInstrumentPacketIssue(packet, riskSignature ? riskSignature.split('\u001f') : [], reviewRequested);
            return { packet, issue, dirty: native.dirty };
        }
        catch (error) {
            return { packet: null, issue: error instanceof Error ? error.message : 'Instrumentenauswahl prüfen.', dirty: true };
        }
    }, [snapshot, selected, rationale, riskSignature, reviewRequested, native.busy, native.stale, native.error, native.dirty, native.revision]);
    useEffect(() => { callback.current({ packet: computed.packet, issue: computed.issue, dirty: computed.dirty, loading: native.busy }); }, [computed.packet, computed.issue, computed.dirty, native.busy]);
    if (native.busy && !snapshot)
        return <SectionPanel title="Assessmentmodell und Instrumente"><LoadingState message="Berechtigten Instrumentenbestand laden…"/></SectionPanel>;
    if (!snapshot)
        return <SectionPanel title="Assessmentmodell und Instrumente"><ErrorState message={native.error ?? 'Instrumentenbestand fehlt.'}/><PremiumButton title="Instrumentenbestand erneut laden" onPress={native.refresh}/></SectionPanel>;
    const available = snapshot.instruments.filter(item => item.availability === 'active' && ['owned', 'licensed'].includes(item.licenseState));
    const unavailable = snapshot.instruments.filter(item => !available.includes(item));
    const matching = available.filter(item => !item.riskKeys.length || item.riskKeys.some(key => riskKeys.includes(key)));
    return <SectionPanel title="Assessmentmodell und Instrumente" subtitle="Gemeinsam mit diesem Entwurf versioniert">
  <InfoBanner variant="info" title={`${snapshot.model.title} · Version ${snapshot.model.version}`} message={snapshot.model.claim === 'product_model' ? 'CareSuite-eigenes Pflegeassessment. Daraus wird keine SIS-/EinSTEP- oder sonstige externe Standardfreigabe abgeleitet.' : 'Externes Standardmodell bleibt bis zur nachgewiesenen Lizenz- und Fachfreigabe gesperrt.'}/>
  {native.error ? <InfoBanner variant="warning" title="Aktualisierung nicht bestätigt" message={native.error}/> : null}
  {!matching.length ? <EmptyState title="Kein verfügbares Instrument zum aktuellen Risikostand" message="Risikobefund und Instrumentenbestand bleiben getrennt; es wird keine Auswahl automatisch erfunden."/> :
            <><Text style={{ ...typography.body, color: colors.textMuted }}>Aktive, für die dokumentierten Risiken verfügbare Instrumente</Text><FilterChipGroup wrap multiple minSelected={0} options={matching.map(item => ({ key: item.id, label: `${item.title} · ${item.version}` }))} value={selected} onChange={editableNow ? next => native.change(draft => ({ ...draft, selected: next })) : undefined}/></>}
  {available.filter(item => !matching.includes(item)).map(item => <InfoBanner key={item.id} variant="warning" title={`${item.title} nicht passend auswählbar`} message="Aktuell fehlt der zugehörige dokumentierte Risikobezug. Das Instrument wird nicht automatisch als Befund übernommen."/>)}
  {unavailable.map(item => <InfoBanner key={item.id} variant="warning" title={`${item.title} · nicht verfügbar`} message={item.licenseState === 'unverified' ? 'Lizenz-/Nutzungsrecht und fachliche Freigabe sind nicht nachgewiesen.' : 'Diese Fassung ist in diesem Mandanten nicht aktiv verfügbar.'}/>)}
  <PremiumInput label="Pflegefachliche Begründung der Modell- und Instrumentenwahl" value={rationale} onChangeText={next => native.change(draft => ({ ...draft, rationale: next }))} multiline maxLength={4000} editable={editableNow}/>
  {computed.issue ? <InfoBanner variant="danger" title="Speicher- oder Prüfsperre" message={computed.issue}/> : null}
  <View style={{ gap: spacing.xs }}><Text style={{ ...typography.body, color: colors.textMuted }}>Katalogstand {snapshot.catalogRevision} · gespeicherte Auswahlrevision {snapshot.selection.revision}</Text><Text style={{ ...typography.body, color: computed.dirty ? colors.warning : colors.success }}>{computed.dirty ? 'Auswahl geändert – wird erst mit dem gesamten Assessment gespeichert.' : 'Auswahl entspricht dem vollständig gelesenen nativen Stand.'}</Text></View>
  <PremiumButton title="Nativen Instrumentenstand neu laden" variant="ghost" disabled={native.busy} loading={native.busy} onPress={native.refresh}/>
 </SectionPanel>;
}
