import type { TenantScopedEntity } from '../core/base';

/** Konflikttypen Tourenplanung / Vertretung (Prompt Einsatzplanung-Erweiterung) */
export type RoutePlanningConflictCode =
  | 'absence'
  | 'qualification_missing'
  | 'overlapping_assignment'
  | 'travel_time_unrealistic'
  | 'max_working_time_warning'
  | 'missing_address'
  | 'missing_provider'
  | 'employee_inactive';

export const ROUTE_PLANNING_CONFLICT_LABELS: Record<RoutePlanningConflictCode, string> = {
  absence: 'Abwesenheit',
  qualification_missing: 'Qualifikation fehlt',
  overlapping_assignment: 'Überlappender Einsatz',
  travel_time_unrealistic: 'Fahrzeit nicht plausibel',
  max_working_time_warning: 'Arbeitszeitwarnung',
  missing_address: 'Adresse fehlt',
  missing_provider: 'Kartenprovider nicht freigegeben',
  employee_inactive: 'Mitarbeitende:r inaktiv',
};

export type RoutePlanStatus = 'draft' | 'confirmed' | 'archived';

export type RoutePlan = TenantScopedEntity & {
  employeeId: string;
  planDate: string;
  status: RoutePlanStatus;
  title: string;
  totalStops: number;
  totalPlannedMinutes: number;
  confirmedAt: string | null;
  confirmedBy: string | null;
};

export type RoutePlanItem = TenantScopedEntity & {
  routePlanId: string;
  assignmentId: string;
  sortOrder: number;
  plannedArrivalAt: string;
  plannedDepartureAt: string;
  address: string;
  travelMinutesFromPrevious: number | null;
  travelPlausibility: 'ok' | 'warning' | 'unknown';
};

export type ReplacementSuggestionStatus = 'suggested' | 'accepted' | 'rejected' | 'expired';

export type ReplacementSuggestion = TenantScopedEntity & {
  assignmentId: string;
  originalEmployeeId: string;
  suggestedEmployeeId: string;
  absenceId: string | null;
  status: ReplacementSuggestionStatus;
  qualificationMatch: boolean;
  availabilityOk: boolean;
  travelTimeMinutes: number | null;
  travelPlausibility: 'ok' | 'warning' | 'unknown';
  regionalProximity: 'same_region' | 'adjacent' | 'distant' | 'unknown';
  score: number;
  reason: string;
};

export type PlanningAssignmentConflict = TenantScopedEntity & {
  assignmentId: string;
  employeeId: string | null;
  code: RoutePlanningConflictCode;
  message: string;
  severity: 'warning' | 'error';
  resolved: boolean;
  detectedAt: string;
};

export type TravelTimeEstimateSource = 'heuristic' | 'provider';

export type TravelTimeEstimate = TenantScopedEntity & {
  assignmentId: string | null;
  fromAddress: string;
  toAddress: string;
  durationMinutes: number;
  source: TravelTimeEstimateSource;
  providerKey: string | null;
  isPlausible: boolean;
  disclaimer: string;
  calculatedAt: string;
};

export type RoutePlanningAuditAction =
  | 'open_assignments_viewed'
  | 'replacement_suggested'
  | 'availability_checked'
  | 'qualification_checked'
  | 'travel_time_estimated'
  | 'work_time_checked'
  | 'proximity_checked'
  | 'tour_view_built'
  | 'conflicts_detected'
  | 'change_confirmed'
  | 'employee_notified';

export type RoutePlanningAuditEvent = TenantScopedEntity & {
  action: RoutePlanningAuditAction;
  actorId: string | null;
  actorRole: string | null;
  assignmentId: string | null;
  employeeId: string | null;
  summary: string;
  metadata?: Record<string, string>;
};

export type RoutePlanningConflict = {
  code: RoutePlanningConflictCode;
  message: string;
  severity: 'warning' | 'error';
  assignmentId?: string;
  employeeId?: string;
};

export type OpenAssignmentSummary = {
  assignmentId: string;
  title: string;
  clientId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  locationAddress: string;
  serviceType: string;
  conflictCount: number;
};

export type TourViewResult = {
  routePlan: RoutePlan;
  items: RoutePlanItem[];
  conflicts: RoutePlanningConflict[];
  travelEstimates: TravelTimeEstimate[];
};

export type RoutePlanningChangeInput = {
  assignmentId: string;
  newEmployeeId?: string | null;
  newStartAt?: string;
  newEndAt?: string;
  confirmed: boolean;
  reason?: string;
};

export const TRAVEL_TIME_DISCLAIMER =
  'Fahrzeiten sind Plausibilitätswerte — keine exakte Routenberechnung ohne freigegebenen Provider.';

export const MAX_DAILY_WORK_HOURS = 10;
