// Generated native presentation from src/screens/careAssessment/PlanReviewControlList.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { InfoBanner, PremiumButton, SectionPanel } from '@/components/ui';
import { useCareRuntimePermissions as usePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { colors, spacing, typography } from '@/theme';
import { reviewControlSourceLabels, type ReviewControlLink, type ReviewMeasureControl } from '@/lib/careAssessment/planReviewControls';
import { controlStatusLabels, controlTaskStatusLabel } from '@/lib/pflege/clinicalControlForm';
import { ControlFollowUpDetails } from "../pflege/ControlFollowUpDetails.native.tsx";
const body = { ...typography.body, color: colors.textSecondary };
function ControlDetails({ link, disabled }: {
    link: ReviewControlLink | ReviewMeasureControl;
    disabled: boolean;
}) {
    const router = useRouter(), p = usePermissions(), [showResults, setShowResults] = useState(false), [resultCount, setResultCount] = useState(5), s = link.state;
    return <SectionPanel title={s.title}>
  <Text style={body}>Auftrag {link.record.task.id} · Fassung {link.record.eventCount}{'\n'}{controlTaskStatusLabel(s.source.kind, s.status)} · {controlStatusLabels[s.policy.priority]}</Text>
  <Text style={body}>{link.scope === 'measure' ? 'Einzelauftrag für die ursprüngliche Maßnahme' : 'Ein gemeinsamer Auftrag für alle damals ausgewählten Maßnahmen'}. Gesamter ursprünglicher Auftragsumfang: {link.scopePlanRelation === 'current' ? 'Inhalt und Planversion passen zum aktuellen Plan' : 'Historischer oder teilweise entfernter Planbezug'}.</Text>
  {'planRelation' in link ? <Text style={body}>Bezug dieser aktuellen Einzelmaßnahme: {link.planRelation === 'current' ? 'Inhalt und Planversion stimmen überein' : 'Ursprünglicher Inhalt oder Planversion weicht ab'}.</Text> : null}
  <Text style={body}>Auftragsfrist: {s.policy.dueAt}{s.overdue ? ' · Erreicht/überschritten' : ''}{'\n'}Eskalationsfrist: {s.policy.escalationAt} · {controlStatusLabels[s.escalationState]}{'\n'}Zuständig: {s.policy.assigneeId} · Vertretung: {s.policy.backupId || 'Keine vereinbart'}{'\n'}Eskalationsperson: {s.policy.escalationRecipientId}</Text>
  <Text style={body}>Anlass: {s.reason}{'\n'}Auftrag: {s.instruction}</Text>
  <InfoBanner variant={link.sourceState.state === 'unchanged' && link.scopePlanRelation === 'current' ? 'info' : 'warning'} message={`Auftragsquelle: ${reviewControlSourceLabels[link.sourceState.state]}. Damaliger Kopf ${link.sourceState.originalHeadId}; aktueller Kopf ${link.sourceState.currentHeadId ?? 'nicht verfügbar'}.`}/>
  {link.removedMeasureIds.length ? <Text style={body}>Im aktuellen Plan entfernte Originalmaßnahmen: {link.removedMeasureIds.join(', ')}</Text> : null}
  <Text style={body}>{s.attempts} Ergebnis-/Teilkontrollereignisse im gesamten Verlauf. Der aktuelle Auftrag bleibt bei einer Wiedereröffnung offen; frühere Ergebnisse bleiben erhalten.</Text>
  {link.followUps.length ? <Text style={body}>{link.followUps.length} ausdrückliche Folgeauftragsbezüge in den Ergebnisbelegen. Die aktuelle Verfügbarkeit und der dokumentierte Verlauf des Zielauftrags werden für jeden Bezug getrennt gezeigt.</Text> : null}
  {link.results.length ? <PremiumButton title={showResults ? 'Ergebnisbelege einklappen' : `${link.results.length} Ergebnisbelege mit tatsächlichen Zeitpunkten anzeigen`} variant="secondary" onPress={() => setShowResults(v => !v)}/> : <Text style={body}>Kein tatsächliches Ergebnis oder Teilkontrollereignis in diesem Auftrag dokumentiert.</Text>}
  {showResults ? link.results.slice(0, resultCount).map(r => {
            const d = r.event.draft;
            if (d.kind !== 'attempt' && d.kind !== 'resolve')
                return null;
            return <View key={r.event.id} style={{ gap: spacing.xs }}>
   <Text style={body}>{r.currentCycle ? 'Ergebnis der aktuellen Auftragsfassung' : 'Historisches Ergebnis einer früheren Auftragsfassung'} · {controlTaskStatusLabel(s.source.kind, d.outcome)}{'\n'}Tatsächliches Auftragsresultat: {d.occurredAt}{'\n'}Erfasst: {r.event.recordedAt} · {link.record.actorNames[r.event.id]}</Text><Text style={body}>{d.result}{'\n'}{d.reason}{'\n'}Abstimmung: {d.communication}{'\n'}Personenentscheidung: {d.personDecision}</Text>
   {d.evidence ? <Text style={body}>Eigene Folgeevaluation: {String(d.evidence.snapshot.occurred_at)} · Originalkopf {d.evidence.id}</Text> : null}
   {r.sourceState ? <InfoBanner variant={r.sourceState.state === 'unchanged' ? 'info' : 'warning'} message={`Ergebnisquelle: ${reviewControlSourceLabels[r.sourceState.state]}. Aktueller Kopf ${r.sourceState.currentHeadId ?? 'nicht verfügbar'}. Der gespeicherte Aufgabenstatus bleibt separat erhalten.`}/> : null}
   {r.followUp ? <ControlFollowUpDetails relation={r.followUp} disabled={disabled}/> : d.kind === 'resolve' ? <Text style={body}>Abschluss ohne Folgeauftrag: {d.noFollowUpReason}</Text> : null}
  </View>;
        }) : null}
  {showResults && resultCount < link.results.length ? <PremiumButton title="Weitere Ergebnisbelege anzeigen" variant="secondary" onPress={() => setResultCount(n => n + 5)}/> : null}
  {p.can('pflege.documentation.view') && p.can('pflege.treatment.view') && p.can('pflege.orders.view') ? <PremiumButton title="Diesen bestehenden Auftrag mit vollständigem Verlauf öffnen" variant="secondary" disabled={disabled} onPress={() => router.push({ pathname: '/pflege/behandlungspflege', params: { view: 'controls', clientId: link.record.task.clientId, taskId: link.record.task.id } } as never)}/> : null}
 </SectionPanel>;
}
export function PlanReviewControlList({ links, disabled }: {
    links: (ReviewControlLink | ReviewMeasureControl)[];
    disabled: boolean;
}) {
    const [count, setCount] = useState(3);
    return <View style={{ gap: spacing.md }}>{!links.length ? <Text style={body}>Kein zugeordneter Evaluations-Prüfauftrag im vollständig geladenen Kontrollbestand.</Text> : links.slice(0, count).map(link => <ControlDetails key={link.record.task.id + ':' + link.record.headId} link={link} disabled={disabled}/>)}{count < links.length ? <PremiumButton title="Weitere zugeordnete Aufträge anzeigen" variant="secondary" onPress={() => setCount(n => n + 3)}/> : null}</View>;
}
