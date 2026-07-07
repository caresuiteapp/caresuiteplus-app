import type { AssignmentStatus } from '@/types/modules/assignmentStatus';

/** Planung — section 18 */
export type VisitPlanningStatus =
  | 'draft'
  | 'scheduled'
  | 'confirmed'
  | 'cancelled'
  | 'at_risk';

export const VISIT_PLANNING_STATUS_LABELS: Record<VisitPlanningStatus, string> = {
  draft: 'Entwurf',
  scheduled: 'Geplant',
  confirmed: 'Bestätigt',
  cancelled: 'Abgesagt',
  at_risk: 'Gefährdet',
};

/** Durchführung */
export type VisitExecutionStatus =
  | 'pending'
  | 'on_way'
  | 'arrived'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export const VISIT_EXECUTION_STATUS_LABELS: Record<VisitExecutionStatus, string> = {
  pending: 'Ausstehend',
  on_way: 'Unterwegs',
  arrived: 'Angekommen',
  in_progress: 'In Durchführung',
  paused: 'Pausiert',
  completed: 'Abgeschlossen',
  no_show: 'Nicht erschienen',
  cancelled: 'Abgesagt',
};

/** Dokumentation */
export type VisitDocumentationStatus = 'none' | 'open' | 'complete' | 'review';

export const VISIT_DOCUMENTATION_STATUS_LABELS: Record<VisitDocumentationStatus, string> = {
  none: 'Keine',
  open: 'Offen',
  complete: 'Vollständig',
  review: 'In Prüfung',
};

/** Nachweis */
export type VisitProofStatus =
  | 'none'
  | 'pending'
  | 'signed'
  | 'verified'
  | 'rejected';

export const VISIT_PROOF_STATUS_LABELS: Record<VisitProofStatus, string> = {
  none: 'Kein Nachweis',
  pending: 'Nachweis offen',
  signed: 'Unterschrieben',
  verified: 'Verifiziert',
  rejected: 'Abgelehnt',
};

/** Abrechnung / Budget */
export type VisitBillingStatus =
  | 'none'
  | 'preview'
  | 'ready'
  | 'invoiced'
  | 'paid'
  | 'blocked';

export const VISIT_BILLING_STATUS_LABELS: Record<VisitBillingStatus, string> = {
  none: 'Keine Abrechnung',
  preview: 'Budget-Vorschau',
  ready: 'Abrechnungsbereit',
  invoiced: 'Abgerechnet',
  paid: 'Bezahlt',
  blocked: 'Blockiert',
};

/** Portal */
export type VisitPortalStatus =
  | 'hidden'
  | 'scheduled'
  | 'released'
  | 'visible'
  | 'archived';

export const VISIT_PORTAL_STATUS_LABELS: Record<VisitPortalStatus, string> = {
  hidden: 'Verborgen',
  scheduled: 'Geplant (Portal)',
  released: 'Freigegeben',
  visible: 'Sichtbar',
  archived: 'Archiviert',
};

export type VisitStatusDimension =
  | 'planning'
  | 'execution'
  | 'documentation'
  | 'proof'
  | 'billing'
  | 'portal';

export type VisitTaskStatus =
  | 'open'
  | 'done'
  | 'partial'
  | 'not_requested'
  | 'not_possible'
  | 'cancelled'
  | 'deferred';

export const VISIT_TASK_STATUS_LABELS: Record<VisitTaskStatus, string> = {
  open: 'Offen',
  done: 'Erledigt',
  partial: 'Teilweise erledigt',
  not_requested: 'Nicht gewünscht',
  not_possible: 'Nicht möglich',
  cancelled: 'Abgebrochen',
  deferred: 'Verschoben',
};

export type VisitTaskItem = {
  id: string;
  title: string;
  status: VisitTaskStatus;
  isRequired: boolean;
  notDoneReason: string | null;
  notCompletedReasonKey?: string | null;
  note?: string | null;
};

export type VisitBudgetSnapshot = {
  budgetAmountCents: number;
  usedAmountCents: number;
  remainingAmountCents: number;
  currency: string;
  warning: string | null;
};

export type VisitDispositionListItem = {
  id: string;
  tenantId: string;
  clientId?: string;
  title: string;
  serviceName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number | null;
  status: import('@/types/core/base').WorkflowStatus;
  /** Canonical assignment status — avoids workflow filter round-trip in portal lists. */
  assignmentStatus: AssignmentStatus;
  planningStatus: VisitPlanningStatus;
  proofStatus: VisitProofStatus;
  billingStatus: VisitBillingStatus;
  location: string;
  clientName: string;
  employeeId: string | null;
  employeeName: string;
  isAtRisk: boolean;
  isIncomplete: boolean;
  updatedAt: string;
};

export type VisitDispositionDetail = VisitDispositionListItem & {
  clientId: string;
  employeeId: string | null;
  serviceKey: string | null;
  assignmentDate?: string;
  description: string | null;
  notes: string | null;
  /** Durchführungsnotiz (employee_notes in 0116). */
  employeeNotes: string | null;
  clientVisibleNotes?: string | null;
  addressSnapshot?: string | null;
  locationNotes?: string | null;
  subjectKey?: string | null;
  assignmentTypeKey?: string | null;
  serviceCategoryKey?: string | null;
  taskPackageId?: string | null;
  billingBudgetSourceKey?: string | null;
  proofTemplateKey?: string | null;
  riskFlagKeys?: string[];
  catalogSnapshotJson?: Record<string, unknown>;
  recurrenceJson?: VisitRecurrenceJson | Record<string, unknown>;
  executionStatus: VisitExecutionStatus;
  documentationStatus: VisitDocumentationStatus;
  portalStatus: VisitPortalStatus;
  assignmentStatus: AssignmentStatus;
  allowedStatusTransitions: AssignmentStatus[];
  tasks: VisitTaskItem[];
  budget: VisitBudgetSnapshot | null;
  portalReleaseEnabled: boolean;
  employeePortalVisible: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  onTheWayAt: string | null;
  arrivedAt: string | null;
  finishedAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  createdAt: string;
  /** Persisted client signature from assist_visit_signatures (office enrichment). */
  persistedSignature?: import('@/lib/assist/visitSignatureSessionStore').VisitSignatureCapture | null;
};

/** Wiederholungsmuster für Einsatzplanung */
export type VisitRecurrencePattern = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

export const VISIT_RECURRENCE_PATTERN_OPTIONS: { key: VisitRecurrencePattern; label: string }[] = [
  { key: 'none', label: 'Einmalig' },
  { key: 'daily', label: 'Täglich' },
  { key: 'weekly', label: 'Wöchentlich' },
  { key: 'biweekly', label: 'Alle 2 Wochen' },
  { key: 'monthly', label: 'Monatlich' },
];

export const VISIT_RECURRENCE_PATTERN_LABELS: Record<VisitRecurrencePattern, string> = {
  none: 'Einmalig',
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  biweekly: 'Alle 2 Wochen',
  monthly: 'Monatlich',
};

export const VISIT_WEEKDAY_OPTIONS = [
  { key: 'mo', label: 'Mo' },
  { key: 'di', label: 'Di' },
  { key: 'mi', label: 'Mi' },
  { key: 'do', label: 'Do' },
  { key: 'fr', label: 'Fr' },
  { key: 'sa', label: 'Sa' },
  { key: 'so', label: 'So' },
] as const;

export type VisitWeekdayKey = (typeof VISIT_WEEKDAY_OPTIONS)[number]['key'];

export type VisitRecurrenceJson = {
  pattern: VisitRecurrencePattern;
  weekdays?: VisitWeekdayKey[];
  endDate?: string | null;
  occurrenceCount?: number | null;
  /** Occurrence dates removed from virtual expansion (materialized or skipped). */
  detachedOccurrenceDates?: string[];
  /** Maps YYYY-MM-DD occurrence key → standalone assist_visits.id after materialization. */
  materializedOccurrences?: Record<string, string>;
  /** Set on visits materialized from a recurring series for execution. */
  parentSeriesId?: string | null;
  sourceOccurrenceDate?: string | null;
};

export type VisitCreateInput = {
  clientId: string;
  employeeId: string | null;
  serviceKey: string;
  serviceName: string;
  title: string;
  description?: string | null;
  assignmentDate: string;
  plannedStartAt: string;
  plannedEndAt: string;
  addressSnapshot?: string | null;
  tasks: string[];
  budgetAmountCents?: number | null;
  internalNotes?: string | null;
  notifyEmployee?: boolean;
  notifyClient?: boolean;
  portalReleaseEnabled?: boolean;
  saveAsDraft?: boolean;
  subjectKey?: string | null;
  assignmentTypeKey?: string | null;
  serviceCategoryKey?: string | null;
  taskPackageId?: string | null;
  billingBudgetSourceKey?: string | null;
  proofTemplateKey?: string | null;
  riskFlagKeys?: string[];
  recurrenceJson?: VisitRecurrenceJson | Record<string, unknown>;
  catalogSnapshotJson?: Record<string, unknown>;
  budgetAllocation?: import('@/types/assist/assignmentBudgetAllocation').AssistBudgetAllocationResult | null;
  budgetManualOverride?: import('@/types/assist/assignmentBudgetAllocation').ManualBudgetAllocationOverride | null;
};

export type VisitCreateWizardData = {
  title: string;
  description: string;
  clientId: string;
  serviceKey: string;
  serviceName: string;
  tasks: string[];
  assignmentDate: string;
  plannedStartTime: string;
  plannedEndTime: string;
  employeeId: string;
  addressSnapshot: string;
  locationNotes: string;
  budgetAmountCents: number | null;
  internalNotes: string;
  documentationTemplate: string;
  notifyEmployee: boolean;
  notifyClient: boolean;
  portalReleaseEnabled: boolean;
  /** Office-Katalog-Felder (C.ASSIST-OFFICE-TEMPLATE.1) */
  subjectKey: string;
  assignmentTypeKey: string;
  serviceCategoryKey: string;
  taskPackageId: string;
  taskDrafts: import('@/types/assistCatalog').AssistAssignmentTaskDraft[];
  billingBudgetSourceKey: string;
  riskFlagKeys: string[];
  employeeNotes: string;
  clientVisibleNotes: string;
  proofTemplateKey: string;
  saveAsDraft: boolean;
  catalogSnapshotJson: Record<string, unknown>;
  recurrencePattern: VisitRecurrencePattern;
  recurrenceEndDate: string;
  recurrenceWeekdays: VisitWeekdayKey[];
  recurrenceOccurrenceCount: number | null;
  /** Auto-calculated budget allocation from client profile */
  budgetAllocation?: import('@/types/assist/assignmentBudgetAllocation').AssistBudgetAllocationResult | null;
  budgetManualOverride?: import('@/types/assist/assignmentBudgetAllocation').ManualBudgetAllocationOverride | null;
};

export function buildVisitRecurrenceJson(
  wizard: Pick<
    VisitCreateWizardData,
    | 'recurrencePattern'
    | 'recurrenceWeekdays'
    | 'recurrenceEndDate'
    | 'recurrenceOccurrenceCount'
  >,
): VisitRecurrenceJson {
  if (wizard.recurrencePattern === 'none') {
    return { pattern: 'none' };
  }
  return {
    pattern: wizard.recurrencePattern,
    weekdays:
      wizard.recurrencePattern === 'weekly' || wizard.recurrencePattern === 'biweekly'
        ? wizard.recurrenceWeekdays
        : undefined,
    endDate: wizard.recurrenceEndDate.trim() || null,
    occurrenceCount: wizard.recurrenceOccurrenceCount,
  };
}

export const ASSIGNMENT_CREATE_SECTIONS = [
  { key: 'basis', label: 'Basisdaten' },
  { key: 'people', label: 'Klient & Mitarbeitende' },
  { key: 'schedule', label: 'Termin & Wiederholung' },
  { key: 'type', label: 'Einsatzart & Betreff' },
  { key: 'tasks', label: 'Aufgabenpaket & Aufgaben' },
  { key: 'hints', label: 'Hinweise & Risiken' },
  { key: 'billing', label: 'Abrechnung & Budget' },
  { key: 'documentation', label: 'Dokumentation & Nachweis' },
  { key: 'review', label: 'Prüfung & Speichern' },
] as const;

export type AssignmentCreateSectionKey = (typeof ASSIGNMENT_CREATE_SECTIONS)[number]['key'];

export const VISIT_CREATE_WIZARD_STEPS = [
  { key: 'grunddaten', label: 'Grunddaten' },
  { key: 'klient', label: 'Klient' },
  { key: 'leistung', label: 'Leistung & Aufgaben' },
  { key: 'zeit', label: 'Zeit' },
  { key: 'mitarbeiter', label: 'Mitarbeiter' },
  { key: 'ort', label: 'Ort' },
  { key: 'budget', label: 'Budget' },
  { key: 'dokumentation', label: 'Dokumentation' },
  { key: 'benachrichtigungen', label: 'Benachrichtigungen' },
  { key: 'vorschau', label: 'Vorschau' },
] as const;

export type VisitCreateWizardStepKey = (typeof VISIT_CREATE_WIZARD_STEPS)[number]['key'];

export const EMPTY_VISIT_WIZARD_DATA: VisitCreateWizardData = {
  title: '',
  description: '',
  clientId: '',
  serviceKey: '',
  serviceName: '',
  tasks: [''],
  assignmentDate: new Date().toISOString().slice(0, 10),
  plannedStartTime: '09:00',
  plannedEndTime: '10:00',
  employeeId: '',
  addressSnapshot: '',
  locationNotes: '',
  budgetAmountCents: null,
  internalNotes: '',
  documentationTemplate: 'standard',
  notifyEmployee: true,
  notifyClient: false,
  portalReleaseEnabled: false,
  subjectKey: '',
  assignmentTypeKey: '',
  serviceCategoryKey: '',
  taskPackageId: '',
  taskDrafts: [],
  billingBudgetSourceKey: '',
  riskFlagKeys: [],
  employeeNotes: '',
  clientVisibleNotes: '',
  proofTemplateKey: '',
  saveAsDraft: false,
  catalogSnapshotJson: {},
  recurrencePattern: 'none',
  recurrenceEndDate: '',
  recurrenceWeekdays: [],
  recurrenceOccurrenceCount: null,
};
