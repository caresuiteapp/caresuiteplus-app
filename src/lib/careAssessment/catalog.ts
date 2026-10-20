import {
  CARE_ASSESSMENT_TOPIC_KEYS,
  type CareAssessment,
  type CareAssessmentCompleteness,
  type CareAssessmentTopic,
  type CareAssessmentTopicKey,
  type CareAssessmentVariant,
} from '@/types/modules/careAssessment';

export const CARE_ASSESSMENT_TOPIC_LABELS: Record<CareAssessmentTopicKey, string> = {
  cognition_communication: 'Kognitive und kommunikative Fähigkeiten',
  mobility: 'Mobilität und Beweglichkeit',
  disease_demands: 'Krankheitsbezogene Anforderungen und Belastungen',
  self_care: 'Selbstversorgung',
  social_relationships: 'Leben in sozialen Beziehungen',
  living_environment: 'Wohnen / Häuslichkeit',
};

export const CARE_ASSESSMENT_VARIANT_LABELS: Record<CareAssessmentVariant, string> = {
  ambulant: 'Ambulante Pflege',
  stationaer: 'Stationäre Langzeitpflege',
  tagespflege: 'Tagespflege',
  kurzzeitpflege: 'Kurzzeitpflege',
};

export const CARE_RISK_CATALOG = [
  { key: 'fall', label: 'Sturz', focusedAssessment: 'fall_risk' },
  { key: 'pressure_injury', label: 'Dekubitus / Druckverletzung', focusedAssessment: 'pressure_injury' },
  { key: 'nutrition', label: 'Mangelernährung', focusedAssessment: 'nutrition' },
  { key: 'dehydration', label: 'Dehydration', focusedAssessment: 'hydration' },
  { key: 'pain', label: 'Schmerz', focusedAssessment: 'pain' },
  { key: 'continence', label: 'Kontinenz', focusedAssessment: 'continence' },
  { key: 'skin_integrity', label: 'Hautintegrität', focusedAssessment: 'skin_integrity' },
  { key: 'chronic_wound', label: 'Chronische Wunde', focusedAssessment: 'chronic_wound' },
  { key: 'oral_health', label: 'Mundgesundheit', focusedAssessment: 'oral_health' },
  { key: 'medication', label: 'Medikationssicherheit', focusedAssessment: 'medication' },
  { key: 'aspiration', label: 'Schlucken / Aspiration', focusedAssessment: 'swallowing' },
  { key: 'respiratory', label: 'Atmung', focusedAssessment: 'respiratory' },
  { key: 'cognition_delirium', label: 'Kognition / Delir', focusedAssessment: 'cognition_delirium' },
  { key: 'psychological_crisis', label: 'Psychische Krise / Selbstgefährdung', focusedAssessment: 'crisis' },
  { key: 'infection', label: 'Infektion', focusedAssessment: 'infection' },
  { key: 'violence_neglect', label: 'Gewalt / Vernachlässigung / Unterversorgung', focusedAssessment: 'safeguarding' },
  { key: 'care_instability', label: 'Destabilisierung der Versorgung', focusedAssessment: 'care_stability' },
] as const;

export const QPR_2026_CHECKS = [
  'Aufnahme- und Versorgungssituation nachvollziehbar',
  'Perspektive der versorgten Person erfasst',
  'Ressourcen, Fähigkeiten und Einschränkungen erfasst',
  'Offenkundige Risiken erkannt und fachlich begründet',
  'Risiken in der Maßnahmenplanung berücksichtigt',
  'Aufklärung und Beratung dokumentiert',
  'Anzeichen einer Destabilisierung bearbeitet',
  'Maßnahmen individuell, konkret und schriftlich geplant',
  'An- und Zugehörige sowie weitere Beteiligte berücksichtigt',
  'Verlauf, Ereignisse und Evaluation widerspruchsfrei',
] as const;

export function createEmptyTopics(): CareAssessmentTopic[] {
  return CARE_ASSESSMENT_TOPIC_KEYS.map((topicKey) => ({
    topicKey,
    personPerspective: '',
    resources: '',
    impairments: '',
    wishes: '',
    habitsBiography: '',
    professionalAssessment: '',
    actionNeeded: '',
    informationSources: [],
  }));
}

export function calculateCareAssessmentCompleteness(
  assessment: Pick<
    CareAssessment,
    'personStatement' | 'statementSource' | 'professionalSummary' | 'topics' | 'risks' | 'measures' | 'nextReviewAt'
  >,
): CareAssessmentCompleteness {
  const blocking: string[] = [];
  const warnings: string[] = [];
  let achieved = 0;
  const possible = 5 + CARE_ASSESSMENT_TOPIC_KEYS.length * 2;
  if (assessment.personStatement.trim() || assessment.statementSource === 'not_possible') achieved += 1;
  else blocking.push('Originalton oder begründete Angabe „Aussage nicht möglich“ fehlt.');
  if (assessment.professionalSummary.trim()) achieved += 1;
  else blocking.push('Die pflegefachliche Gesamteinschätzung fehlt.');
  for (const key of CARE_ASSESSMENT_TOPIC_KEYS) {
    const topic = assessment.topics.find((entry) => entry.topicKey === key);
    if (topic?.personPerspective.trim() || topic?.wishes.trim()) achieved += 1;
    else warnings.push(`${CARE_ASSESSMENT_TOPIC_LABELS[key]}: Perspektive/Wünsche fehlen.`);
    if (topic?.resources.trim() || topic?.impairments.trim() || topic?.professionalAssessment.trim()) achieved += 1;
    else blocking.push(`${CARE_ASSESSMENT_TOPIC_LABELS[key]}: fachliche Einschätzung fehlt.`);
  }
  const active = assessment.risks.filter((risk) => risk.state === 'present' || risk.state === 'unclear');
  if (!active.some((risk) => !risk.professionalRationale.trim() || !risk.counselingProvided.trim())) achieved += 1;
  else blocking.push('Mindestens ein Risiko ist nicht begründet oder nicht beraten.');
  if (!active.some((risk) => !assessment.measures.some((measure) => measure.relatedRiskKey === risk.riskKey))) achieved += 1;
  else blocking.push('Mindestens ein vorhandenes Risiko besitzt keine verknüpfte Maßnahme.');
  if (assessment.nextReviewAt) achieved += 1;
  else warnings.push('Es ist kein nächster fachlicher Prüftermin festgelegt.');
  const percent = Math.round((achieved / possible) * 100);
  return {
    percent,
    blocking,
    warnings,
    canSubmitForReview: blocking.length === 0 && percent >= 85,
    canApprove: blocking.length === 0 && percent === 100,
  };
}

export function getRiskLabel(key: string): string {
  return CARE_RISK_CATALOG.find((risk) => risk.key === key)?.label ?? key;
}
