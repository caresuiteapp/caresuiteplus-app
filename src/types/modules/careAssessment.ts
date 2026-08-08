export const CARE_ASSESSMENT_TOPIC_KEYS = [
  'cognition_communication',
  'mobility',
  'disease_demands',
  'self_care',
  'social_relationships',
  'living_environment',
] as const;

export type CareAssessmentTopicKey = (typeof CARE_ASSESSMENT_TOPIC_KEYS)[number];
export type CareAssessmentSubjectType = 'client' | 'resident';

export type CareAssessmentSubjectOption = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  careLevel: string | null;
};
export type CareAssessmentVariant = 'ambulant' | 'stationaer' | 'tagespflege' | 'kurzzeitpflege';
export type CareAssessmentReason =
  | 'initial'
  | 'scheduled_review'
  | 'event_triggered'
  | 'hospital_return'
  | 'care_level_change'
  | 'other';
export type CareAssessmentStatus =
  | 'draft'
  | 'in_progress'
  | 'professional_review'
  | 'approved'
  | 'superseded'
  | 'archived';
export type CareAssessmentStatementSource =
  | 'person'
  | 'relative'
  | 'representative'
  | 'professional'
  | 'not_possible';
export type CareRiskState = 'none' | 'unclear' | 'present' | 'controlled';
export type CareRiskUrgency = 'routine' | 'timely' | 'urgent' | 'immediate';
export type CareMeasureStatus = 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';
export type CareEvaluationOutcome =
  | 'effective'
  | 'partly_effective'
  | 'not_effective'
  | 'deteriorated'
  | 'not_assessable';

export type CareAssessmentEvaluation = {
  id?: string;
  outcome: CareEvaluationOutcome;
  observedEffect: string;
  personFeedback: string;
  professionalConclusion: string;
  changesRequired: string;
  evaluatedAt: string;
  evaluatorName: string;
};

export type CareAssessmentVersion = {
  id: string;
  version: number;
  transitionFrom: string | null;
  transitionTo: string;
  actorName: string;
  createdAt: string;
};

export type CareAssessmentTopic = {
  id?: string;
  topicKey: CareAssessmentTopicKey;
  personPerspective: string;
  resources: string;
  impairments: string;
  wishes: string;
  habitsBiography: string;
  professionalAssessment: string;
  actionNeeded: string;
  informationSources: string[];
};

export type CareAssessmentRisk = {
  id?: string;
  riskKey: string;
  state: CareRiskState;
  urgency: CareRiskUrgency;
  evidence: string;
  protectiveFactors: string;
  professionalRationale: string;
  counselingProvided: string;
  personDecision: string;
  refusalDocumented: boolean;
  focusedAssessmentKey: string | null;
  focusedAssessmentResult: Record<string, unknown>;
  linkedBodyMapMarkerIds: string[];
  nextReviewAt: string | null;
};

export type CareAssessmentMeasure = {
  id?: string;
  title: string;
  relatedTopicKey: CareAssessmentTopicKey | null;
  relatedRiskKey: string | null;
  personalGoal: string;
  intervention: string;
  timing: string;
  frequency: string;
  responsibleRole: string;
  personContribution: string;
  relativesContribution: string;
  warningSigns: string;
  escalationPath: string;
  evaluationCriteria: string;
  nextEvaluationAt: string | null;
  status: CareMeasureStatus;
};

export type CareAssessment = {
  id: string;
  tenantId: string;
  subjectType: CareAssessmentSubjectType;
  subjectId: string;
  subjectName: string;
  variant: CareAssessmentVariant;
  reason: CareAssessmentReason;
  reasonDetail: string;
  status: CareAssessmentStatus;
  version: number;
  schemaVersion: string;
  startedAt: string;
  effectiveAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  nextReviewAt: string | null;
  personStatement: string;
  statementSource: CareAssessmentStatementSource;
  statementSourceName: string;
  conversationParticipants: string[];
  communicationSupport: string;
  informationSourceSummary: string;
  professionalSummary: string;
  changeSummary: string;
  destabilizationSummary: string;
  reassessmentRequired: boolean;
  qprRating: 'A' | 'B' | 'C' | 'D' | 'not_assessed';
  qprRationale: string;
  assessorName: string;
  approverName: string;
  topics: CareAssessmentTopic[];
  risks: CareAssessmentRisk[];
  measures: CareAssessmentMeasure[];
  evaluations: CareAssessmentEvaluation[];
  events: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  versionHistory: CareAssessmentVersion[];
  createdAt: string;
  updatedAt: string;
};

export type CareAssessmentListItem = Pick<
  CareAssessment,
  | 'id'
  | 'tenantId'
  | 'subjectType'
  | 'subjectId'
  | 'subjectName'
  | 'variant'
  | 'reason'
  | 'status'
  | 'version'
  | 'nextReviewAt'
  | 'assessorName'
  | 'updatedAt'
  | 'reassessmentRequired'
> & {
  activeRiskCount: number;
  urgentRiskCount: number;
  openMeasureCount: number;
  completenessPercent: number;
};

export type CareAssessmentSaveInput = CareAssessment;
export type CareAssessmentCompleteness = {
  percent: number;
  blocking: string[];
  warnings: string[];
  canSubmitForReview: boolean;
  canApprove: boolean;
};
