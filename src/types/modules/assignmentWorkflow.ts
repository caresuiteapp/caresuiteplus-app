import type { AssignmentStatus, AssignmentTaskStatus } from './assignmentStatus';

/** Kanonische Remote-Status (Prompt 57) — Mapping auf deutsche Domain-Status */
export type CanonicalAssignmentStatus =
  | 'planned'
  | 'assigned'
  | 'confirmed'
  | 'on_the_way'
  | 'arrived'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'finished'
  | 'documentation_pending'
  | 'signature_pending'
  | 'completed'
  | 'cancel_requested'
  | 'reschedule_requested'
  | 'cancelled'
  | 'no_show'
  | 'missed'
  | 'corrected'
  | 'locked';

export const CANONICAL_ASSIGNMENT_STATUS_LABELS: Record<CanonicalAssignmentStatus, string> = {
  planned: 'Geplant (offen)',
  assigned: 'Zugewiesen',
  confirmed: 'Bestätigt',
  on_the_way: 'Unterwegs',
  arrived: 'Angekommen',
  started: 'Gestartet',
  paused: 'Pausiert',
  resumed: 'Fortgesetzt',
  finished: 'Beendet',
  documentation_pending: 'Dokumentation ausstehend',
  signature_pending: 'Unterschrift ausstehend',
  completed: 'Abgeschlossen',
  cancel_requested: 'Absage angefragt',
  reschedule_requested: 'Verschiebung angefragt',
  cancelled: 'Storniert',
  no_show: 'Nicht erschienen',
  missed: 'Verpasst',
  corrected: 'Korrigiert',
  locked: 'Gesperrt',
};

export const CANONICAL_TO_LOCAL_STATUS: Record<CanonicalAssignmentStatus, AssignmentStatus> = {
  planned: 'geplant',
  assigned: 'geplant',
  confirmed: 'bestaetigt',
  on_the_way: 'unterwegs',
  arrived: 'angekommen',
  started: 'gestartet',
  paused: 'pausiert',
  resumed: 'gestartet',
  finished: 'beendet',
  documentation_pending: 'dokumentation_offen',
  signature_pending: 'unterschrift_offen',
  completed: 'abgeschlossen',
  cancel_requested: 'geplant',
  reschedule_requested: 'geplant',
  cancelled: 'storniert',
  no_show: 'nicht_erschienen',
  missed: 'nicht_erschienen',
  corrected: 'geplant',
  locked: 'abgeschlossen',
};

export type ExtendedAssignmentTaskStatus =
  | AssignmentTaskStatus
  | 'not_wanted'
  | 'not_possible'
  | 'skipped'
  | 'requires_follow_up';

export type AssignmentWorkflowTask = {
  id: string;
  tenantId: string;
  assignmentId: string;
  taskTitle: string;
  taskDescription: string;
  taskCategory: string;
  required: boolean;
  sortOrder: number;
  status: ExtendedAssignmentTaskStatus;
  completionNote: string | null;
  completedBy: string | null;
  completedAt: string | null;
};

export type AssignmentWorkflowRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  employeeId: string | null;
  serviceType: string;
  assignmentType: string;
  plannedStartAt: string;
  plannedEndAt: string;
  plannedDurationMinutes: number;
  actualStartAt: string | null;
  actualEndAt: string | null;
  status: AssignmentStatus;
  canonicalStatus: CanonicalAssignmentStatus;
  locationAddress: string;
  notesForEmployee: string;
  internalNotes: string;
  clientVisibleNotes: string;
  billingRelevant: boolean;
  requiresSignature: boolean;
  requiresDocumentation: boolean;
  requiresRoute: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  lockedAt: string | null;
  title: string;
  tasks: AssignmentWorkflowTask[];
  createdAt: string;
  updatedAt: string;
};

/** Dienstplan-Eintrag — abgeleitet aus Einsatz, nicht freistehend */
export type ScheduleEntry = {
  id: string;
  tenantId: string;
  assignmentId: string;
  employeeId: string | null;
  clientId: string;
  startsAt: string;
  endsAt: string;
  entryType: 'assignment';
  title: string;
  source: 'assignment_sync';
  updatedAt: string;
};

export type CalendarViewMode =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'employee'
  | 'client'
  | 'tour'
  | 'open_assignments'
  | 'conflicts';

export type ClientVisitRequestType = 'cancel' | 'reschedule';

/** Prompt 59 — Anfragestatus (Absage/Verschiebung) */
export type ClientVisitRequestStatus =
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'converted'
  | 'withdrawn'
  | 'pending';

export type ClientVisitRequest = {
  id: string;
  tenantId: string;
  assignmentId: string;
  clientId: string;
  requestType: ClientVisitRequestType;
  status: ClientVisitRequestStatus;
  requestedByProfileId: string;
  reason: string;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  requestedAt: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type AssignmentWorkflowAuditEvent = {
  id: string;
  tenantId: string;
  assignmentId: string;
  action: string;
  actorId: string | null;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export type AssignmentConflictCode =
  | 'employee_double_booked'
  | 'outside_availability'
  | 'overlaps_absence'
  | 'employee_absent'
  | 'employee_sick'
  | 'employee_on_vacation'
  | 'employee_training'
  | 'unavailable_time'
  | 'assignment_needs_replacement'
  | 'client_double_booked'
  | 'travel_time_implausible'
  | 'qualification_missing'
  | 'employee_inactive'
  | 'background_check_missing'
  | 'employee_blocked'
  | 'employee_not_assignable'
  | 'module_permission_missing'
  | 'max_hours_exceeded'
  | 'missing_tasks'
  | 'missing_address';

export type AssignmentConflict = {
  code: AssignmentConflictCode;
  message: string;
  severity: 'warning' | 'error';
};

export type AssignmentWorkflowCreateInput = {
  tenantId: string;
  clientId: string;
  employeeId?: string | null;
  serviceType: string;
  assignmentType?: string;
  plannedStartAt: string;
  plannedEndAt: string;
  locationAddress: string;
  title: string;
  notesForEmployee?: string;
  internalNotes?: string;
  clientVisibleNotes?: string;
  billingRelevant?: boolean;
  requiresSignature?: boolean;
  requiresDocumentation?: boolean;
  requiresRoute?: boolean;
  tasks: Array<{ title: string; description?: string; category?: string; required?: boolean }>;
  createdBy?: string | null;
};

export type AutomationNotification = {
  id: string;
  tenantId: string;
  assignmentId: string;
  channel: 'employee' | 'client' | 'dispatch';
  eventType: string;
  message: string;
  createdAt: string;
};
