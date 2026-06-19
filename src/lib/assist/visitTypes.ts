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

export type VisitTaskStatus = 'open' | 'done' | 'not_done' | 'not_requested' | 'cancelled';

export const VISIT_TASK_STATUS_LABELS: Record<VisitTaskStatus, string> = {
  open: 'Offen',
  done: 'Erledigt',
  not_done: 'Nicht erledigt',
  not_requested: 'Nicht angefordert',
  cancelled: 'Storniert',
};

export type VisitTaskItem = {
  id: string;
  title: string;
  status: VisitTaskStatus;
  isRequired: boolean;
  notDoneReason: string | null;
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
  title: string;
  serviceName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number | null;
  status: import('@/types/core/base').WorkflowStatus;
  planningStatus: VisitPlanningStatus;
  proofStatus: VisitProofStatus;
  billingStatus: VisitBillingStatus;
  location: string;
  clientName: string;
  employeeName: string;
  isAtRisk: boolean;
  isIncomplete: boolean;
  updatedAt: string;
};

export type VisitDispositionDetail = VisitDispositionListItem & {
  clientId: string;
  employeeId: string | null;
  serviceKey: string | null;
  description: string | null;
  notes: string | null;
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
};

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
};
