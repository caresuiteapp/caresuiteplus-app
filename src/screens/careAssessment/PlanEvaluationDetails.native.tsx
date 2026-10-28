// Generated native presentation from src/screens/careAssessment/PlanEvaluationDetails.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import type { EvaluationPlan, EvaluationEntry } from '@/lib/careAssessment/planEvaluationDomain';
const body = { ...typography.body, color: colors.textSecondary };
import { evaluationNames as names } from '@/lib/careAssessment/planEvaluationLabels';
import { MeasureReviewDetails } from "./PlanEvaluationMeasureReviews.native.tsx";
export function PlanDetails({ plan }: {
    plan: EvaluationPlan;
}) { return <View style={{ gap: spacing.md }}><Text style={body}>Historischer Planstand: Fassung {plan.version} · Änderungsstand {plan.draftRevision} · Status {plan.status} · seit {plan.updatedAt}. Ein Entwurfsstand ist keine fachlich freigegebene Planung.</Text>{plan.measures.map(m => <View key={m.id!} style={{ gap: spacing.xs }}><Text style={body}>{m.title} · Originalmaßnahme {m.id} · {m.status}</Text>{['personalGoal', 'evaluationCriteria', 'intervention', 'timing', 'frequency', 'responsibleRole', 'personContribution', 'relativesContribution', 'warningSigns', 'escalationPath', 'relatedRiskKey', 'relatedTopicKey', 'nextEvaluationAt'].map(k => <Text key={k} style={body}>{({ personalGoal: 'Ziel', evaluationCriteria: 'Prüfkriterium', intervention: 'Durchführung', timing: 'Situation/Zeit', frequency: 'Häufigkeit', responsibleRole: 'Zuständigkeit', personContribution: 'Mitwirkung der Person', relativesContribution: 'Weitere Mitwirkung', warningSigns: 'Warn-/Abbruchkriterien', escalationPath: 'Eskalationsweg', relatedRiskKey: 'Risikobezug', relatedTopicKey: 'Themenfeld', nextEvaluationAt: 'Damals geplanter Prüftermin' } as Record<string, string>)[k]}: {m[k as keyof typeof m] || 'Nicht angegeben'}</Text>)}</View>)}</View>; }
export function EntryDetails({ entry, plan }: {
    entry: EvaluationEntry;
    plan: EvaluationPlan;
}) { return <View style={{ gap: spacing.xs }}><Text style={body}>{names[entry.outcome]} · {entry.evaluatedAt} · Beobachtung {entry.periodStartAt} bis {entry.periodEndAt}</Text><Text style={body}>{names[entry.source]}{entry.reportedBy ? ` · ${entry.reportedBy}` : ''}</Text><Text style={body}>Wirkung: {entry.observedEffect}</Text><Text style={body}>{names[entry.feedbackState]}: {entry.personFeedback}</Text><Text style={body}>Schlussfolgerung: {entry.professionalConclusion}</Text><Text style={body}>{names[entry.nextAction]}: {entry.nextActionReason}</Text><Text style={body}>{names[entry.reviewState]}{entry.reviewAt ? ` · ${entry.reviewAt}` : ''}: {entry.reviewReason}</Text><MeasureReviewDetails entry={entry} plan={plan}/></View>; }
