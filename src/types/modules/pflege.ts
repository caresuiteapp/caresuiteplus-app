import type { TenantScopedEntity, WorkflowStatus } from '../core/base';
import type { PortalScopedEntity, SensitivityLevel } from '../portal/visibility';

export type CarePlanTask = {
  id: string;
  label: string;
  frequency: string;
  status: WorkflowStatus;
};

export type CarePlan = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    title: string;
    validFrom: string;
    validUntil: string | null;
    status: WorkflowStatus;
    sensitivity: SensitivityLevel;
    summary: string;
    tasks: CarePlanTask[];
    primaryNurseId: string | null;
  };

export type CarePlanListItem = Pick<
  CarePlan,
  'id' | 'tenantId' | 'title' | 'validFrom' | 'validUntil' | 'status' | 'clientId' | 'updatedAt'
> & {
  clientName: string;
  careLevel: string | null;
  alertCount: number;
};

export type CarePlanDetail = CarePlan & {
  clientName: string;
  careLevel: string | null;
  city: string;
  employeeName: string;
  nextActionHint: string;
  dueVitalsCount: number;
};

export type VitalReadingType = 'blood_pressure' | 'pulse' | 'temperature' | 'weight' | 'oxygen';

export type VitalReading = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    carePlanId: string | null;
    type: VitalReadingType;
    value: string;
    unit: string;
    measuredAt: string;
    status: WorkflowStatus;
    sensitivity: SensitivityLevel;
  };

export type VitalReadingListItem = VitalReading & {
  clientName: string;
  typeLabel: string;
  isDue: boolean;
  isAlert: boolean;
};

export type PflegeDashboardStats = {
  totalPlans: number;
  activePlansCount: number;
  dueVitalsCount: number;
  alertsCount: number;
  visitsToday: number;
  runningNow: number;
  dueMeasuresCount: number;
  openDocumentationCount: number;
  abnormalVitalsCount: number;
  openMedicationCount: number;
  openWoundDocsCount: number;
  openHandoversCount: number;
  openSisAssessmentCount: number;
  openReportsCount: number;
  assignedClientsCount: number;
};

export function emptyPflegeDashboardStats(): PflegeDashboardStats {
  return {
    totalPlans: 0,
    activePlansCount: 0,
    dueVitalsCount: 0,
    alertsCount: 0,
    visitsToday: 0,
    runningNow: 0,
    dueMeasuresCount: 0,
    openDocumentationCount: 0,
    abnormalVitalsCount: 0,
    openMedicationCount: 0,
    openWoundDocsCount: 0,
    openHandoversCount: 0,
    openSisAssessmentCount: 0,
    openReportsCount: 0,
    assignedClientsCount: 0,
  };
}

export type SisAssessment = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    clientName: string;
    assessedAt: string;
    overallScore: number;
    status: WorkflowStatus;
    nextReviewAt: string | null;
    assessorName: string;
  };

export type PflegeModuleSettings = {
  sisEnabled: boolean;
  vitalAlertsEnabled: boolean;
  woundDocumentationEnabled: boolean;
  bodyMapEnabled: boolean;
  mdkExportPrepared: boolean;
  autoHandoverHints: boolean;
};

export type PflegeReportStats = {
  activePlans: number;
  sisAssessmentsDue: number;
  vitalsDocumentedThisWeek: number;
  woundCasesOpen: number;
  mdkReadyCount: number;
};

export type WoundDocumentation = TenantScopedEntity &
  PortalScopedEntity & {
    clientId: string;
    bodyLocation: string;
    description: string;
    documentedAt: string;
    status: WorkflowStatus;
    sensitivity: SensitivityLevel;
  };
