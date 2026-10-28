// Generated native presentation from src/screens/pflege/ControlFollowUpDetails.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { InfoBanner, PremiumButton, SectionPanel } from '@/components/ui';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { colors, spacing, typography } from '@/theme';
import { controlFollowUpComparisonLabels, type ControlFollowUpRelation } from '@/lib/pflege/clinicalControlFollowUps';
import { controlSourceLabels, controlStatusLabels, controlTaskStatusLabel } from '@/lib/pflege/clinicalControlForm';
const body = { ...typography.body, color: colors.textSecondary };
/** Existing explicit links only; no creation or completion is inferred from their presence. */
export function ControlFollowUpDetails({ relation, disabled, onOpen }: {
    relation: ControlFollowUpRelation;
    disabled: boolean;
    onOpen?: (relation: ControlFollowUpRelation) => void;
}) {
    const router = useRouter(), p = usePermissions(), s = relation.targetState, prefix = relation.recordedPrefix;
    const allowed = p.can('pflege.documentation.view') && p.can('pflege.treatment.view') && p.can('pflege.orders.view');
    return <SectionPanel title="Ausdrücklich dokumentierter Folgeauftrag">
  <InfoBanner variant={relation.comparison === 'open_at_recording' ? 'info' : 'warning'} message={controlFollowUpComparisonLabels[relation.comparison]}/>
  <View style={{ gap: spacing.xs }}>
   <Text style={body}>Ursprungsauftrag: {relation.originTaskId}{'\n'}Abschlussereignis: {relation.eventId}{'\n'}Benannter Folgeauftrag: {relation.targetTaskId}</Text>
   <Text style={body}>{relation.currentCycle ? 'Abschluss der aktuellen Ursprungsauftragsfassung' : 'Historischer Abschluss einer früheren Ursprungsauftragsfassung'}{'\n'}Tatsächlicher Abschlusszeitpunkt: {relation.occurredAt}{'\n'}Abschluss erfasst: {relation.recordedAt}</Text>
   {s && relation.target ? <><Text style={body}>Aktuell vollständig geladener Folgeauftrag: {s.title}{'\n'}{controlTaskStatusLabel(s.source.kind, s.status)}{'\n'}Aktueller Originalkopf: {relation.target.headId} · Fassung {relation.target.eventCount}</Text>
    <Text style={body}>Aktuelle Aufgabenfrist: {s.policy.dueAt}{s.overdue ? ' · Erreicht/überschritten' : ''}{'\n'}Aktuelle Eskalationsfrist: {s.policy.escalationAt} · {controlStatusLabels[s.escalationState]}{'\n'}Zuständig (Originalkennung): {s.policy.assigneeId}{'\n'}Quelle: {controlSourceLabels[s.source.kind]} · {s.source.id}</Text>
   </> : <Text style={body}>Der benannte Originalauftrag ist im aktuellen vollständig geladenen Bestand nicht zugänglich. Seine Existenz, sein aktueller Status und seine Fristen lassen sich hier nicht bestätigen.</Text>}
   {prefix ? <><Text style={body}>Dokumentierter Zielverlauf bis zur Abschluss-Erfassung: Kopf {prefix.headId} · Fassung {prefix.sequence}{'\n'}Dokumentierter Status: {controlTaskStatusLabel(s?.source.kind ?? '', prefix.status)}{'\n'}Dort vereinbarte Aufgabenfrist: {prefix.policy.dueAt}{'\n'}Dort vereinbarte Eskalationsfrist: {prefix.policy.escalationAt}</Text><Text style={body}>Dieser Ausschnitt zeigt den heute geladenen Originalverlauf bis zum damaligen Erfassungszeitpunkt. Er belegt keinen damals gleichzeitig gültigen oder gesicherten Auftragsschreibstand.</Text></> : null}
   {relation.sameTimeEventIds.length ? <Text style={body}>Zeitgleich erfasste Zielereignisse: {relation.sameTimeEventIds.join(', ')}. Die Reihenfolge zwischen den Aufträgen bleibt unklar.</Text> : null}
   <Text style={body}>Der Folgeauftrag kann eine andere Originalquelle oder ein anderes Assessment betreffen. Seine Zuordnung bescheinigt keine ausgeführte Kontrolle, keine Erfüllung und keine Freigabe.</Text>
  </View>
  {allowed && relation.target && s ? <PremiumButton title="Bestehenden Folgeauftrag mit vollständigem Originalverlauf öffnen" variant="secondary" disabled={disabled} onPress={() => { if (disabled)
        return; if (onOpen) {
        onOpen(relation);
        return;
    } router.push({ pathname: '/pflege/behandlungspflege', params: { view: 'controls', clientId: relation.target!.task.clientId, taskId: relation.targetTaskId } } as never); }}/> : null}
 </SectionPanel>;
}
