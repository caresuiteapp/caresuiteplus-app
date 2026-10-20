import type { AssistAssignmentTaskDraft } from '@/types/assistCatalog';

export type ClientAssignmentProfile = {
  id: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  employeeId: string | null;
  employeeName: string;
  profileName: string;
  assignmentTitle: string;
  description: string;
  durationMinutes: number;
  taskTitles: string[];
  taskDrafts: AssistAssignmentTaskDraft[];
  serviceKey: string;
  serviceName: string;
  subjectKey: string;
  assignmentTypeKey: string;
  serviceCategoryKey: string;
  taskPackageId: string | null;
  billingBudgetSourceKey: string;
  riskFlagKeys: string[];
  documentationTemplateKey: string;
  proofTemplateKey: string;
  catalogSnapshotJson: Record<string, unknown>;
  locationAddress: string;
  locationNotes: string;
  notesForEmployee: string;
  internalNotes: string;
  clientVisibleNotes: string;
  billingRelevant: boolean;
  requiresSignature: boolean;
  requiresDocumentation: boolean;
  requiresRoute: boolean;
  clientPortalVisible: boolean;
  employeePortalVisible: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientAssignmentProfileInput = Omit<
  ClientAssignmentProfile,
  | 'id'
  | 'tenantId'
  | 'clientName'
  | 'employeeName'
  | 'isActive'
  | 'sortOrder'
  | 'createdAt'
  | 'updatedAt'
>;

export type ScheduledClientAssignment = {
  assignmentId: string;
  profileId: string;
  status: 'confirmed';
  startAt: string;
  endAt: string;
};
