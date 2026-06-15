import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity } from '../portal/visibility';

export type CounselingCase = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string | null;
    counselorProfileId: string;
    subject: string;
    category: string;
    openedAt: string;
    closedAt: string | null;
    nextAppointmentAt: string | null;
    status: WorkflowStatus;
    summary: string | null;
  };

export type CounselingCaseDetail = CounselingCase & {
    clientName: string;
    counselorName: string;
    nextActionHint: string;
  };

export type CounselingListItem = Pick<
  CounselingCase,
  | 'id'
  | 'tenantId'
  | 'subject'
  | 'category'
  | 'openedAt'
  | 'nextAppointmentAt'
  | 'status'
  | 'updatedAt'
> & {
  clientName: string;
  counselorName: string;
};

export type BeratungDashboardStats = {
  totalCases: number;
  openCount: number;
  activeCount: number;
  upcomingAppointmentsCount: number;
  closedThisMonthCount: number;
};

export type FollowUp = TenantScopedEntity & {
  caseId: string;
  caseSubject: string;
  dueAt: string;
  assigneeName: string;
  status: WorkflowStatus;
  note: string | null;
};

export type BeratungModuleSettings = {
  protocolsRequired: boolean;
  followUpReminders: boolean;
  relativePortalSharing: boolean;
  careGradeTemplates: boolean;
  anonymCasesAllowed: boolean;
};

export type BeratungReportStats = {
  openCases: number;
  protocolsThisMonth: number;
  followUpsDue: number;
  closedThisMonth: number;
  avgCaseDurationDays: number;
};

export type Protocol = TenantScopedEntity &
  PortalScopedEntity & {
    caseId: string;
    content: string;
    recordedAt: string;
    status: WorkflowStatus;
  };
