import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity } from '../portal/visibility';

export type Assignment = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    employeeId: string;
    title: string;
    scheduledStart: string;
    scheduledEnd: string;
    status: WorkflowStatus;
    notes: string | null;
  };

export type AssignmentPlan = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    employeeId: string;
    appointmentId: string | null;
    title: string;
    scheduledStart: string;
    scheduledEnd: string;
    status: WorkflowStatus;
    location: string;
    notes: string | null;
    clientName: string;
    employeeName: string;
    nextActionHint?: string;
    allowedStatusActions: WorkflowStatus[];
    allowedStatusTransitions?: import('./assignmentStatus').AssignmentStatus[];
  };

export type AssignmentListItem = Pick<
  AssignmentPlan,
  | 'id'
  | 'tenantId'
  | 'title'
  | 'scheduledStart'
  | 'scheduledEnd'
  | 'status'
  | 'location'
  | 'clientName'
  | 'employeeName'
  | 'updatedAt'
> & {
  serviceName?: string | null;
  durationMinutes?: number | null;
  planningStatus?: string;
  proofStatus?: string;
  billingStatus?: string;
  isAtRisk?: boolean;
  isIncomplete?: boolean;
};

export type AssistDashboardStats = {
  totalAssignments: number;
  todayCount: number;
  activeCount: number;
  inProgressCount: number;
  completedTodayCount: number;
  upcomingCount: number;
  atRiskCount: number;
  incompleteCount: number;
  openProofCount: number;
  /** Einsätze mit ausstehender Klient:innen-Unterschrift (Status oder Nachweis). */
  openSignatureCount: number;
  /** Fahrten ohne Endzeit (0114 trips). */
  openTripsCount: number;
};

export type ExecutionPhase = 'pending' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled';

export type AssignmentExecution = {
  assignmentId: string;
  tenantId: string;
  phase: ExecutionPhase;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  durationMinutes: number | null;
  locationNote: string | null;
  activityNote: string | null;
  updatedAt: string;
};

export type ActiveExecutionItem = {
  assignmentId: string;
  title: string;
  clientName: string;
  location: string;
  scheduledStart: string;
  scheduledEnd: string;
  phase: ExecutionPhase;
  assignmentStatus: WorkflowStatus;
};

export type CareRecord = TenantScopedEntity &
  PortalScopedEntity & {
    assignmentId: string;
    content: string;
    recordedAt: string;
    status: WorkflowStatus;
  };

export type Signature = TenantScopedEntity & {
  careRecordId: string;
  signedByProfileId: string;
  signedByName: string;
  signedAt: string;
  signatureDataUrl: string | null;
  status: WorkflowStatus;
};

export type CareRecordListItem = Pick<
  CareRecord,
  'id' | 'tenantId' | 'assignmentId' | 'content' | 'recordedAt' | 'status' | 'updatedAt'
> & {
  assignmentTitle: string;
  clientName: string;
  employeeName: string;
  hasSignature: boolean;
  pdfReady: boolean;
};

export type CareRecordDetail = CareRecordListItem & {
  createdAt: string;
  durationMinutes: number | null;
  location: string | null;
  signature: Signature | null;
  pdfExportPath: string | null;
};

export type PdfExportResult = {
  fileName: string;
  generatedAt: string;
  contentPreview: string;
  storagePath: string;
};

export type TripPurpose = 'einsatz' | 'dienstfahrt' | 'material' | 'sonstiges';

export type TripLog = TenantScopedEntity & {
  employeeId: string;
  assignmentId: string | null;
  vehicleLabel: string;
  purpose: TripPurpose;
  startedAt: string;
  endedAt: string | null;
  startAddress: string;
  endAddress: string | null;
  distanceKm: number | null;
  status: WorkflowStatus;
};

export type TripLogListItem = Pick<
  TripLog,
  | 'id'
  | 'tenantId'
  | 'employeeId'
  | 'assignmentId'
  | 'vehicleLabel'
  | 'purpose'
  | 'startedAt'
  | 'endedAt'
  | 'distanceKm'
  | 'status'
  | 'updatedAt'
> & {
  employeeName: string;
  routeSummary: string;
};

export type TripLogDetail = TripLogListItem & {
  startAddress: string;
  endAddress: string | null;
  notes: string | null;
  geofenceEvents: GeofenceEvent[];
};

export type VehiclePosition = {
  employeeId: string;
  employeeName: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading: string;
  updatedAt: string;
  assignmentTitle: string | null;
  insideGeofence: boolean;
};

export type GeofenceEvent = {
  id: string;
  type: 'enter' | 'exit';
  label: string;
  timestamp: string;
  employeeName: string;
};

export type TrackingDashboard = {
  activeTrips: number;
  employeesOnRoute: number;
  geofenceAlertsToday: number;
  positions: VehiclePosition[];
  recentEvents: GeofenceEvent[];
};
