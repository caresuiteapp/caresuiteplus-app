import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity, SensitivityLevel } from '../portal/visibility';

export type CarePlanTask = {
  id: string;
  label: string;
  frequency: string;
  status: WorkflowStatus;
  category?: string;
  goal?: string;
  intervention?: string;
  timing?: string;
  responsibleRole?: string;
  warningSigns?: string;
  escalationPath?: string;
  evaluationCriteria?: string;
  nextEvaluationAt?: string | null;
};

export type CarePlan = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    clientName?: string;
    title: string;
    validFrom: string;
    validUntil: string | null;
    status: WorkflowStatus;
    sensitivity: SensitivityLevel;
    summary: string;
    goals?: string;
    resources?: string;
    risks?: string;
    tasks: CarePlanTask[];
    primaryNurseId: string | null;
    assessmentId?: string | null;
    version?: number;
    reviewDueAt?: string | null;
    approvedAt?: string | null;
    approvedByName?: string;
  };

export type CarePlanListItem = Pick<
  CarePlan,
  'id' | 'tenantId' | 'title' | 'validFrom' | 'validUntil' | 'status' | 'clientId' | 'updatedAt'
> & {
  clientName: string;
  careLevel: string | null;
  alertCount: number;
};

export type CarePlanDetail = CarePlan & {
  clientName: string;
  careLevel: string | null;
  city: string;
  employeeName: string;
  nextActionHint: string;
  dueVitalsCount: number;
  diagnosisCount: number;
  activeOrderCount: number;
};

export type CareDiagnosisStatus = 'active' | 'resolved' | 'superseded' | 'archived';

export type CareDiagnosis = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  carePlanId: string | null;
  diagnosisType: 'physician_statement' | 'confirmed' | 'suspected' | 'nursing_relevant';
  icdCode: string;
  icdTitle: string;
  physicianStatement: string;
  diagnosedAt: string | null;
  diagnosedBy: string;
  sourceDocument: string;
  relevanceForCare: string;
  precautions: string;
  status: CareDiagnosisStatus;
  validFrom: string;
  validUntil: string | null;
  recordedByName: string;
  createdAt: string;
  updatedAt: string;
};

export type CareMedicalOrderStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'archived';

export type CareMedicalOrder = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  carePlanId: string | null;
  orderType: string;
  title: string;
  description: string;
  orderingPhysician: string;
  orderedAt: string;
  validFrom: string;
  validUntil: string | null;
  insurerApprovalRequired: boolean;
  insurerApprovalStatus: 'not_required' | 'pending' | 'approved' | 'rejected' | 'expired';
  frequency: string;
  executionInstructions: string;
  qualificationRequirement: string;
  status: CareMedicalOrderStatus;
  recordedByName: string;
  createdAt: string;
  updatedAt: string;
};

export type VitalReadingType =
  | 'blood_pressure' | 'pulse' | 'respiratory_rate' | 'oxygen' | 'temperature'
  | 'weight' | 'height' | 'bmi' | 'body_surface_area' | 'head_circumference'
  | 'blood_glucose' | 'blood_ketones' | 'pain_score' | 'capillary_refill'
  | 'urine_output' | 'fluid_balance' | 'gcs' | 'rass' | 'pupils'
  | 'arterial_pressure' | 'map' | 'cvp' | 'cardiac_output' | 'cardiac_index'
  | 'svv' | 'icp' | 'cpp' | 'etco2' | 'oxygen_flow' | 'fio2' | 'peep'
  | 'tidal_volume' | 'minute_ventilation' | 'peak_airway_pressure'
  | 'plateau_pressure' | 'ventilator_rate' | 'ph' | 'pco2' | 'po2'
  | 'bicarbonate' | 'base_excess' | 'lactate';

export type VitalReading = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    carePlanId: string | null;
    type: VitalReadingType;
    value: string;
    unit: string;
    measuredAt: string;
    recordedById?: string | null;
    recordedByName?: string | null;
    source?: 'manual' | 'device' | 'import';
    context?: Record<string, string>;
    note?: string | null;
    flagStatus?: 'unrated' | 'within_configured_range' | 'outside_configured_range';
    status: WorkflowStatus;
    sensitivity: SensitivityLevel;
  };

export type VitalReadingListItem = VitalReading & {
  clientName: string;
  typeLabel: string;
  isDue: boolean;
  isAlert: boolean;
};

export type PflegeDashboardStats = {
  totalPlans: number;
  activePlansCount: number;
  dueVitalsCount: number;
  alertsCount: number;
  visitsToday: number;
  runningNow: number;
  dueMeasuresCount: number;
  openDocumentationCount: number;
  abnormalVitalsCount: number;
  openMedicationCount: number;
  openWoundDocsCount: number;
  openHandoversCount: number;
  openSisAssessmentCount: number;
  openReportsCount: number;
  assignedClientsCount: number;
};

export function emptyPflegeDashboardStats(): PflegeDashboardStats {
  return {
    totalPlans: 0,
    activePlansCount: 0,
    dueVitalsCount: 0,
    alertsCount: 0,
    visitsToday: 0,
    runningNow: 0,
    dueMeasuresCount: 0,
    openDocumentationCount: 0,
    abnormalVitalsCount: 0,
    openMedicationCount: 0,
    openWoundDocsCount: 0,
    openHandoversCount: 0,
    openSisAssessmentCount: 0,
    openReportsCount: 0,
    assignedClientsCount: 0,
  };
}

export type SisAssessment = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    clientName: string;
    assessedAt: string;
    overallScore: number;
    status: WorkflowStatus;
    nextReviewAt: string | null;
    assessorName: string;
  };

export type PflegeModuleSettings = {
  sisEnabled: boolean;
  vitalAlertsEnabled: boolean;
  woundDocumentationEnabled: boolean;
  bodyMapEnabled: boolean;
  mdkExportPrepared: boolean;
  autoHandoverHints: boolean;
};

export type PflegeReportStats = {
  activePlans: number;
  sisAssessmentsDue: number;
  vitalsDocumentedThisWeek: number;
  woundCasesOpen: number;
  mdkReadyCount: number;
};

export type CarePlanEvaluationListItem = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  carePlanId: string;
  planTitle: string;
  outcome: 'effective' | 'partly_effective' | 'not_effective' | 'deteriorated' | 'not_assessable';
  observedEffect: string;
  professionalConclusion: string;
  requiresPlanUpdate: boolean;
  evaluatedAt: string;
  nextEvaluationAt: string | null;
  evaluatorName: string;
};

export type CareQualityVisitListItem = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  carePlanId: string | null;
  planTitle: string;
  visitType: 'pdl' | 'professional' | 'intensive_care' | 'hygiene' | 'medication' | 'event_triggered';
  status: 'planned' | 'completed' | 'cancelled';
  scope: string;
  findings: string;
  deviations: string;
  scheduledAt: string | null;
  conductedAt: string | null;
  nextVisitAt: string | null;
  visitorName: string;
};

export type CareRiskLiveItem = {
  id: string;
  assessmentId: string;
  clientId: string;
  clientName: string;
  riskKey: string;
  state: 'none' | 'unclear' | 'present' | 'controlled';
  urgency: 'routine' | 'timely' | 'urgent' | 'immediate';
  evidence: string;
  professionalRationale: string;
  nextReviewAt: string | null;
  assessorName: string;
};

export type CareMeasureLiveItem = {
  id: string;
  carePlanId: string;
  clientId: string;
  clientName: string;
  planTitle: string;
  title: string;
  intervention: string;
  frequency: string;
  responsibleRole: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  nextEvaluationAt: string | null;
  overdue: boolean;
};

export type CareQualityDeviationItem = {
  id: string;
  clientId: string | null;
  clientName: string;
  carePlanId: string | null;
  sourceType: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  immediateAction: string;
  rootCause: string;
  correctiveAction: string;
  status: 'identified' | 'assessed' | 'in_progress' | 'effectiveness_check' | 'closed' | 'cancelled';
  recurringProblem: boolean;
  responsibleName: string;
  effectivenessResult: string;
  dueAt: string | null;
  createdAt: string;
};

export type PflegeMdReadinessItem = {
  clientId: string;
  clientName: string;
  carePlanId: string;
  planTitle: string;
  readinessPercent: number;
  ready: boolean;
  checks: {
    approvedSis: boolean;
    activeMeasures: boolean;
    risksCurrent: boolean;
    recentEvaluation: boolean;
    recentVisit: boolean;
    signedDocumentation: boolean;
    deviationsClear: boolean;
  };
};

export type WoundDocumentation = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    clientName?: string;
    bodyLocation: string;
    description: string;
    documentedAt: string;
    status: WorkflowStatus;
    sensitivity: SensitivityLevel;
  };

export type MedicationStatus = 'active' | 'paused' | 'stopped' | 'archived';
export type MedicationAdministrationStatus =
  | 'scheduled'
  | 'administered'
  | 'omitted'
  | 'refused'
  | 'held'
  | 'late';

/** Produktive, mandantengetrennte Verordnung für ambulante Pflege und Intensivpflege. */
export type MedicationListItem = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  medicationName: string;
  dosage: string;
  schedule: string;
  route: string;
  activeIngredient: string | null;
  strength: string | null;
  form: string | null;
  status: MedicationStatus;
  isPrn: boolean;
  isHighAlert: boolean;
  isControlledSubstance: boolean;
  intensiveCareRelevant: boolean;
  prescribedBy: string;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
};

export type MedicationAdministration = {
  id: string;
  tenantId: string;
  medicationId: string;
  clientId: string;
  scheduledAt: string | null;
  administeredAt: string | null;
  status: MedicationAdministrationStatus;
  administeredDose: string | null;
  route: string | null;
  deviationReason: string | null;
  prnReason: string | null;
  effectEvaluation: string | null;
  painScoreBefore: number | null;
  painScoreAfter: number | null;
  vitalContext: Record<string, unknown>;
  notes: string | null;
  administeredByName: string | null;
  witnessName: string | null;
  createdAt: string;
};

export type MedicationDetail = MedicationListItem & {
  clientAllergies: string | null;
  indication: string | null;
  morningDose: string | null;
  noonDose: string | null;
  eveningDose: string | null;
  nightDose: string | null;
  prnReason: string | null;
  instructions: string;
  interactionNotes: string | null;
  sideEffectNotes: string | null;
  storageNotes: string | null;
  infusionRate: string | null;
  dilution: string | null;
  pumpRequired: boolean;
  lastAdministeredAt: string | null;
  administrations: MedicationAdministration[];
};

export type MedicationClientOption = {
  id: string;
  label: string;
  allergies: string | null;
  specialNotes: string | null;
};

export type MedicationWitnessOption = { id: string; label: string };

export type PflegeServiceProofItem = {
  id: string; clientId: string; clientName: string; serviceDate: string;
  startedAt: string; endedAt: string; durationMinutes: number; serviceCode: string;
  serviceLabel: string; legalBasis: 'sgb_v' | 'sgb_xi' | 'private' | 'mixed';
  prescriptionReference: string; costCarrierName: string; grossAmountCents: number;
  performanceNote: string; employeeName: string; clientSignatureName: string;
  status: 'draft' | 'submitted' | 'signed' | 'approved' | 'rejected' | 'cancelled';
  rejectionReason: string; createdAt: string;
};

export type PflegeBillingCaseItem = {
  id: string; clientId: string; clientName: string; serviceProofId: string;
  legalBasis: string; payerType: 'krankenkasse' | 'pflegekasse' | 'self_payer' | 'mixed';
  costCarrierName: string; serviceCode: string; serviceDate: string; amountCents: number;
  status: 'pending' | 'blocked' | 'ready' | 'released' | 'invoiced' | 'cancelled';
  blockerReason: string; releasedByName: string; releasedAt: string | null;
};

export type PflegeInvoiceFoundationItem = {
  id: string; clientId: string; clientName: string; foundationNumber: string;
  periodFrom: string; periodTo: string; payerType: string; recipientName: string;
  recipientIk: string; proofCount: number; totalAmountCents: number;
  status: 'validated' | 'released' | 'transferred' | 'cancelled'; createdAt: string;
};

export type PflegePeriodAcceptanceItem = {
  id: string; periodFrom: string; periodTo: string; proofCount: number;
  approvedProofCount: number; releasedCaseCount: number; blockedCaseCount: number;
  invoiceFoundationCount: number; totalAmountCents: number; status: 'accepted' | 'rejected';
  acceptedByName: string; acceptedAt: string;
};
