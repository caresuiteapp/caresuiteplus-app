/** Prompt 72 — Urlaubs-, Krankheits- und Abwesenheitsverwaltung */

export type AbsenceType =
  | 'vacation'
  | 'sick_leave'
  | 'child_sick_leave'
  | 'unpaid_leave'
  | 'training'
  | 'public_holiday'
  | 'blocked_time'
  | 'appointment'
  | 'no_availability'
  | 'suspension'
  | 'other';

export type AbsenceStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'active'
  | 'completed'
  | 'requires_review'
  | 'archived';

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  vacation: 'Urlaub',
  sick_leave: 'Krankheit',
  child_sick_leave: 'Kind krank',
  unpaid_leave: 'Unbezahlter Urlaub',
  training: 'Fortbildung',
  public_holiday: 'Feiertag',
  blocked_time: 'Blockierte Zeit',
  appointment: 'Termin',
  no_availability: 'Keine Verfügbarkeit',
  suspension: 'Freistellung',
  other: 'Sonstige Abwesenheit',
};

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  requested: 'Beantragt',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  cancelled: 'Storniert',
  active: 'Aktiv',
  completed: 'Abgeschlossen',
  requires_review: 'Prüfung erforderlich',
  archived: 'Archiviert',
};

/** Konflikttypen bei Einsatzplanung / Vertretung */
export type AbsenceConflictCode =
  | 'employee_absent'
  | 'employee_sick'
  | 'employee_on_vacation'
  | 'employee_training'
  | 'unavailable_time'
  | 'assignment_needs_replacement';

export type AbsenceConflict = {
  code: AbsenceConflictCode;
  message: string;
  severity: 'warning' | 'error';
  absenceId?: string;
  assignmentId?: string;
};

export type EmployeeAbsence = {
  id: string;
  tenantId: string;
  employeeId: string;
  absenceType: AbsenceType;
  status: AbsenceStatus;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  /** Interne Notiz — nur Admin */
  internalNotes: string;
  /** Für Mitarbeiter sichtbar (ohne Krankdetails) */
  employeeVisibleNote: string;
  /** Sensible Krankheitsdetails — nur mit view_sensitive */
  sickDetails: string | null;
  /** AU-Dokument — nur mit view_sensitive */
  auDocumentId: string | null;
  /** Fortbildungszertifikat */
  certificateDocumentId: string | null;
  replacementRequired: boolean;
  hideDetailsFromAdmin: boolean;
  requestedDays: number | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  qualificationUpdated: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeAbsenceRequest = {
  id: string;
  tenantId: string;
  employeeId: string;
  absenceId: string | null;
  requestedStartsAt: string;
  requestedEndsAt: string;
  requestedDays: number;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  employeeNote: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeAvailability = {
  id: string;
  tenantId: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  ruleId: string | null;
  label: string;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeAvailabilityRule = {
  id: string;
  tenantId: string;
  employeeId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  label: string;
  createdAt: string;
  updatedAt: string;
};

export type ReplacementRequestStatus =
  | 'open'
  | 'suggested'
  | 'assigned'
  | 'completed'
  | 'cancelled';

export type ReplacementRequest = {
  id: string;
  tenantId: string;
  assignmentId: string;
  originalEmployeeId: string;
  absenceId: string | null;
  suggestedEmployeeId: string | null;
  assignedEmployeeId: string | null;
  status: ReplacementRequestStatus;
  travelTimeMinutes: number | null;
  qualificationMatch: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type AbsenceAuditEvent = {
  id: string;
  tenantId: string;
  absenceId: string;
  action: string;
  actorId: string | null;
  actorRole: string | null;
  summary: string;
  metadata?: Record<string, string>;
  createdAt: string;
};

export type VacationEntitlement = {
  id: string;
  tenantId: string;
  employeeId: string;
  year: number;
  entitledDays: number;
  createdAt: string;
  updatedAt: string;
};

export type VacationBalance = {
  id: string;
  tenantId: string;
  employeeId: string;
  year: number;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  updatedAt: string;
};

/** Dienstplan-Eintrag aus Abwesenheit */
export type AbsenceScheduleEntry = {
  id: string;
  tenantId: string;
  absenceId: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  entryType: 'absence';
  absenceType: AbsenceType;
  title: string;
  source: 'absence_sync';
  updatedAt: string;
};

/** Öffentliche Sicht für Mitarbeiterportal (ohne sensible Krankdetails) */
export type EmployeePortalAbsenceView = Pick<
  EmployeeAbsence,
  | 'id'
  | 'tenantId'
  | 'employeeId'
  | 'absenceType'
  | 'status'
  | 'startsAt'
  | 'endsAt'
  | 'allDay'
  | 'employeeVisibleNote'
  | 'replacementRequired'
  | 'requestedDays'
  | 'createdAt'
  | 'updatedAt'
> & {
  hasAuDocument: boolean;
};

/** Minimale Sicht für Klient:innen — keine Gründe */
export type ClientPortalAbsenceHint = {
  employeeId: string;
  startsAt: string;
  endsAt: string;
  /** Nur Typ-Kategorie, kein Grund */
  category: 'unavailable';
};

export type CreateVacationRequestInput = {
  tenantId: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
  employeeNote?: string;
  actorProfileId?: string | null;
};

export type RecordSickLeaveInput = {
  tenantId: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  sickDetails?: string;
  auDocumentId?: string | null;
  actorProfileId?: string | null;
};

export type CreateAbsenceInput = {
  tenantId: string;
  employeeId: string;
  absenceType: AbsenceType;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  internalNotes?: string;
  employeeVisibleNote?: string;
  hideDetailsFromAdmin?: boolean;
  status?: AbsenceStatus;
  actorProfileId?: string | null;
};
