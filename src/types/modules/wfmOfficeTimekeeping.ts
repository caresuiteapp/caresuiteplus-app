/** ZEIT.3 — Office-Arbeitszeiterfassung (Historie, Prüfung, Ampel, Export) */

export type WfmDeviationAmpel = 'green' | 'yellow' | 'red' | 'blue';

export type WfmDeviationDirection =
  | 'too_early'
  | 'too_late'
  | 'on_time'
  | 'unknown';

export type WfmOfficeTimeEntryStatus =
  | 'open'
  | 'pending_review'
  | 'needs_clarification'
  | 'approved'
  | 'rejected'
  | 'corrected'
  | 'exported'
  | 'locked';

export type WfmOfficeTimeEntrySource =
  | 'portal'
  | 'office'
  | 'system'
  | 'correction'
  | 'manual_addition';

export type WfmOfficeWorkKind =
  | 'einsatz'
  | 'buero'
  | 'homeoffice'
  | 'fahrt'
  | 'pause'
  | 'korrektur'
  | 'nachtrag'
  | 'sonstige';

/** ZEIT.3.1 — Zeilentyp nach Daten-JOIN */
export type WfmOfficeTimeRowKind =
  | 'planned_with_actual'
  | 'planned_missing_actual'
  | 'unplanned_actual'
  | 'manual_entry'
  | 'session_only';

export type WfmOfficePlanDisplayStatus =
  | 'planned'
  | 'plan_missing'
  | 'no_planned_visit';

export type WfmOfficeActualDisplayStatus =
  | 'captured'
  | 'not_captured'
  | 'partial';

export type WfmOfficePeriodPreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'custom';

export type WfmDeviationPhase = 'start' | 'end';

export interface WfmDeviationEvaluation {
  ampel: WfmDeviationAmpel;
  deviationMinutes: number;
  direction: WfmDeviationDirection;
  plannedAt: string | null;
  actualAt: string | null;
  requiresJustification: boolean;
  blocksUntilJustification: boolean;
  noPlannedTime: boolean;
}

export interface WfmOfficeTimePeriod {
  preset: WfmOfficePeriodPreset;
  fromDate: string;
  toDate: string;
}

export interface WfmOfficeTimeEntry {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  /** ZEIT.3.1 — JOIN-Zeilentyp */
  rowKind?: WfmOfficeTimeRowKind;
  planDisplayStatus?: WfmOfficePlanDisplayStatus;
  actualDisplayStatus?: WfmOfficeActualDisplayStatus;
  assignmentStatus?: string | null;
  assignmentTitle?: string | null;
  assignmentId: string | null;
  visitId: string | null;
  clientLabel: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  startDeviationMinutes: number | null;
  endDeviationMinutes: number | null;
  startAmpel: WfmDeviationAmpel | null;
  endAmpel: WfmDeviationAmpel | null;
  overallAmpel: WfmDeviationAmpel | null;
  startJustification: string | null;
  endJustification: string | null;
  startJustificationAt: string | null;
  endJustificationAt: string | null;
  pauseMinutes: number;
  grossMinutes: number;
  netMinutes: number;
  travelMinutes: number | null;
  workKind: WfmOfficeWorkKind;
  status: WfmOfficeTimeEntryStatus;
  source: WfmOfficeTimeEntrySource;
  reviewStatus: WfmOfficeTimeEntryStatus;
  exportStatus: 'not_exported' | 'export_ready' | 'exported';
  sessionId: string | null;
  officeComment: string | null;
  hasOpenOfficeMessage: boolean;
  flags: string[];
  /** Persistente Review-Metadaten (P2.1) */
  reviewNote?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  lastReviewAction?: string | null;
  lastReviewComment?: string | null;
}

export interface WfmOfficeTimeKpis {
  totalHours: number;
  visitHours: number;
  pauseMinutes: number;
  travelMinutes: number;
  officeMinutes: number;
  homeofficeMinutes: number;
  activeEmployees: number;
  pendingReviewCount: number;
  openOfficeMessages: number;
  correctionCount: number;
  missingBookings: number;
  planningDeviations: number;
  exportReadyCount: number;
  exportedCount: number;
  /** ZEIT.2 compat */
  capturedToday: number;
  activeCount: number;
  onPauseCount: number;
  onVisitCount: number;
  inOfficeCount: number;
  homeofficeCount: number;
  openRequestsCount: number;
  /** ZEIT.3.1 — Zeitraum-KPIs aus vollständigem JOIN */
  plannedVisits: number;
  recordedVisits: number;
  unplannedBookings: number;
  employeesWithTime: number;
  employeesPlanned: number;
  employeesAbsent: number;
}

export interface WfmOfficePlannedVisit {
  assignmentId: string;
  visitId: string | null;
  tenantId: string;
  employeeId: string;
  workDate: string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  clientLabel: string | null;
  assignmentTitle: string | null;
  assignmentStatus: string | null;
}

export interface WfmOfficeTimeFilters {
  employeeIds: string[];
  statuses: WfmOfficeTimeEntryStatus[];
  sources: WfmOfficeTimeEntrySource[];
  workKinds: WfmOfficeWorkKind[];
  startAmpel: WfmDeviationAmpel[];
  endAmpel: WfmDeviationAmpel[];
  overallAmpel: WfmDeviationAmpel[];
  onlyDeviations: boolean;
  onlyPendingReview: boolean;
  onlyOfficeMessages: boolean;
  onlyExportReady: boolean;
  onlyExported: boolean;
  onlyIncomplete: boolean;
  onlyStartDeviations: boolean;
  onlyEndDeviations: boolean;
  onlyRotBlau: boolean;
  onlyTooEarlyStart: boolean;
  onlyTooLateStart: boolean;
  onlyTooEarlyEnd: boolean;
  onlyTooLateEnd: boolean;
}

export interface WfmOfficeAuditEntry {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  summary: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WfmOfficeMessage {
  id: string;
  tenantId: string;
  employeeId: string;
  assignmentId: string | null;
  visitId: string | null;
  clientLabel: string | null;
  phase: WfmDeviationPhase;
  plannedAt: string;
  actualAt: string;
  deviationMinutes: number;
  direction: WfmDeviationDirection;
  ampel: WfmDeviationAmpel;
  justification: string;
  justificationAt: string;
  reviewStatus: WfmOfficeTimeEntryStatus;
  entryId: string | null;
  createdAt: string;
}

export interface WfmOfficeTimeOverview {
  period: WfmOfficeTimePeriod;
  kpis: WfmOfficeTimeKpis;
  entries: WfmOfficeTimeEntry[];
  employees: Array<{ id: string; name: string }>;
}

export interface WfmOfficeCorrectionInput {
  entryId: string;
  reason: string;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
  pauseMinutes?: number | null;
  workKind?: WfmOfficeWorkKind | null;
  status?: WfmOfficeTimeEntryStatus | null;
}

export interface WfmOfficeManualEntryInput {
  employeeId: string;
  workDate: string;
  workKind: WfmOfficeWorkKind;
  actualStartAt: string;
  actualEndAt: string;
  pauseMinutes: number;
  assignmentId?: string | null;
  reason: string;
}

export const WFM_OFFICE_TIME_STATUS_LABELS: Record<WfmOfficeTimeEntryStatus, string> = {
  open: 'Offen',
  pending_review: 'Offen zur Prüfung',
  needs_clarification: 'Rückfrage offen',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  corrected: 'Korrigiert',
  exported: 'Exportiert',
  locked: 'Gesperrt',
};

export const WFM_OFFICE_WORK_KIND_LABELS: Record<WfmOfficeWorkKind, string> = {
  einsatz: 'Einsatz',
  buero: 'Büro',
  homeoffice: 'Homeoffice',
  fahrt: 'Fahrt',
  pause: 'Pause',
  korrektur: 'Korrektur',
  nachtrag: 'Nachtrag',
  sonstige: 'Sonstige Arbeitszeit',
};

export const WFM_DEVIATION_AMPEL_LABELS: Record<WfmDeviationAmpel, string> = {
  green: 'Grün',
  yellow: 'Gelb',
  red: 'Rot',
  blue: 'Blau',
};

export const WFM_DEVIATION_DIRECTION_LABELS: Record<WfmDeviationDirection, string> = {
  too_early: 'Zu früh',
  too_late: 'Zu spät',
  on_time: 'Im Toleranzbereich',
  unknown: 'Unbekannt',
};

export const WFM_OFFICE_PERIOD_PRESET_LABELS: Record<WfmOfficePeriodPreset, string> = {
  today: 'Heute',
  yesterday: 'Gestern',
  this_week: 'Diese Woche',
  last_week: 'Letzte Woche',
  this_month: 'Aktueller Monat',
  last_month: 'Letzter Monat',
  last_7_days: 'Letzte 7 Tage',
  last_30_days: 'Letzte 30 Tage',
  custom: 'Freier Zeitraum',
};
