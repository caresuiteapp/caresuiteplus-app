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
  newCasesCount: number;
  appointmentsTodayCount: number;
  openFirstConsultationsCount: number;
  openProtocolsCount: number;
  dueFollowUpsCount: number;
  openCallbacksCount: number;
  openRelativeContactsCount: number;
  casesWithoutNextStepCount: number;
  deadlinesEscalationsCount: number;
  closedThisWeekCount: number;
  openReportsCount: number;
};

export function emptyBeratungDashboardStats(): BeratungDashboardStats {
  return {
    totalCases: 0,
    openCount: 0,
    activeCount: 0,
    upcomingAppointmentsCount: 0,
    closedThisMonthCount: 0,
    newCasesCount: 0,
    appointmentsTodayCount: 0,
    openFirstConsultationsCount: 0,
    openProtocolsCount: 0,
    dueFollowUpsCount: 0,
    openCallbacksCount: 0,
    openRelativeContactsCount: 0,
    casesWithoutNextStepCount: 0,
    deadlinesEscalationsCount: 0,
    closedThisWeekCount: 0,
    openReportsCount: 0,
  };
}

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
