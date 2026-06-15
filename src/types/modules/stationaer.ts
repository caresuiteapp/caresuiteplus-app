import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity } from '../portal/visibility';

export type Resident = TenantScopedEntity &
  PortalScopedEntity & {
    firstName: string;
    lastName: string;
    roomId: string | null;
    wing: string | null;
    admissionDate: string;
    careLevel: string | null;
    status: WorkflowStatus;
    notes: string | null;
  };

export type ResidentDetail = Resident & {
  roomName: string;
  nextActionHint: string;
};

export type ResidentListItem = Pick<
  Resident,
  | 'id'
  | 'tenantId'
  | 'firstName'
  | 'lastName'
  | 'wing'
  | 'admissionDate'
  | 'careLevel'
  | 'status'
  | 'updatedAt'
> & {
  roomName: string;
};

export type StationaerDashboardStats = {
  totalResidents: number;
  activeCount: number;
  newAdmissionsCount: number;
  occupancyPercent: number;
  handoverPendingCount: number;
};

export type LivingAreaListItem = Pick<Room, 'id' | 'name' | 'wing' | 'capacity' | 'status'> & {
  occupiedBeds: number;
  freeBeds: number;
};

export type LivingAreaDetail = LivingAreaListItem & {
  residentNames: string[];
  lastCleaningLabel: string;
  nextActionHint: string;
};

export type HandoverReportListItem = Handover & {
  authorName: string;
  wing: string | null;
};

export type HandoverDetail = HandoverReportListItem & {
  recipientNames: string[];
  priorityLabel: string;
  nextActionHint: string;
};

export type StationaerModuleSettings = {
  occupancyAlerts: boolean;
  mealPlanningEnabled: boolean;
  activityPlanningEnabled: boolean;
  relativeCommunication: boolean;
  handoverRequired: boolean;
  riskDocumentation: boolean;
};

export type StationaerReportStats = {
  occupancyPercent: number;
  activeResidents: number;
  handoversThisWeek: number;
  openRisks: number;
  newAdmissionsMonth: number;
};

export type Room = TenantScopedEntity & {
  name: string;
  wing: string | null;
  capacity: number;
  status: WorkflowStatus;
};

export type Handover = TenantScopedEntity & {
  shiftLabel: string;
  authorProfileId: string;
  content: string;
  handoverAt: string;
  status: WorkflowStatus;
};
