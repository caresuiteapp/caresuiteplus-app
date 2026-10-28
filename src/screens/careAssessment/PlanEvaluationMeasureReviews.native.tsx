// Generated native presentation from src/screens/careAssessment/PlanEvaluationMeasureReviews.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useState } from 'react';
import { View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { FilterChipGroup, InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { evaluationNames as names, evaluationLabels as labels } from '@/lib/careAssessment/planEvaluationLabels';
import type { EvaluationEntry, EvaluationPlan } from '@/lib/careAssessment/planEvaluationDomain';
import { measureReviewProgress, type EvaluationMeasureReview } from '@/lib/careAssessment/planEvaluationMeasures';
const body = { ...typography.body, color: colors.textSecondary };
type ReviewKey = Exclude<keyof EvaluationMeasureReview, 'measureId'>;
const textFields: ReviewKey[] = ['observedEffect', 'personFeedback', 'professionalConclusion', 'nextActionReason', 'reviewReason'];
const options: Record<string, string[]> = { source: ['observed', 'reported'], outcome: ['effective', 'partly_effective', 'not_effective', 'deteriorated', 'not_assessable'], feedbackState: ['given', 'declined', 'not_possible'], nextAction: ['continue', 'adjust', 'reassess', 'clarify'], reviewState: ['scheduled', 'pending', 'not_required'] };
const choiceLabels: Record<string, string> = { source: 'Herkunft dieser Beobachtung', outcome: 'Wirkung dieser Maßnahme anhand des Originalkriteriums', feedbackState: 'Personenrückmeldung zu dieser Maßnahme', nextAction: 'Weitere Entscheidung zu dieser Maßnahme', reviewState: 'Weitere Prüfung dieser Maßnahme' };
export function MeasureReviewEditor({ plan, entry, locked, onChange }: {
    plan: EvaluationPlan;
    entry: EvaluationEntry;
    locked: boolean;
    onChange: (id: string, key: ReviewKey, value: string) => void;
}) {
    const [index, setIndex] = useState(0), progress = measureReviewProgress(entry, plan), m = plan.measures[index], row = entry.measureReviews?.find(r => r.measureId === m?.id);
    if (!m || !row)
        return <InfoBanner variant="error" message="Die Einzelbewertung zur Originalmaßnahme fehlt. Evaluation neu öffnen."/>;
    const input = (key: ReviewKey, label = labels[key], multiline = false) => <PremiumInput key={key} label={label} accessibilityLabel={label} multiline={multiline} value={row[key]} editable={!locked} onChangeText={v => onChange(row.measureId, key, v)}/>;
    const choice = (key: ReviewKey) => <View key={key} style={{ gap: spacing.xs }}><Text style={body}>{choiceLabels[key]}</Text><FilterChipGroup wrap options={options[key].map(k => ({ key: k, label: names[k] }))} value={row[key]} onChange={locked ? undefined : v => onChange(row.measureId, key, v)}/></View>;
    return <SectionPanel title={`Einzelbewertung ${index + 1} von ${plan.measures.length}`}>
  <Text style={body}>Vollständig ausgefüllte Einzelbewertungen: {progress.complete} von {progress.total}. Die fachliche Beurteilung bleibt gesondert erforderlich.</Text><PremiumButton title="Erste unvollständige Einzelbewertung öffnen" variant="secondary" disabled={progress.firstIncomplete === -1} onPress={() => setIndex(progress.firstIncomplete)}/><Text style={body}>{m.title}</Text><Text style={body}>Ursprüngliches Ziel: {m.personalGoal}</Text><Text style={body}>Ursprüngliches Prüfkriterium: {m.evaluationCriteria}</Text><Text style={body}>Geplante Handlung: {m.intervention}</Text>
  <InfoBanner variant="info" message="Die Angaben gelten nur für diese Originalmaßnahme. Beobachtung, Rückmeldung und Folgeentscheidung einzeln dokumentieren. Die Maßnahmenplanung wird dadurch nicht automatisch geändert."/>
  {input('periodStartAt', 'Beobachtungsbeginn für diese Maßnahme mit Zeitzone')}{input('periodEndAt', 'Beobachtungsende für diese Maßnahme mit Zeitzone')}
  {choice('source')}{row.source === 'reported' ? input('reportedBy') : null}{choice('outcome')}{choice('feedbackState')}{textFields.map(k => input(k, labels[k], true))}{choice('nextAction')}{choice('reviewState')}{row.reviewState === 'scheduled' ? input('reviewAt') : null}
  <View style={{ gap: spacing.md, flexDirection: 'row', flexWrap: 'wrap' }}><PremiumButton title="Vorherige Maßnahme" variant="secondary" disabled={index === 0} onPress={() => setIndex(n => n - 1)}/><PremiumButton title="Nächste Maßnahme" variant="secondary" disabled={index === plan.measures.length - 1} onPress={() => setIndex(n => n + 1)}/></View>
  <Text style={body}>Der Wechsel erhält alle Eingaben. Beim Speichern werden sämtliche ausgewählten Maßnahmen geprüft.</Text>
 </SectionPanel>;
}
export function MeasureReviewDetails({ entry, plan }: {
    entry: EvaluationEntry;
    plan: EvaluationPlan;
}) {
    const [count, setCount] = useState(5);
    if (!entry.measureReviews)
        return <InfoBanner variant="info" message="Historischer Gesamtbefund ohne Einzelbewertungen. Zu den einzelnen Maßnahmen werden keine Ergebnisse nachträglich angenommen."/>;
    const byId = new Map(plan.measures.map(m => [m.id, m]));
    return <View style={{ gap: spacing.md }}>{entry.measureReviews.slice(0, count).map(r => {
            const m = byId.get(r.measureId);
            return <SectionPanel key={r.measureId} title={m?.title ?? r.measureId}>
  <Text style={body}>Originalmaßnahme: {r.measureId}</Text><Text style={body}>Ursprüngliches Ziel: {m?.personalGoal}</Text><Text style={body}>Ursprüngliches Prüfkriterium: {m?.evaluationCriteria}</Text>
  <Text style={body}>Beobachtung: {r.periodStartAt} bis {r.periodEndAt}</Text><Text style={body}>{names[r.source]}{r.reportedBy ? ` · ${r.reportedBy}` : ''}</Text><Text style={body}>{names[r.outcome]}: {r.observedEffect}</Text><Text style={body}>{names[r.feedbackState]}: {r.personFeedback}</Text><Text style={body}>Schlussfolgerung: {r.professionalConclusion}</Text><Text style={body}>{names[r.nextAction]}: {r.nextActionReason}</Text><Text style={body}>{names[r.reviewState]}{r.reviewAt ? ` · ${r.reviewAt}` : ''}: {r.reviewReason}</Text>
 </SectionPanel>;
        })}{count < entry.measureReviews.length ? <PremiumButton title="Weitere Einzelbewertungen anzeigen" variant="secondary" onPress={() => setCount(n => n + 5)}/> : null}</View>;
}
