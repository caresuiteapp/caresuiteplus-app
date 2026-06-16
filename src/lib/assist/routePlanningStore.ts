import type {
  PlanningAssignmentConflict,
  ReplacementSuggestion,
  RoutePlan,
  RoutePlanItem,
  RoutePlanningAuditEvent,
  TravelTimeEstimate,
} from '@/types/modules/routePlanning';

export type RoutePlanningStoreState = {
  routePlans: RoutePlan[];
  routePlanItems: RoutePlanItem[];
  replacementSuggestions: ReplacementSuggestion[];
  assignmentConflicts: PlanningAssignmentConflict[];
  travelTimeEstimates: TravelTimeEstimate[];
  auditEvents: RoutePlanningAuditEvent[];
};

export const ROUTE_PLANNING_STORE: RoutePlanningStoreState = {
  routePlans: [],
  routePlanItems: [],
  replacementSuggestions: [],
  assignmentConflicts: [],
  travelTimeEstimates: [],
  auditEvents: [],
};

let routePlanCounter = 0;
let routePlanItemCounter = 0;
let suggestionCounter = 0;
let conflictCounter = 0;
let estimateCounter = 0;
let auditCounter = 0;

export function nextRoutePlanId(): string {
  routePlanCounter += 1;
  return `rp-${routePlanCounter}`;
}

export function nextRoutePlanItemId(): string {
  routePlanItemCounter += 1;
  return `rpi-${routePlanItemCounter}`;
}

export function nextReplacementSuggestionId(): string {
  suggestionCounter += 1;
  return `rs-${suggestionCounter}`;
}

export function nextPlanningConflictId(): string {
  conflictCounter += 1;
  return `pc-${conflictCounter}`;
}

export function nextTravelEstimateId(): string {
  estimateCounter += 1;
  return `tte-${estimateCounter}`;
}

export function nextRoutePlanningAuditId(): string {
  auditCounter += 1;
  return `rpa-${auditCounter}`;
}

export function filterRoutePlanningByTenant<T extends { tenantId: string }>(
  rows: T[],
  tenantId: string,
): T[] {
  return rows.filter((row) => row.tenantId === tenantId);
}

export function resetRoutePlanningStore(): void {
  ROUTE_PLANNING_STORE.routePlans = [];
  ROUTE_PLANNING_STORE.routePlanItems = [];
  ROUTE_PLANNING_STORE.replacementSuggestions = [];
  ROUTE_PLANNING_STORE.assignmentConflicts = [];
  ROUTE_PLANNING_STORE.travelTimeEstimates = [];
  ROUTE_PLANNING_STORE.auditEvents = [];
  routePlanCounter = 0;
  routePlanItemCounter = 0;
  suggestionCounter = 0;
  conflictCounter = 0;
  estimateCounter = 0;
  auditCounter = 0;
}
